import * as THREE from 'three';

/** 草地頂面 Y=0；浪幅 ±0.03 m。基準下移使浪峰始終低於島面／碼頭。 */
export const WATER_WAVE_AMP = 0.03;
export const WATER_BASE_Y = -(WATER_WAVE_AMP + 0.03);

/** 單片程式海面（±wave / ~6s） */
export function createWaterSurface({ reducedMotion } = {}) {
  const geo = new THREE.PlaneGeometry(280, 280, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0x9fd4f5,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water_surface';
  mesh.position.y = WATER_BASE_Y;
  mesh.renderOrder = -1;
  mesh.userData.decorOnly = true;
  mesh.raycast = () => {};
  mesh.userData.wavePhase = 0;
  mesh.userData.reducedMotion = reducedMotion;
  return mesh;
}

export function updateWaterSurface(mesh, t) {
  if (!mesh?.geometry || mesh.userData.reducedMotion) return;
  const pos = mesh.geometry.attributes.position;
  const phase = t * ((Math.PI * 2) / 6);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const w =
      Math.sin(x * 0.08 + phase) * Math.cos(z * 0.07 + phase * 0.9) * WATER_WAVE_AMP;
    pos.setY(i, w);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}
