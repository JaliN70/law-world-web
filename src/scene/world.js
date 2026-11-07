import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { buildAllBuildings } from './buildings.js';
import { pickLayout, computeWorldBounds } from './layouts.js';

const ISLAND_RADIUS = 32;

export function createWorldScene({ isMobile, reducedMotion }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd4f5);
  scene.fog = new THREE.Fog(0x9fd4f5, 90, 160);

  const ambient = new THREE.AmbientLight(0xffffff, 0.78);
  const sun = new THREE.DirectionalLight(0xfff6e6, 0.88);
  sun.position.set(30, 50, 20);
  scene.add(ambient, sun);

  const island = new THREE.Group();
  island.name = 'island';

  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, 0.55, 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass, flatShading: true })
  );
  grass.position.y = 0.25;
  grass.name = 'deco_grass';

  addRockyCliff(island, ISLAND_RADIUS);

  addCentralPlaza(island);

  const layout = pickLayout(isMobile);
  const worldBounds = computeWorldBounds(layout, { islandRadius: ISLAND_RADIUS });

  const { root, map } = buildAllBuildings(layout);
  island.add(root);

  addStoneGarden(island, layout);
  addTreeClusters(island, layout);
  addScatterRocks(island);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 3, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.windowDark })
  );
  lamp.position.set(-6, 1.5, -6);
  lamp.name = 'deco_street_lamp';
  lamp.visible = false;
  island.add(lamp);

  island.add(grass);
  scene.add(island);

  const clickable = Object.values(map);
  return { scene, island, buildings: map, clickable, pulseMeshes: [], worldBounds, layout };
}

function addRockyCliff(parent, radius) {
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
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 1.1, 1.8), darkMat);
    cap.position.set(Math.cos(ang) * (radius + 1.4), -3.1, Math.sin(ang) * (radius + 1.4));
    cap.rotation.y = -ang + Math.PI / 2;
    parent.add(cap);
  }
}

function addCentralPlaza(parent) {
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

function addStoneGarden(parent, layout) {
  const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofLight, flatShading: true });
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road, flatShading: true });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(8.5, 1.1, 4, 16),
    stoneMat
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.28;
  ring.name = 'deco_plaza_path_ring';
  parent.add(ring);

  Object.entries(layout).forEach(([id, pos]) => {
    const [x, , z] = pos;
    const dist = Math.hypot(x, z);
    const len = dist * 0.72;
    const path = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, len), stoneMat);
    path.position.set(x * 0.42, 0.3, z * 0.42);
    path.rotation.y = Math.atan2(x, z);
    path.name = `deco_stone_path_${id}`;
    parent.add(path);

    const road = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, len * 0.55), roadMat);
    road.position.set(x * 0.58, 0.26, z * 0.58);
    road.rotation.y = Math.atan2(x, z);
    road.name = `deco_road_${id}`;
    parent.add(road);
  });
}

function addTreeClusters(parent, layout) {
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

  const clusterSpots = [];
  Object.values(layout).forEach(([bx, , bz]) => {
    const nx = -bz * 0.35;
    const nz = bx * 0.35;
    clusterSpots.push([bx * 0.65 + nx, bz * 0.65 + nz, 0.9]);
    clusterSpots.push([bx * 0.5 - nx, bz * 0.5 - nz, 1.05]);
    clusterSpots.push([bx * 0.82, bz * 0.82, 0.85]);
  });

  clusterSpots.push([0, 11, 1], [0, -11, 1], [-11, 0, 0.95], [11, 0, 0.95]);

  clusterSpots.forEach(([x, z, s], i) => {
    const t = makeTree(x, z, s);
    t.name = `deco_tree_${i}`;
    parent.add(t);
  });
}

function addScatterRocks(parent) {
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x9ca3af, flatShading: true });
  const pts = [
    [-5, 12],
    [6, 11],
    [-12, -4],
    [12, -5],
    [4, -13],
    [-6, -12],
  ];
  pts.forEach(([x, z], i) => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + (i % 3) * 0.15, 0), rockMat);
    r.position.set(x, 0.35, z);
    r.name = `deco_rock_${i}`;
    parent.add(r);
  });
}

export function setBuildingSaturation(buildings, focusId) {
  Object.entries(buildings).forEach(([id, group]) => {
    const dim = focusId && id !== focusId;
    group.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      if (obj.material.color) {
        if (!obj.userData.baseColor) obj.userData.baseColor = obj.material.color.clone();
        const c = obj.userData.baseColor;
        const hsl = { h: 0, s: 0, l: 0 };
        c.getHSL(hsl);
        obj.material.color.setHSL(hsl.h, hsl.s * (dim ? 0.6 : 1), hsl.l);
      } else if (obj.material.map) {
        if (obj.userData.baseOpacity === undefined) obj.userData.baseOpacity = obj.material.opacity ?? 1;
        obj.material.transparent = true;
        obj.material.opacity = dim ? 0.45 : obj.userData.baseOpacity;
      }
    });
  });
}

export function applyUnlocks(scene, unlocks) {
  scene.traverse((o) => {
    if (o.name.startsWith('unlock_') && unlocks[o.name]) o.visible = true;
    if (o.name === 'deco_street_lamp' && unlocks.deco_street_lamp) o.visible = true;
    if (o.name === 'deco_logo_hex' && unlocks.deco_plaza_badge) {
      o.material = new THREE.MeshLambertMaterial({
        color: PALETTE.logoRed,
        emissive: 0xffcc00,
        emissiveIntensity: 0.35,
      });
    }
    if (o.name === 'deco_access_tactile' && unlocks.unlock_access_tactile) {
      o.material = new THREE.MeshLambertMaterial({
        color: PALETTE.tactileYellow,
        emissive: PALETTE.tactileYellow,
        emissiveIntensity: 0.45,
      });
    }
    if (o.name === 'deco_water_tank' && unlocks.unlock_water_tower) {
      o.material.emissive = new THREE.Color(PALETTE.waterBar);
      o.material.emissiveIntensity = 0.25;
    }
    if (o.name === 'unlock_fire_hydrant' && unlocks.unlock_fire_hydrant) {
      o.visible = true;
    }
  });
}
