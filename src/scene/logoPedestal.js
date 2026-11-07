import * as THREE from 'three';
import { WATER_BASE_Y, WATER_WAVE_AMP } from './waterSurface.js';

/** 頂點半徑 4 m（與 deco_logo_platform 六角一致，1:1 不縮放 GLB） */
const HEX_VERTEX_R = 4;

/** Three.js 六稜柱預設 +Z 頂點 → 對齊 CD 平台 ±X 頂點 */
const PEDESTAL_YAW = Math.PI / 6;

function resolvePedestalRotation(platformMesh) {
  if (!platformMesh?.geometry) return PEDESTAL_YAW;
  platformMesh.geometry.computeBoundingBox();
  const bb = platformMesh.geometry.boundingBox;
  if (!bb) return PEDESTAL_YAW;
  const spanX = bb.max.x - bb.min.x;
  const spanZ = bb.max.z - bb.min.z;
  return spanX >= spanZ ? PEDESTAL_YAW : 0;
}

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
  // CylinderGeometry 預設 θ=0 頂點在 +Z（bbox Z=8 m）；deco_logo_platform 頂點朝 ±X（bbox X=8 m）→ 旋 30°
  ped.rotation.y = resolvePedestalRotation(platformMesh);
  ped.position.y = bottomY + height / 2;
  ped.userData.decorOnly = true;
  ped.raycast = () => {};
  ped.renderOrder = 0;
  return ped;
}
