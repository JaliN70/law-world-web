import * as THREE from 'three';

const ELEV = (35 * Math.PI) / 180;
const DIR = new THREE.Vector3(1, Math.tan(ELEV), 1).normalize();

export function createIsoCamera(width, height) {
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  camera.userData.viewAspect = aspect;
  camera.position.copy(DIR.clone().multiplyScalar(80));
  camera.lookAt(0, 0, 0);
  camera.zoom = 1;
  return camera;
}

/**
 * 依場景水平跨度 + 視窗比例推算正交 half-extent，避免手機裁切建築。
 */
export function fitFrustumToBounds(camera, width, height, bounds, isMobile) {
  const aspect = width / height;
  camera.userData.viewAspect = aspect;

  const pad = isMobile ? 1.32 : 1.16;
  const cliffPad = 2.8;
  const halfX = bounds.spanX / 2 + cliffPad;
  const halfZ = bounds.spanZ / 2 + cliffPad;
  const islandHalf = bounds.islandRadius + cliffPad;

  const needY = Math.max(halfX, halfZ, islandHalf) * pad;
  const frustumY = Math.max(needY, needY / aspect);

  camera.left = (-frustumY * aspect) / 2;
  camera.right = (frustumY * aspect) / 2;
  camera.top = frustumY / 2;
  camera.bottom = -frustumY / 2;
  camera.userData.baseFrustumY = frustumY;
  camera.updateProjectionMatrix();
}

export function resizeCamera(camera, width, height, bounds, isMobile) {
  if (bounds) fitFrustumToBounds(camera, width, height, bounds, isMobile);
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.zoom = 1;
    this.minZoom = 0.8;
    this.maxZoom = 2.2;
    this.bounds = 22;
    this.overviewZoom = 1;
  }

  setPanBounds(islandRadius) {
    this.bounds = islandRadius * 0.55;
  }

  setYaw(deg, reduced) {
    const max = reduced ? 0 : 15;
    this.yaw = THREE.MathUtils.clamp(deg, -max, max);
  }

  setZoom(z) {
    this.zoom = THREE.MathUtils.clamp(z, this.minZoom, this.maxZoom);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  pan(dx, dz) {
    const scale = 0.045 / this.zoom;
    this.target.x = THREE.MathUtils.clamp(this.target.x - dx * scale, -this.bounds, this.bounds);
    this.target.z = THREE.MathUtils.clamp(this.target.z - dz * scale, -this.bounds, this.bounds);
  }

  focusBuilding(building, focusYaw = 8) {
    const p = building.position;
    this.target.set(p.x * 0.55, 0, p.z * 0.55);
    this.setYaw(focusYaw);
    this.setZoom(1.85);
  }

  resetOverview() {
    this.target.set(0, 0, 0);
    this.setYaw(0);
    this.setZoom(this.overviewZoom);
  }

  update() {
    const yawRad = (this.yaw * Math.PI) / 180;
    const base = DIR.clone();
    base.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
    const dist = 80 / this.zoom;
    this.camera.position.copy(base.multiplyScalar(dist)).add(this.target);
    this.camera.lookAt(this.target);
  }

  worldToScreen(point, width, height) {
    this.update();
    const v = point.clone().project(this.camera);
    return {
      x: ((v.x + 1) / 2) * width,
      y: ((-v.y + 1) / 2) * height,
      behind: v.z > 1,
    };
  }
}
