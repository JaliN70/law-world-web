import * as THREE from 'three';
import { PALETTE } from '../palette.js';

/** 法規通：僅 logo_inlay 材質柔和 emissive（須先 clone） */
export function applyLogoInlayGlow(inlayMesh, on) {
  if (!inlayMesh?.material) return;
  if (!inlayMesh.userData.baseMat) inlayMesh.userData.baseMat = inlayMesh.material;
  if (on) {
    const m = inlayMesh.material.clone();
    m.emissive = new THREE.Color(PALETTE.logoRed);
    m.emissiveIntensity = 0.12;
    inlayMesh.material = m;
  } else {
    inlayMesh.material = inlayMesh.userData.baseMat;
  }
}
