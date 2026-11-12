import * as THREE from 'three';

/** 草地頂面 Y=0、碼頭約 +0.012 m；浪幅 ±0.03 m。基準下移露出 island_cliff 土褐／岩壁層。 */
export const WATER_WAVE_AMP = 0.03;
/** 浪峰約 -0.67 m（低於草地與碼頭） */
export const WATER_BASE_Y = -0.7;

/**
 * 程式海面（±wave / 約 6 s 週期）。
 * 波形在 vertex shader 計算，flatShading 由片段導數求面法線：
 * 不再每幀在 CPU 改 2,401 個頂點並重算法線、重新上傳緩衝。
 * 平面放大到 900 m，手機直式視野也鋪得滿。
 */
export function createWaterSurface({ reducedMotion } = {}) {
  const geo = new THREE.PlaneGeometry(900, 900, 64, 64);
  geo.rotateX(-Math.PI / 2);
  const uniforms = { uTime: { value: 0 }, uAmp: { value: reducedMotion ? 0 : WATER_WAVE_AMP } };
  const mat = new THREE.MeshLambertMaterial({ color: 0x9fd4f5, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\nuniform float uAmp;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  float wPhase = uTime * 1.0471976; // 2π / 6 s
  transformed.y += sin(position.x * 0.08 + wPhase) * cos(position.z * 0.07 + wPhase * 0.9) * uAmp;`
      );
  };
  mat.customProgramCacheKey = () => 'park_water_wave';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water_surface';
  mesh.position.y = WATER_BASE_Y;
  mesh.renderOrder = -1;
  mesh.userData.decorOnly = true;
  mesh.userData.uniforms = uniforms;
  mesh.raycast = () => {};
  return mesh;
}

export function updateWaterSurface(mesh, t) {
  const u = mesh?.userData.uniforms;
  if (u) u.uTime.value = t;
}

export function setWaterMotion(mesh, enabled) {
  const u = mesh?.userData.uniforms;
  if (u) u.uAmp.value = enabled ? WATER_WAVE_AMP : 0;
}
