import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { buildAllBuildings } from './buildings.js';
import { pickLayout, computeWorldBounds } from './layouts.js';

const ISLAND_RADIUS = 32;
const GRASS_RADIUS = 31.3;

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
    new THREE.CylinderGeometry(GRASS_RADIUS, GRASS_RADIUS, 0.06, 32),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass, flatShading: true })
  );
  grass.position.y = -0.05;
  grass.name = 'deco_grass';

  const layout = pickLayout(isMobile);
  const worldBounds = computeWorldBounds(layout, { islandRadius: ISLAND_RADIUS });

  const { root, map } = buildAllBuildings(layout);
  island.add(grass, root);
  addScatterRocks(island);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 3, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.windowDark })
  );
  lamp.position.set(-6, 1.5, -6);
  lamp.name = 'deco_street_lamp';
  lamp.visible = false;
  island.add(lamp);

  scene.add(island);

  const clickable = Object.values(map);
  return { scene, island, buildings: map, clickable, pulseMeshes: [], worldBounds, layout, isMobile };
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
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + (i % 3) * 0.12, 0), rockMat);
    r.position.set(x, 0.05, z);
    r.name = `deco_rock_${i}`;
    r.userData.decorOnly = true;
    r.raycast = () => {};
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
    if ((o.name === 'deco_logo_hex' || o.name === 'deco_plaza_ring') && unlocks.deco_plaza_badge) {
      if (o.isMesh && o.material) {
        o.material.emissive = new THREE.Color(0xffcc00);
        o.material.emissiveIntensity = 0.28;
      }
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
