import * as THREE from 'three';
import {
  loadGlbScene,
  cloneDecoScene,
  applySharedMaterial,
  getSharedPaletteMaterial,
} from './glbLoader.js';
import { BUILDING_NAMES, BUILDING_HALF } from './layouts.js';
import { PALETTE } from '../palette.js';
import {
  addCentralPlaza as addCentralPlazaProcedural,
  addRockyCliff as addRockyCliffProcedural,
  addStoneGarden as addStoneGardenProcedural,
  addTreeClusters as addTreeClustersProcedural,
} from './worldProcedural.js';

const DECO = {
  stone1: 'deco_path_stone',
  stone4: 'deco_path_stone_4m',
  road1: 'deco_path_road',
  road4: 'deco_path_road_4m',
  stoneToRoad: 'deco_path_stone_to_road',
  plaza: 'deco_plaza_ring',
  cliff: 'deco_island_cliff',
  treeA: 'deco_tree_cluster_a',
  treeB: 'deco_tree_cluster_b',
  treeC: 'deco_tree_cluster_c',
};

function decoUrl(name) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}models/deco/${name}.glb`;
}

async function loadDecoTemplate(name) {
  try {
    return await loadGlbScene(decoUrl(name));
  } catch (e) {
    console.warn(`[law-world] deco load failed: ${name}`, e);
    return null;
  }
}

function placeRadialRun(parent, template, layoutEntry, opts) {
  const [bx, , bz] = layoutEntry;
  const dist = Math.hypot(bx, bz);
  if (dist < 0.01) return;
  const dx = bx / dist;
  const dz = bz / dist;
  const rotY = Math.atan2(bx, bz);
  const sEnd = dist - 4.2;
  let s = opts.start;
  const run = new THREE.Group();
  run.name = `deco_run_${opts.kind}_${bx}_${bz}`;

  while (s < sEnd - 0.05) {
    const remain = sEnd - s;
    let segLen = 0;
    let use4 = false;
    if (remain >= 4) {
      segLen = 4;
      use4 = true;
    } else if (remain >= 1) {
      segLen = 1;
    } else break;

    const tmpl = use4 ? opts.t4 : opts.t1;
    if (!tmpl) break;
    const piece = cloneDecoScene(tmpl);
    const mid = s + segLen / 2;
    piece.position.set(0, 0, 0);
    const holder = new THREE.Group();
    holder.position.set(dx * mid, 0, dz * mid);
    holder.rotation.y = rotY;
    if (!use4 && segLen < 0.999) {
      holder.scale.z = remain;
    } else if (!use4 && remain < 1 && remain > 0.05) {
      holder.scale.z = remain;
    }
    holder.add(piece);
    run.add(holder);
    s += use4 ? 4 : Math.min(1, remain);
  }
  parent.add(run);
}

function placeOffsetRoad(parent, template4, template1, layoutEntry, plazaStart, offset = 2.9) {
  const [bx, , bz] = layoutEntry;
  const dist = Math.hypot(bx, bz);
  if (dist < 0.01) return;
  const dx = bx / dist;
  const dz = bz / dist;
  const px = -dz * offset;
  const pz = dx * offset;
  const rotY = Math.atan2(bx, bz);
  const sEnd = dist + 1.5;
  let s = plazaStart + 2;
  const run = new THREE.Group();
  run.name = `deco_road_run_${bx}_${bz}`;

  while (s < sEnd - 0.05) {
    const remain = sEnd - s;
    const use4 = remain >= 4;
    const segLen = use4 ? 4 : remain >= 1 ? 1 : 0;
    if (!segLen) break;
    const tmpl = use4 ? template4 : template1;
    if (!tmpl) break;
    const piece = cloneDecoScene(tmpl);
    const mid = s + segLen / 2;
    const holder = new THREE.Group();
    holder.position.set(dx * mid + px, 0, dz * mid + pz);
    holder.rotation.y = rotY;
    if (!use4 && remain < 1) holder.scale.z = remain;
    holder.add(piece);
    run.add(holder);
    s += use4 ? 4 : Math.min(1, remain);
  }
  parent.add(run);
}

function treeFarFromBuildings(x, z, layout, minClear = 6.2) {
  return Object.values(layout).every(([bx, , bz]) => Math.hypot(x - bx, z - bz) >= BUILDING_HALF + minClear);
}

function treeSpots(layout, isMobile) {
  const spots = [];
  const push = (x, z, type, scale) => {
    if (!treeFarFromBuildings(x, z, layout)) return;
    if (Math.hypot(x, z) < 8.5) return;
    spots.push({ x, z, type, scale });
  };

  Object.values(layout).forEach(([bx, , bz]) => {
    const d = Math.hypot(bx, bz) || 1;
    const ox = bx / d;
    const oz = bz / d;
    const tx = -oz;
    const tz = ox;
    const outward = isMobile ? 6.2 : 5.6;
    push(bx + ox * outward + tx * 2.2, bz + oz * outward + tz * 1.4, 'a', 0.95);
    push(bx + ox * (outward + 1.6) - tx * 2.6, bz + oz * (outward + 1.6) - tz * 1.8, 'b', 1.02);
  });

  const ring = isMobile ? 18.5 : 20;
  push(-ring, 6, 'c', 1.05);
  push(ring, 6, 'a', 0.92);
  push(-ring, -6.5, 'b', 0.98);
  push(ring, -6.5, 'c', 0.88);
  push(-4, ring, 'a', 1.02);
  push(5, -ring, 'b', 0.94);
  push(-ring * 0.75, ring * 0.55, 'c', 1.08);
  push(ring * 0.8, -ring * 0.62, 'a', 0.9);

  return spots;
}

/**
 * Load CD deco GLBs and replace procedural scenery.
 */
export async function upgradeDecoToGlb({ island, layout, isMobile, onReport }) {
  const report = { ok: [], failed: [] };
  const decoRoot = new THREE.Group();
  decoRoot.name = 'deco_glb_root';

  const templates = {};
  for (const [key, name] of Object.entries(DECO)) {
    const t = await loadDecoTemplate(name);
    if (t) {
      templates[key] = t;
      report.ok.push(name);
    } else {
      report.failed.push(name);
    }
  }

  const shared = getSharedPaletteMaterial();
  if (shared) applySharedMaterial(decoRoot, shared);

  const stoneStart = 7.15;

  if (templates.cliff) {
    const cliff = cloneDecoScene(templates.cliff);
    cliff.name = 'deco_island_cliff';
    cliff.traverse((o) => {
      if (o.isMesh) {
        o.userData.decorOnly = true;
        o.raycast = () => {};
      }
    });
    decoRoot.add(cliff);
  } else {
    addRockyCliffProcedural(island);
    report.failed.push('deco_island_cliff_fallback');
  }

  if (templates.plaza) {
    const plaza = cloneDecoScene(templates.plaza);
    plaza.position.set(0, 0, 0);
    plaza.name = 'deco_plaza_ring';
    const badgeGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.92, 0.06, 6),
      new THREE.MeshLambertMaterial({
        color: PALETTE.logoRed,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    badgeGlow.position.y = 0.2;
    badgeGlow.name = 'deco_plaza_badge_glow';
    badgeGlow.visible = false;
    badgeGlow.raycast = () => {};
    badgeGlow.userData.decorOnly = true;
    plaza.add(badgeGlow);
    decoRoot.add(plaza);
  } else {
    addCentralPlazaProcedural(island);
  }

  const pathsGroup = new THREE.Group();
  pathsGroup.name = 'deco_paths';
  if (templates.stone4 && templates.stone1) {
    BUILDING_NAMES.forEach((id) => {
      const pos = layout[id];
      if (!pos) return;
      placeRadialRun(pathsGroup, null, pos, {
        kind: 'stone',
        start: stoneStart,
        t4: templates.stone4,
        t1: templates.stone1,
      });
    });
  } else {
    addStoneGardenProcedural(island, layout);
  }

  if (templates.road4 && templates.road1) {
    BUILDING_NAMES.forEach((id) => {
      const pos = layout[id];
      if (!pos) return;
      placeOffsetRoad(pathsGroup, templates.road4, templates.road1, pos, stoneStart);
    });
  }

  decoRoot.add(pathsGroup);

  if (templates.treeA && templates.treeB && templates.treeC) {
    const treeMap = { a: templates.treeA, b: templates.treeB, c: templates.treeC };
    treeSpots(layout, isMobile).forEach((spot, i) => {
      const tmpl = treeMap[spot.type];
      if (!tmpl) return;
      const tree = cloneDecoScene(tmpl);
      tree.position.set(spot.x, 0, spot.z);
      tree.rotation.y = (i * 1.7) % (Math.PI * 2);
      tree.scale.setScalar(spot.scale);
      tree.name = `deco_tree_glb_${i}`;
      decoRoot.add(tree);
    });
  } else {
    addTreeClustersProcedural(island, layout);
  }

  const prev = island.getObjectByName('deco_glb_root');
  if (prev) island.remove(prev);

  island.children
    .filter((c) =>
      String(c.name).match(
        /^(deco_cliff|deco_plaza|deco_logo|deco_plaza_stone|deco_stone_path|deco_road|deco_plaza_path|deco_tree_[^g])/
      )
    )
    .forEach((c) => island.remove(c));

  decoRoot.name = 'deco_glb_root';
  island.add(decoRoot);
  onReport?.(report);
  if (import.meta.env.DEV) console.info('[law-world] deco report', report);
  return report;
}
