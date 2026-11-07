import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import modelStats from '../data/model-stats.json';
import {
  attachUnlockMesh,
  attachSceneEffects,
  measureLocalEnvelope,
  envelopeWithinTolerance,
} from './buildings.js';

const BUILDING_IDS = ['fire', 'building', 'telecom', 'accessibility', 'water', 'electrical'];

let sharedPaletteMaterial = null;

function baseUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\//, '')}`;
}

function createDracoLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(baseUrl('draco/'));
  draco.preload();
  return draco;
}

function findMainMesh(root, id) {
  if (root.name === id && root.isMesh) return root;
  let found = null;
  root.traverse((o) => {
    if (o.name === id && o.isMesh) found = o;
  });
  return found;
}

function applySharedMaterial(root, sharedMat) {
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      o.material = sharedMat;
    }
  });
}

function extractSharedMaterial(gltf) {
  let tex = null;
  gltf.scene.traverse((o) => {
    if (o.isMesh?.material?.map && !tex) tex = o.material.map;
  });
  if (!tex) return null;
  tex.flipY = false;
  return new THREE.MeshStandardMaterial({
    map: tex,
    metalness: 0,
    roughness: 0.88,
    name: 'park_palette_shared',
  });
}

function cdEnvelopeFor(id) {
  const row = modelStats.find((r) => r.name === id);
  if (!row) return null;
  return { x: row.sizeXYZ[0], y: row.max[1], z: row.sizeXYZ[2] };
}

/**
 * Load Draco GLBs, compare bbox, swap onto existing placement parents when safe.
 * Never non-uniformly scale — only 1:1 when GLB envelope matches CD stats (±5%).
 */
export async function upgradeBuildingsToGlb({ buildings, onReport }) {
  const draco = createDracoLoader();
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const report = { swapped: [], keptColorBlock: [], errors: [] };

  for (const id of BUILDING_IDS) {
    const placement = buildings[id];
    if (!placement) continue;

    const mvpEnv = measureLocalEnvelope(placement);
    const cdEnv = cdEnvelopeFor(id);
    const mvpMatchesCd = cdEnv && envelopeWithinTolerance(mvpEnv, cdEnv);

    try {
      const gltf = await loader.loadAsync(baseUrl(`models/${id}.glb`));
      if (!sharedPaletteMaterial) {
        sharedPaletteMaterial = extractSharedMaterial(gltf);
      }
      if (sharedPaletteMaterial) applySharedMaterial(gltf.scene, sharedPaletteMaterial);

      const glbEnv = measureLocalEnvelope(gltf.scene);
      const glbMatchesCd = cdEnv && envelopeWithinTolerance(glbEnv, cdEnv);
      const mainMesh = findMainMesh(gltf.scene, id);

      if (!mainMesh) {
        report.keptColorBlock.push({ id, reason: 'missing_main_mesh' });
        continue;
      }

      if (!glbMatchesCd) {
        report.keptColorBlock.push({
          id,
          reason: 'glb_envelope_mismatch',
          glbSize: glbEnv,
          cdSize: cdEnv,
        });
        onReport?.(report);
        continue;
      }

      if (!mvpMatchesCd) {
        report.swapped.push({
          id,
          mode: 'glb_canonical_1to1',
          note: 'MVP 色塊外框與 CD 不符；GLB 外框符合 model-stats，以 1:1 替換（未縮放）',
          mvpSize: mvpEnv,
          glbSize: glbEnv,
        });
      } else {
        report.swapped.push({ id, mode: 'mvp_and_cd_match' });
      }

      const toRemove = [...placement.children];
      toRemove.forEach((c) => placement.remove(c));

      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.userData.clickable = true;
        }
      });
      placement.add(gltf.scene);
      attachUnlockMesh(placement, id);
      attachSceneEffects(placement, id, { isGlb: true });
    } catch (err) {
      report.errors.push({ id, message: String(err?.message || err) });
    }
  }

  draco.dispose();
  onReport?.(report);
  if (import.meta.env.DEV) console.info('[law-world] GLB swap report', report);
  return report;
}

export function collectPulseMeshes(buildings) {
  const rings = [];
  BUILDING_IDS.forEach((id) => {
    const p = buildings[id];
    if (p?.userData?.pulseRings) rings.push(...p.userData.pulseRings);
  });
  return rings;
}
