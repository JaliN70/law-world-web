import * as THREE from 'three';
import {
  loadGlbScene,
  cloneDecoScene,
  applySharedMaterial,
  getSharedPaletteMaterial,
} from './glbLoader.js';
import { BUILDING_NAMES, BUILDING_HALF } from './layouts.js';

const STONE_START = 7.15;
const DESKTOP_ROAD_R = 25.5;
const MOBILE_ROAD_BOUNDS = { minX: -22, maxX: 22, minZ: -18, maxZ: 18 };
const HEX_ANGLES = [90, 30, -30, -90, -150, 150];
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

function addModularHolder(run, tmpl, ox, oz, rotY, segLen, nominalLen) {
  const holder = new THREE.Group();
  holder.position.set(ox, 0, oz);
  holder.rotation.y = rotY;
  const piece = cloneDecoScene(tmpl);
  if (nominalLen > 0 && segLen < nominalLen - 0.001) holder.scale.z = segLen / nominalLen;
  holder.add(piece);
  run.add(holder);
}

/** 沿固定方向鋪 4 m + 1 m 模組；尾段不足 1 m 時只縮最後 1 m 的 Z。 */
function placeModularRun(parent, { ox0, oz0, dirX, dirZ, rotY, startS, endS, t4, t1, name }) {
  if (!t4 || !t1 || endS <= startS + 0.02) return;
  const run = new THREE.Group();
  run.name = name;
  let s = startS;
  while (s < endS - 0.02) {
    const remain = endS - s;
    const use4 = remain >= 4;
    const nominal = use4 ? 4 : 1;
    let segLen = use4 ? 4 : remain;
    if (!use4 && remain <= 0.02) break;
    if (!use4 && remain < 1) segLen = remain;
    const tmpl = use4 ? t4 : t1;
    const mid = s + segLen / 2;
    addModularHolder(
      run,
      tmpl,
      ox0 + dirX * mid,
      oz0 + dirZ * mid,
      rotY,
      segLen,
      nominal
    );
    s += segLen;
  }
  parent.add(run);
}

function placeRadialStone(parent, layoutEntry, t4, t1, label) {
  const [bx, , bz] = layoutEntry;
  const dist = Math.hypot(bx, bz);
  if (dist < 0.01) return;
  const dirX = bx / dist;
  const dirZ = bz / dist;
  const rotY = Math.atan2(bx, bz);
  const endS = dist - BUILDING_HALF;
  placeModularRun(parent, {
    ox0: 0,
    oz0: 0,
    dirX,
    dirZ,
    rotY,
    startS: STONE_START,
    endS,
    t4,
    t1,
    name: `deco_run_stone_${label}`,
  });
}

function placeLinearStone(parent, x0, z0, x1, z1, t4, t1, name) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const dirX = dx / len;
  const dirZ = dz / len;
  const rotY = Math.atan2(dx, dz);
  placeModularRun(parent, {
    ox0: x0,
    oz0: z0,
    dirX,
    dirZ,
    rotY,
    startS: 0,
    endS: len,
    t4,
    t1,
    name,
  });
}

function hexRoadVertices(R) {
  return HEX_ANGLES.map((deg) => {
    const rad = ((deg - 30) * Math.PI) / 180;
    return [Math.cos(rad) * R, -Math.sin(rad) * R];
  });
}

/** 自原點射線與線段交點參數 t（O + t·d = A + u·(B−A)）。 */
function raySegmentHitT(dirX, dirZ, ax, az, bx, bz) {
  const ex = bx - ax;
  const ez = bz - az;
  const denom = dirX * ez - dirZ * ex;
  if (Math.abs(denom) < 1e-9) return null;
  const t = (ax * ez - az * ex) / denom;
  const u = (ax * dirZ - az * dirX) / denom;
  if (t <= 1e-5 || u < -1e-5 || u > 1 + 1e-5) return null;
  return t;
}

function desktopRayRoadHit(dirX, dirZ) {
  const verts = hexRoadVertices(DESKTOP_ROAD_R);
  let best = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const [x0, z0] = verts[i];
    const [x1, z1] = verts[(i + 1) % verts.length];
    const t = raySegmentHitT(dirX, dirZ, x0, z0, x1, z1);
    if (t != null && t < best) best = t;
  }
  return Number.isFinite(best) ? best : null;
}

function radialRoadHit(bx, bz, isMobile) {
  const dist = Math.hypot(bx, bz);
  if (dist < 0.01) return null;
  const dirX = bx / dist;
  const dirZ = bz / dist;
  const rotY = Math.atan2(bx, bz);
  if (!isMobile) {
    const s = desktopRayRoadHit(dirX, dirZ);
    if (s == null) return null;
    return { s, x: dirX * s, z: dirZ * s, dirX, dirZ, rotY };
  }
  const hits = [];
  if (dirX > 1e-6) hits.push((MOBILE_ROAD_BOUNDS.maxX - 0) / dirX);
  if (dirX < -1e-6) hits.push((MOBILE_ROAD_BOUNDS.minX - 0) / dirX);
  if (dirZ > 1e-6) hits.push((MOBILE_ROAD_BOUNDS.maxZ - 0) / dirZ);
  if (dirZ < -1e-6) hits.push((MOBILE_ROAD_BOUNDS.minZ - 0) / dirZ);
  const s = Math.min(...hits.filter((t) => t > 0));
  return { s, x: dirX * s, z: dirZ * s, dirX, dirZ, rotY };
}

function outerRoadWaypoints(isMobile) {
  if (isMobile) {
    const { minX, maxX, minZ, maxZ } = MOBILE_ROAD_BOUNDS;
    return [
      [minX, maxZ],
      [maxX, maxZ],
      [maxX, minZ],
      [minX, minZ],
    ];
  }
  return hexRoadVertices(DESKTOP_ROAD_R);
}

function placeOuterRoadNetwork(parent, t4, t1, isMobile) {
  const pts = outerRoadWaypoints(isMobile);
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    placeLinearStone(parent, x0, z0, x1, z1, t4, t1, `deco_road_edge_${i}`);
  }
}

function placeStoneSpurToRoad(parent, layoutEntry, hit, t4, t1, stoneToRoad, label) {
  const [bx, , bz] = layoutEntry;
  const dist = Math.hypot(bx, bz);
  if (!hit || dist < 0.01) return;
  const faceS = dist + BUILDING_HALF;
  const junctionS = hit.s - 1.0;
  if (junctionS <= faceS + 0.05) return;

  placeModularRun(parent, {
    ox0: 0,
    oz0: 0,
    dirX: hit.dirX,
    dirZ: hit.dirZ,
    rotY: hit.rotY,
    startS: faceS,
    endS: junctionS,
    t4,
    t1,
    name: `deco_run_stone_spur_${label}`,
  });

  if (stoneToRoad) {
    const piece = cloneDecoScene(stoneToRoad);
    const holder = new THREE.Group();
    holder.position.set(hit.dirX * (junctionS + 0.5), 0, hit.dirZ * (junctionS + 0.5));
    holder.rotation.y = hit.rotY;
    holder.name = `deco_junction_stone_road_${label}`;
    holder.add(piece);
    parent.add(holder);
  }
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
  const hasStone = templates.stone4 && templates.stone1;
  if (hasStone) {
    BUILDING_NAMES.forEach((id) => {
      const pos = layout[id];
      if (!pos) return;
      placeRadialStone(pathsGroup, pos, templates.stone4, templates.stone1, id);
      const hit = radialRoadHit(pos[0], pos[2], isMobile);
      placeStoneSpurToRoad(
        pathsGroup,
        pos,
        hit,
        templates.stone4,
        templates.stone1,
        templates.stoneToRoad,
        id
      );
    });
  } else {
    addStoneGardenProcedural(island, layout);
  }

  if (templates.road4 && templates.road1) {
    placeOuterRoadNetwork(pathsGroup, templates.road4, templates.road1, isMobile);
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
