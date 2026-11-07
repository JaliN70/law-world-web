import modelStats from '../data/model-stats.json';
import {
  attachUnlockMesh,
  attachSceneEffects,
  measureLocalEnvelope,
  envelopeWithinTolerance,
} from './buildings.js';
import {
  getGlbLoaders,
  applySharedMaterial,
  extractSharedMaterial,
  setSharedPaletteMaterial,
  baseUrl,
} from './glbLoader.js';

const BUILDING_IDS = ['fire', 'building', 'telecom', 'accessibility', 'water', 'electrical'];

function findMainMesh(root, id) {
  if (root.name === id && root.isMesh) return root;
  let found = null;
  root.traverse((o) => {
    if (o.name === id && o.isMesh) found = o;
  });
  return found;
}

function cdEnvelopeFor(id) {
  const row = modelStats.find((r) => r.name === id);
  if (!row) return null;
  return { x: row.sizeXYZ[0], y: row.max[1], z: row.sizeXYZ[2] };
}

export async function upgradeBuildingsToGlb({ buildings, onReport }) {
  const { gltfLoader } = getGlbLoaders();
  const report = { swapped: [], keptColorBlock: [], errors: [] };

  for (const id of BUILDING_IDS) {
    const placement = buildings[id];
    if (!placement) continue;

    const mvpEnv = measureLocalEnvelope(placement);
    const cdEnv = cdEnvelopeFor(id);
    const mvpMatchesCd = cdEnv && envelopeWithinTolerance(mvpEnv, cdEnv);

    try {
      const gltf = await gltfLoader.loadAsync(baseUrl(`models/${id}.glb`));
      const mat = extractSharedMaterial(gltf);
      if (mat) setSharedPaletteMaterial(mat);
      if (mat) applySharedMaterial(gltf.scene, mat);

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
        continue;
      }

      if (!mvpMatchesCd) {
        report.swapped.push({
          id,
          mode: 'glb_canonical_1to1',
          note: 'MVP 色塊外框與 CD 不符；GLB 外框符合 model-stats，以 1:1 替換（未縮放）',
        });
      } else {
        report.swapped.push({ id, mode: 'mvp_and_cd_match' });
      }

      const toRemove = [...placement.children];
      toRemove.forEach((c) => placement.remove(c));

      gltf.scene.traverse((o) => {
        if (o.isMesh) o.userData.clickable = true;
      });
      placement.add(gltf.scene);
      attachUnlockMesh(placement, id);
      attachSceneEffects(placement, id, { isGlb: true });
    } catch (err) {
      report.errors.push({ id, message: String(err?.message || err) });
    }
  }

  onReport?.(report);
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

// re-export baseUrl for tests
export { baseUrl };
