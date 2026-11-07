import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { buildAllBuildings } from './buildings.js';
import { pickLayout } from './layouts.js';

export function createWorldScene({ isMobile, reducedMotion }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d4f0);
  scene.fog = new THREE.Fog(0xa8d4f0, 80, 140);

  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  const sun = new THREE.DirectionalLight(0xfff8e8, 0.85);
  sun.position.set(30, 50, 20);
  scene.add(ambient, sun);

  const island = new THREE.Group();
  island.name = 'island';

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(38, 42, 4, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.soil, flatShading: true })
  );
  soil.position.y = -2;
  soil.name = 'deco_island_soil';

  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(36, 36, 0.6, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass, flatShading: true })
  );
  grass.position.y = 0.1;
  grass.name = 'deco_grass';

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.35, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.brand, flatShading: true })
  );
  plaza.position.y = 0.45;
  plaza.name = 'deco_plaza';

  const logoHex = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.2, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.logoRed })
  );
  logoHex.position.y = 0.75;
  logoHex.name = 'deco_logo_hex';

  island.add(soil, grass, plaza, logoHex);

  const layout = pickLayout(isMobile);
  const { root, map } = buildAllBuildings(layout);
  island.add(root);

  addPaths(island, layout);
  addTrees(island);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 3, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.windowDark })
  );
  lamp.position.set(-8, 1.5, -8);
  lamp.name = 'deco_street_lamp';
  lamp.visible = false;
  island.add(lamp);

  scene.add(island);

  const clickable = Object.values(map);
  return { scene, island, buildings: map, clickable, pulseMeshes: [] };
}

function addPaths(parent, layout) {
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const ids = Object.keys(layout);
  ids.forEach((id) => {
    const [x, , z] = layout[id];
    const path = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, Math.hypot(x, z) * 0.55), roadMat);
    path.position.set(x * 0.35, 0.2, z * 0.35);
    path.rotation.y = Math.atan2(-z, x);
    path.name = `deco_path_${id}`;
    parent.add(path);
  });
}

function addTrees(parent) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.soil });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.canopy });
  const spots = [
    [-28, 8],
    [28, 8],
    [-28, -12],
    [26, -14],
    [0, 28],
    [0, -28],
  ];
  spots.forEach(([x, z], i) => {
    const g = new THREE.Group();
    g.name = `deco_tree_${i}`;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6), trunkMat);
    trunk.position.y = 0.6;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 6), leafMat);
    crown.position.y = 2.1;
    g.add(trunk, crown);
    g.position.set(x, 0, z);
    parent.add(g);
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
