import * as THREE from 'three';
import { PALETTE } from '../palette.js';

const mat = (hex, opts = {}) =>
  new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...opts });

export function createFire() {
  const g = new THREE.Group();
  g.name = 'fire';
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), mat(PALETTE.fire));
  base.position.set(-1, 1.5, 0);
  base.name = 'fire_base';
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 11, 2.5), mat(PALETTE.fire));
  tower.position.set(3, 5.5, -1);
  tower.name = 'fire_tower';
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 8), mat(PALETTE.fire));
  wing.position.set(-2, 1, 1);
  const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 8), mat(PALETTE.logoRed));
  hydrant.position.set(5, 0.3, 3);
  hydrant.name = 'fire_hydrant';
  g.add(base, tower, wing, hydrant);
  g.userData.clickable = true;
  return g;
}

export function createBuilding() {
  const g = new THREE.Group();
  g.name = 'building';
  const cube = new THREE.Mesh(new THREE.BoxGeometry(7, 8, 7), mat(PALETTE.building));
  cube.position.y = 4;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.4, 1.2), mat(PALETTE.windowDark));
  slab.position.set(0, 2, 3.6);
  slab.name = 'building_slab';
  g.add(cube, slab);
  g.userData.clickable = true;
  return g;
}

export function createTelecom() {
  const g = new THREE.Group();
  g.name = 'telecom';
  const box = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), mat(PALETTE.telecom));
  box.position.y = 2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 12, 12), mat(PALETTE.telecom));
  pole.position.set(0, 8, 0);
  pole.name = 'telecom_pole';
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 8, 24), mat(PALETTE.roofLight));
  ring1.rotation.x = Math.PI / 2;
  ring1.position.set(0, 11, 0);
  ring1.name = 'deco_telecom_ring1';
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.1, 8, 24), mat(0xffdd66, { emissive: 0xffaa00, emissiveIntensity: 0.2 }));
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 12.2;
  ring2.name = 'unlock_telecom_ring';
  ring2.visible = false;
  g.add(box, pole, ring1, ring2);
  g.userData.clickable = true;
  g.userData.pulseRings = [ring1, ring2.visible ? ring2 : ring1];
  return g;
}

export function createAccessibility() {
  const g = new THREE.Group();
  g.name = 'accessibility';
  const flat = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 7), mat(PALETTE.accessibility));
  flat.position.y = 1.25;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 3), mat(PALETTE.accessibility));
  ramp.position.set(-3, 0.75, 4);
  ramp.rotation.z = -0.25;
  ramp.name = 'deco_access_ramp';
  const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.6), mat(PALETTE.tactileYellow));
  strip.position.set(0, 2.35, 3.6);
  strip.name = 'deco_access_tactile';
  g.add(flat, ramp, strip);
  g.userData.clickable = true;
  return g;
}

export function createWater() {
  const g = new THREE.Group();
  g.name = 'water';
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
  g.userData.clickable = true;
  return g;
}

export function createElectrical() {
  const g = new THREE.Group();
  g.name = 'electrical';
  const positions = [
    [-2, 0, -1],
    [1.5, 0, 0],
    [0, 0, 2],
  ];
  positions.forEach((p, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 2.2), mat(PALETTE.electrical));
    b.position.set(p[0], 1.25, p[2]);
    b.name = `electrical_box_${i}`;
    g.add(b);
  });
  const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.5, 8), mat(PALETTE.roofLight));
  ins.position.set(2.5, 2, 1);
  ins.name = 'deco_electrical_insulator';
  const fence = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.8, 0.15), mat(PALETTE.windowDark));
  fence.position.set(0, 0.4, -3);
  fence.name = 'deco_electrical_fence';
  g.add(ins, fence);
  g.userData.clickable = true;
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

function attachUnlockMesh(group, id) {
  const map = {
    fire: 'unlock_fire_hydrant',
    building: 'unlock_building_compass',
    telecom: 'unlock_telecom_ring',
    accessibility: 'unlock_access_tactile',
    water: 'unlock_water_tower',
    electrical: 'unlock_electrical_glow',
  };
  const name = map[id];
  if (!name) return;
  if (id === 'telecom') return;
  const m = createUnlockDecor(name);
  m.position.set(0, 5.5, 2);
  group.add(m);
}

export function createUnlockDecor(name, color = 0xffdd66) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    mat(color, { emissive: color, emissiveIntensity: 0.4 })
  );
  m.name = name;
  m.visible = false;
  return m;
}

export function buildAllBuildings(layout) {
  const root = new THREE.Group();
  root.name = 'buildings_root';
  const map = {};
  for (const [id, pos] of Object.entries(layout)) {
    const b = factories[id]();
    b.position.set(pos[0], pos[1], pos[2]);
    attachUnlockMesh(b, id);
    map[id] = b;
    root.add(b);
  }
  return { root, map };
}
