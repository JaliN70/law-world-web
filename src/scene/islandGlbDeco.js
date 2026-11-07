import * as THREE from 'three';
import { loadGlbScene, cloneDecoScene, getSharedPaletteMaterial } from './glbLoader.js';
import { ISLAND_GRASS_R, BUILDING_HALF } from './layouts.js';

const DOCK_Z = ISLAND_GRASS_R - 1.1;
const PATH_START_Z = BUILDING_HALF + 0.5;
const PATH_END_Z = DOCK_Z - 0.6;

function decoUrl(name) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}models/deco/${name}.glb`;
}

function placeLocalRun(parent, t4, t1, startZ, endZ) {
  if (!t4 || !t1 || endZ <= startZ + 0.05) return;
  const run = new THREE.Group();
  run.name = 'deco_island_path';
  let s = startZ;
  const dirSign = 1;
  while (s < endZ - 0.02) {
    const remain = endZ - s;
    const use4 = remain >= 4;
    const nominal = use4 ? 4 : 1;
    let segLen = use4 ? 4 : remain;
    if (!use4 && remain < 1) segLen = remain;
    const tmpl = use4 ? t4 : t1;
    const mid = s + (segLen * dirSign) / 2;
    const holder = new THREE.Group();
    holder.position.set(0, 0, mid);
    holder.rotation.y = 0;
    const piece = cloneDecoScene(tmpl);
    if (!use4 && segLen < nominal - 0.001) holder.scale.z = segLen / nominal;
    holder.add(piece);
    run.add(holder);
    s += segLen * dirSign;
  }
  parent.add(run);
}

function treeSpotsLocal() {
  const r = ISLAND_GRASS_R * 0.78;
  const ang = [0.9, 2.4, 4.0, 5.5];
  return ang.map((a, i) => ({
    x: Math.sin(a) * r,
    z: -Math.cos(a) * r,
    type: ['a', 'b', 'c', 'a'][i],
    scale: 0.9 + (i % 3) * 0.06,
  }));
}

export async function upgradeIslandsDeco({ islands, onReport }) {
  const report = { ok: [], failed: [] };
  const templates = {};
  for (const key of ['stone1', 'stone4', 'treeA', 'treeB', 'treeC']) {
    const map = {
      stone1: 'deco_path_stone',
      stone4: 'deco_path_stone_4m',
      treeA: 'deco_tree_cluster_a',
      treeB: 'deco_tree_cluster_b',
      treeC: 'deco_tree_cluster_c',
    };
    try {
      templates[key] = await loadGlbScene(decoUrl(map[key]));
      report.ok.push(map[key]);
    } catch {
      report.failed.push(map[key]);
    }
  }

  const shared = getSharedPaletteMaterial();
  Object.values(islands).forEach((island) => {
    if (templates.stone4 && templates.stone1) {
      placeLocalRun(island, templates.stone4, templates.stone1, PATH_START_Z, PATH_END_Z);
    }
    if (templates.treeA) {
      const treeMap = { a: templates.treeA, b: templates.treeB, c: templates.treeC };
      treeSpotsLocal().forEach((spot, i) => {
        const tmpl = treeMap[spot.type];
        if (!tmpl) return;
        const tree = cloneDecoScene(tmpl);
        tree.position.set(spot.x, 0, spot.z);
        tree.rotation.y = (i * 1.3) % (Math.PI * 2);
        tree.scale.setScalar(spot.scale);
        tree.name = `deco_tree_glb_${i}`;
        island.add(tree);
      });
    }
    if (shared) {
      island.traverse((o) => {
        if (o.isMesh && o.material && o.name.startsWith('deco_')) o.material = shared;
      });
    }
  });

  onReport?.(report);
  return report;
}
