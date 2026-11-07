import * as THREE from 'three';
import { PALETTE } from '../palette.js';

const TARGET_INTENSITY = 0.14;
const FADE_DURATION = 0.65;

/** @type {import('three').Mesh[]} */
let cliffMeshes = [];
let fading = false;
let fadeElapsed = 0;
let steady = false;

function collectCliffs(scene) {
  cliffMeshes = [];
  scene.traverse((o) => {
    if (o.isMesh && o.name === 'island_cliff') cliffMeshes.push(o);
  });
}

function applyCliffIntensity(mesh, intensity) {
  if (!mesh.material) return;
  if (!mesh.userData.shoreBaseMat) mesh.userData.shoreBaseMat = mesh.material;
  const m = mesh.userData.shoreBaseMat.clone();
  m.emissive = new THREE.Color(PALETTE.brand);
  m.emissiveIntensity = intensity;
  mesh.material = m;
}

function clearCliffGlow() {
  cliffMeshes.forEach((mesh) => {
    if (mesh.userData.shoreBaseMat) mesh.material = mesh.userData.shoreBaseMat;
  });
  cliffMeshes = [];
  fading = false;
  fadeElapsed = 0;
  steady = false;
}

/** 法規通：六島 island_cliff 穩定微光（材質 clone，不影響草地／建築） */
export function syncShorelineGlow(scene, enabled, { reducedMotion = false } = {}) {
  if (!enabled) {
    clearCliffGlow();
    return;
  }
  if (steady) return;

  collectCliffs(scene);
  if (cliffMeshes.length === 0) return;

  if (reducedMotion) {
    fading = false;
    cliffMeshes.forEach((m) => applyCliffIntensity(m, TARGET_INTENSITY));
    steady = true;
    return;
  }

  if (!fading) {
    fading = true;
    fadeElapsed = 0;
    cliffMeshes.forEach((m) => applyCliffIntensity(m, 0));
  }
}

export function updateShorelineGlowFade(dt) {
  if (!fading) return;
  fadeElapsed += dt;
  const t = Math.min(1, fadeElapsed / FADE_DURATION);
  const eased = t * (2 - t);
  const intensity = TARGET_INTENSITY * eased;
  cliffMeshes.forEach((m) => applyCliffIntensity(m, intensity));
  if (t >= 1) {
    fading = false;
    steady = true;
  }
}

/** GLB 晚於解鎖載入時再套一次 */
export function refreshShorelineGlowIfNeeded(scene, enabled, opts) {
  if (!enabled || steady) return;
  syncShorelineGlow(scene, true, opts);
}

/** 場景重建時清除快取狀態 */
export function resetShorelineGlow() {
  clearCliffGlow();
}
