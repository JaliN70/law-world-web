import * as THREE from 'three';
import { PALETTE } from '../palette.js';

/** Procedural fallbacks when deco GLBs fail to load */

export function addRockyCliff(parent, radius = 32) {
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8b7355, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x6b5b45, flatShading: true });
  const n = 10;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const w = (Math.PI * 2 * radius) / n + 0.6;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 3.8, 2.4), i % 2 ? rockMat : darkMat);
    panel.position.set(Math.cos(ang) * (radius + 0.8), -1.6, Math.sin(ang) * (radius + 0.8));
    panel.rotation.y = -ang + Math.PI / 2;
    panel.name = `deco_cliff_${i}`;
    parent.add(panel);
  }
}

export function addCentralPlaza(parent) {
  const stoneRing = new THREE.Mesh(
    new THREE.RingGeometry(5.2, 7.2, 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.roofLight, flatShading: true, side: THREE.DoubleSide })
  );
  stoneRing.rotation.x = -Math.PI / 2;
  stoneRing.position.y = 0.32;
  stoneRing.name = 'deco_plaza_stone_ring';

  const navy = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 0.32, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.brand, flatShading: true })
  );
  navy.position.y = 0.5;
  navy.name = 'deco_plaza';

  const logoHex = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.18, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.logoRed })
  );
  logoHex.position.y = 0.72;
  logoHex.name = 'deco_logo_hex';

  parent.add(stoneRing, navy, logoHex);
}

export function addStoneGarden(parent, layout) {
  const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofLight, flatShading: true });
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road, flatShading: true });
  Object.entries(layout).forEach(([id, pos]) => {
    const [x, , z] = pos;
    const len = Math.hypot(x, z) * 0.55;
    const path = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, len), stoneMat);
    path.position.set(x * 0.42, 0.3, z * 0.42);
    path.rotation.y = Math.atan2(x, z);
    path.name = `deco_stone_path_${id}`;
    parent.add(path);
    const road = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, len * 0.72), roadMat);
    road.position.set(x * 0.58, 0.26, z * 0.58);
    road.rotation.y = Math.atan2(x, z);
    road.name = `deco_road_${id}`;
    parent.add(road);
  });
}

export function addTreeClusters(parent, layout) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.soil });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.canopy });
  const makeTree = (x, z, scale = 1) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.1 * scale, 5), trunkMat);
    trunk.position.y = 0.55 * scale;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 2 * scale, 6), leafMat);
    crown.position.y = 1.85 * scale;
    g.add(trunk, crown);
    g.position.set(x, 0, z);
    return g;
  };
  Object.values(layout).forEach(([bx, , bz], i) => {
    const t = makeTree(bx * 0.65, bz * 0.65, 0.9);
    t.name = `deco_tree_${i}`;
    parent.add(t);
  });
}
