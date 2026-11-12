import * as THREE from 'three';
import { PALETTE } from '../palette.js';

const TARGET_INTENSITY = 0.14;
const INLAY_INTENSITY = 0.35;
const FADE_DURATION = 0.65;

/**
 * 法規通完成態：六島岸壁（park_cliffs 一份材質）與 logo_inlay 柔和發光。
 * 只改既有材質的 emissiveIntensity，不再每幀 clone 材質。
 */
let state = { target: 0, value: 0, fadeFrom: 0, t: 1 };
let mats = { cliff: null, inlay: null };

export function bindGlowMaterials({ cliff, inlay } = {}) {
  mats = { cliff, inlay };
  if (cliff) cliff.emissive = new THREE.Color(PALETTE.brand);
  apply(state.value);
}

function apply(k) {
  if (mats.cliff) mats.cliff.emissiveIntensity = TARGET_INTENSITY * k;
  if (mats.inlay) mats.inlay.emissiveIntensity = INLAY_INTENSITY * k;
}

export function setLawPassGlow(enabled, { reducedMotion = false } = {}) {
  const target = enabled ? 1 : 0;
  if (state.target === target) return;
  state = { target, value: state.value, fadeFrom: state.value, t: reducedMotion ? 1 : 0 };
  if (reducedMotion) {
    state.value = target;
    apply(target);
  }
}

export function updateLawPassGlow(dt) {
  if (state.t >= 1) return;
  state.t = Math.min(1, state.t + dt / FADE_DURATION);
  const e = state.t * (2 - state.t);
  state.value = state.fadeFrom + (state.target - state.fadeFrom) * e;
  apply(state.value);
}
