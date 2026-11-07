import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { ISLAND_GRASS_R, BUILDING_HALF } from './layouts.js';

export function buildIslandTerrain(islandId) {
  const root = new THREE.Group();
  root.name = `island_${islandId}`;

  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_GRASS_R, ISLAND_GRASS_R, 0.08, 28),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass, flatShading: true })
  );
  grass.position.y = -0.02;
  grass.name = 'deco_grass';
  grass.userData.islandPick = islandId;
  grass.userData.decorOnly = true;

  const soilMat = new THREE.MeshLambertMaterial({ color: PALETTE.soil, flatShading: true });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8b939f, flatShading: true });
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const w = (Math.PI * 2 * ISLAND_GRASS_R) / n + 0.35;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, 1.6), i % 2 ? soilMat : rockMat);
    panel.position.set(
      Math.cos(ang) * (ISLAND_GRASS_R + 0.5),
      -1.35,
      Math.sin(ang) * (ISLAND_GRASS_R + 0.5)
    );
    panel.rotation.y = -ang + Math.PI / 2;
    panel.name = `deco_cliff_seg_${i}`;
    panel.userData.decorOnly = true;
    panel.raycast = () => {};
    root.add(panel);
  }

  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_HALF * 2 + 0.8, 0.1, BUILDING_HALF * 2 + 0.8),
    new THREE.MeshLambertMaterial({ color: PALETTE.roofLight, flatShading: true })
  );
  skirt.position.y = 0.05;
  skirt.name = 'deco_stone_skirt';

  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.25, 1.2),
    new THREE.MeshLambertMaterial({ color: PALETTE.roofLight, flatShading: true })
  );
  dock.position.set(0, 0.12, ISLAND_GRASS_R - 1.1);
  dock.name = 'deco_dock';

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.windowDark })
  );
  lamp.position.set(1.1, 0.8, ISLAND_GRASS_R - 1.3);
  lamp.name = 'lamp_dock';
  lamp.visible = false;
  lamp.userData.decorOnly = true;
  lamp.raycast = () => {};

  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.9, 0.5),
    new THREE.MeshLambertMaterial({ color: PALETTE.brand })
  );
  flag.position.set(-5.5, 1.1, -5.5);
  const flagNames = { fire: 'unlock_flag_fire', building: 'unlock_flag_building' };
  flag.name = flagNames[islandId] || `unlock_flag_${islandId}`;
  flag.visible = false;
  flag.userData.decorOnly = true;
  flag.raycast = () => {};

  root.add(grass, skirt, dock, lamp, flag);
  return { root, grass, dock };
}
