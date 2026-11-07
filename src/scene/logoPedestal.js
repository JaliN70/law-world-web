import * as THREE from 'three';
import { WATER_BASE_Y, WATER_WAVE_AMP } from './waterSurface.js';

/** 頂點半徑 4 m（與 deco_logo_platform 六角一致，1:1 不縮放 GLB） */
const HEX_VERTEX_R = 4;

/**
 * 中央平台下方石座：略低於浪谷伸至 y=0，材質 clone 自 logo_platform。
 * @param {import('three').Mesh | null} platformMesh
 */
export function createLogoPedestal(platformMesh) {
  const bottomY = WATER_BASE_Y - WATER_WAVE_AMP - 0.02;
  const topY = 0;
  const height = topY - bottomY;

  const geo = new THREE.CylinderGeometry(HEX_VERTEX_R, HEX_VERTEX_R, height, 6);
  let mat;
  if (platformMesh?.material) {
    mat = platformMesh.material.clone();
  } else {
    mat = new THREE.MeshLambertMaterial({ color: 0xd1d5db });
  }

  const ped = new THREE.Mesh(geo, mat);
  ped.name = 'logo_platform_pedestal';
  ped.position.y = bottomY + height / 2;
  ped.userData.decorOnly = true;
  ped.raycast = () => {};
  ped.renderOrder = 0;
  return ped;
}
