import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { baseUrl } from './glbLoader.js';

/** v1.2：半徑 4 m、臺高 0.35 m，頂面平貼 logo_inlay */
export function createLogoPlatform() {
  const g = new THREE.Group();
  g.name = 'logo_platform_root';

  const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofLight, flatShading: true });
  const topY = 0.35;
  const sideH = 0.3;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.05, sideH, 6), stoneMat);
  body.position.y = topY - sideH / 2;
  body.name = 'logo_platform';

  const loader = new THREE.TextureLoader();
  const tex = loader.load(baseUrl('assets/tysic-logo.svg'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const inlayMat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const inlay = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.55, 0.01, 6), inlayMat);
  inlay.rotation.y = Math.PI / 6;
  inlay.position.y = topY + 0.002;
  inlay.name = 'logo_inlay';
  inlay.userData.decorOnly = true;
  inlay.raycast = () => {};

  g.add(body, inlay);
  g.userData.nonInteractive = true;
  return g;
}

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
