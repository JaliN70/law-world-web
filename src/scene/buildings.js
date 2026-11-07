import * as THREE from 'three';
import { PALETTE } from '../palette.js';

const TOL = 0.05;

const mat = (hex, opts = {}) =>
  new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...opts });

export function measureLocalEnvelope(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { x: size.x, y: size.y, z: size.z, min: box.min.clone(), max: box.max.clone() };
}

export function envelopeWithinTolerance(actual, expected) {
  return ['x', 'y', 'z'].every((k) => Math.abs(actual[k] - expected[k]) / expected[k] <= TOL);
}

export function createFire() {
  const g = new THREE.Group();
  g.name = 'fire_mvp';
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), mat(PALETTE.fire));
  base.position.set(-1, 1.5, 0);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 11, 2.5), mat(PALETTE.fire));
  tower.position.set(3, 5.5, -1);
  tower.name = 'fire_tower';
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 8), mat(PALETTE.fire));
  wing.position.set(-2, 1, 1);
  const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 8), mat(PALETTE.logoRed));
  hydrant.position.set(5, 0.3, 3);
  hydrant.name = 'deco_fire_hydrant';
  g.add(base, tower, wing, hydrant);
  return g;
}

export function createBuilding() {
  const g = new THREE.Group();
  g.name = 'building_mvp';
  const cube = new THREE.Mesh(new THREE.BoxGeometry(7, 8, 7), mat(PALETTE.building));
  cube.position.y = 4;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.4, 1.2), mat(PALETTE.windowDark));
  slab.position.set(0, 2, 3.6);
  g.add(cube, slab);
  return g;
}

export function createTelecom() {
  const g = new THREE.Group();
  g.name = 'telecom_mvp';
  const box = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), mat(PALETTE.telecom));
  box.position.y = 2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 12, 12), mat(PALETTE.telecom));
  pole.position.set(0, 8, 0);
  g.add(box, pole);
  return g;
}

export function createAccessibility() {
  const g = new THREE.Group();
  g.name = 'accessibility_mvp';
  const flat = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 7), mat(PALETTE.accessibility));
  flat.position.y = 1.25;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 3), mat(PALETTE.accessibility));
  ramp.position.set(-3, 0.75, 4);
  ramp.rotation.z = -0.25;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.6), mat(PALETTE.tactileYellow));
  strip.position.set(0, 2.35, 3.6);
  strip.name = 'deco_access_tactile';
  g.add(flat, ramp, strip);
  return g;
}

export function createWater() {
  const g = new THREE.Group();
  g.name = 'water_mvp';
  const box = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 6), mat(PALETTE.water));
  box.position.y = 1.5;
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), mat(PALETTE.windowDark));
  postL.position.set(-1.5, 3, 0);
  const postR = postL.clone();
  postR.position.x = 1.5;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.5, 16), mat(PALETTE.water));
  tank.position.y = 5.2;
  tank.name = 'deco_water_tank';
  const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 1), mat(PALETTE.waterBar));
  bar.position.set(0, 0.25, 3.5);
  bar.name = 'deco_water_channel';
  g.add(box, postL, postR, tank, bar);
  return g;
}

export function createElectrical() {
  const g = new THREE.Group();
  g.name = 'electrical_mvp';
  const positions = [
    [-2, 0, -1],
    [1.5, 0, 0],
    [0, 0, 2],
  ];
  positions.forEach((p, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 2.2), mat(PALETTE.electrical));
    b.position.set(p[0], 1.25, p[2]);
    g.add(b);
  });
  const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.5, 8), mat(PALETTE.roofLight));
  ins.position.set(2.5, 2, 1);
  ins.name = 'deco_electrical_insulator';
  const fence = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.8, 0.15), mat(PALETTE.windowDark));
  fence.position.set(0, 0.4, -3);
  g.add(ins, fence);
  return g;
}

const factories = {
  fire: createFire,
  building: createBuilding,
  telecom: createTelecom,
  accessibility: createAccessibility,
  water: createWater,
  electrical: createElectrical,
};

/** GLB 內無分件名稱時，於地面預留識別 mesh（非屋頂發光球）。 */
export function attachUnlockMesh(placement, id) {
  const groundMarkers = {
    fire: { name: 'deco_fire_hydrant', geo: new THREE.CylinderGeometry(0.22, 0.28, 0.55, 8), pos: [3.6, 0.28, 3.2] },
    building: {
      name: 'deco_building_compass',
      geo: new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12),
      pos: [0, 0.06, 3.8],
    },
    electrical: {
      name: 'deco_electrical_charger',
      geo: new THREE.BoxGeometry(0.5, 0.9, 0.35),
      pos: [2.8, 0.45, 2.6],
    },
  };
  const spec = groundMarkers[id];
  if (!spec || placement.getObjectByName(spec.name)) return;
  const colors = {
    fire: PALETTE.logoRed,
    building: PALETTE.brand,
    electrical: PALETTE.electrical,
  };
  const m = new THREE.Mesh(spec.geo, mat(colors[id] ?? PALETTE.brand));
  m.position.set(...spec.pos);
  m.name = spec.name;
  m.visible = false;
  m.userData.clickable = false;
  m.raycast = () => {};
  placement.add(m);
}

/** Scene-layer effects (not in GLB): pulse rings, unlock highlights */
export function attachSceneEffects(placement, id, { isGlb = false } = {}) {
  if (id === 'telecom') {
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 20), mat(PALETTE.roofLight));
    ring1.rotation.x = Math.PI / 2;
    ring1.position.set(0, isGlb ? 9.35 : 11, 0);
    ring1.name = 'deco_telecom_ring1';
    placement.add(ring1);
    placement.userData.pulseRings = [ring1];
  }
  placement.userData.clickable = true;
  placement.userData.areaId = id;
}

export function buildAllBuildings(layout) {
  const root = new THREE.Group();
  root.name = 'buildings_root';
  const map = {};
  for (const [id, pos] of Object.entries(layout)) {
    const placement = new THREE.Group();
    placement.name = `${id}_placement`;
    placement.position.set(pos[0], pos[1], pos[2]);
    placement.add(factories[id]());
    attachUnlockMesh(placement, id);
    attachSceneEffects(placement, id, { isGlb: false });
    map[id] = placement;
    root.add(placement);
  }
  return { root, map };
}
