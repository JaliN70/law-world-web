import * as THREE from 'three';
import { PALETTE } from '../palette.js';

/** 碼頭與解鎖用的小零件（不含地形；地形為 deco_island_12m GLB） */
export function attachIslandExtras(islandId) {
  const root = new THREE.Group();
  root.name = `island_extras_${islandId}`;

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.windowDark })
  );
  lamp.position.set(1.1, 0.8, 11.4);
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

  root.add(lamp, flag);
  return root;
}
