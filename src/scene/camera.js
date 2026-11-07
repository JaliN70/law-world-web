import * as THREE from 'three';

const ELEV = (35 * Math.PI) / 180;
const DIR = new THREE.Vector3(1, Math.tan(ELEV), 1).normalize();

export function createIsoCamera(width, height) {
  const aspect = width / height;
  const frustum = 42;
  const camera = new THREE.OrthographicCamera(
    (-frustum * aspect) / 2,
    (frustum * aspect) / 2,
    frustum / 2,
    -frustum / 2,
    0.1,
    300
  );
  camera.position.copy(DIR.clone().multiplyScalar(80));
  camera.lookAt(0, 0, 0);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  return camera;
}

export function resizeCamera(camera, width, height) {
  const aspect = width / height;
  const frustum = 42;
  camera.left = (-frustum * aspect) / 2;
  camera.right = (frustum * aspect) / 2;
  camera.top = frustum / 2;
  camera.bottom = -frustum / 2;
  camera.updateProjectionMatrix();
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.zoom = 1;
    this.minZoom = 0.8;
    this.maxZoom = 2.2;
    this.bounds = 28;
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
    this.setZoom(1.9);
  }

  resetOverview() {
    this.target.set(0, 0, 0);
    this.setYaw(0);
    this.setZoom(1);
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
    const v = point.clone().project(this.camera);
    return {
      x: ((v.x + 1) / 2) * width,
      y: ((-v.y + 1) / 2) * height,
      behind: v.z > 1,
    };
  }
}
