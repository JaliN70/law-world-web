import * as THREE from 'three';
import {
  ISLAND_ORDER,
  ISLAND_POSITIONS,
  ISLAND_GRASS_R,
  ISLAND_CLIFF_BOTTOM,
  BUILDING_TOP,
} from './layouts.js';

const ELEV = (35 * Math.PI) / 180;
/** 等角方向：方位 45°、俯角 35° */
const DIR = new THREE.Vector3(1, Math.tan(ELEV), 1).normalize();
/**
 * 正交相機離目標的固定距離。舊版 80 m 在手機直式（視野高）時，畫面下緣的視線
 * 起點會落到水面以下而被近裁切面切掉，下方露出背景色；拉遠到 240 m 即可。
 * 正交投影不受距離影響，縮放只改 camera.zoom。
 */
export const CAM_DIST = 240;
const UP = new THREE.Vector3(0, 1, 0);

export function createIsoCamera(width, height) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, CAM_DIST + 400);
  camera.userData.viewAspect = width / height;
  camera.position.copy(DIR).multiplyScalar(CAM_DIST);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** 相機在 yaw=0 時的畫面右／上單位向量（世界座標） */
function screenAxes() {
  const fwd = DIR.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  return { right, up };
}

/**
 * 以島的外圈（含岸壁底、建築頂）投影到畫面座標，求出需要的半寬／半高。
 * 回傳以 center 為中心的對稱範圍，單位與正交 frustum 相同。
 */
function projectedExtent(ids, center) {
  const { right, up } = screenAxes();
  let hx = 0;
  let hy = 0;
  const p = new THREE.Vector3();
  for (const id of ids) {
    const [cx, , cz] = ISLAND_POSITIONS[id];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const y of [ISLAND_CLIFF_BOTTOM, 0]) {
        p.set(cx + Math.cos(a) * ISLAND_GRASS_R - center.x, y, cz + Math.sin(a) * ISLAND_GRASS_R - center.z);
        hx = Math.max(hx, Math.abs(p.dot(right)));
        hy = Math.max(hy, Math.abs(p.dot(up)));
      }
    }
    // 建築頂＋標籤（約 4 m）
    p.set(cx - center.x, BUILDING_TOP + 4, cz - center.z);
    hx = Math.max(hx, Math.abs(p.dot(right)));
    hy = Math.max(hy, Math.abs(p.dot(up)));
  }
  return { hx, hy };
}

/**
 * 依目前布局把整個群島放進畫面。
 * reserve：上（標題列＋小地圖）／下（拇指區）被 UI 蓋住的像素，避免模型被遮。
 */
export function fitOverview(camera, width, height, { margin = 1.06, reserveTop = 0, reserveBottom = 0 } = {}) {
  const aspect = width / height;
  const { hx, hy } = projectedExtent(ISLAND_ORDER, new THREE.Vector3());
  const usable = Math.max(0.4, (height - reserveTop - reserveBottom) / height);
  const frustumY = Math.max((2 * hy) / usable, (2 * hx) / aspect) * margin;
  camera.left = (-frustumY * aspect) / 2;
  camera.right = (frustumY * aspect) / 2;
  camera.top = frustumY / 2;
  camera.bottom = -frustumY / 2;
  camera.userData.viewAspect = aspect;
  camera.userData.baseFrustumY = frustumY;
  // 被 UI 擋住的上下高度不對稱時，把畫面中心往下（或上）挪，讓群島置中於可見區
  camera.userData.screenShiftY = ((reserveTop - reserveBottom) / 2 / height) * frustumY;
  camera.updateProjectionMatrix();
  return frustumY;
}

/** 單島視圖需要的縮放倍率（相對總覽 frustum） */
export function islandZoomFor(camera, id, margin = 1.12) {
  const [cx, , cz] = ISLAND_POSITIONS[id];
  const { hx, hy } = projectedExtent([id], new THREE.Vector3(cx, 0, cz));
  const base = camera.userData.baseFrustumY || 100;
  const aspect = camera.userData.viewAspect || 1;
  const need = Math.max(2 * hy, (2 * hx) / aspect) * margin;
  return base / need;
}

/**
 * 畫面往上移 frac（佔可視高度比例）時，相機目標在地面上要往鏡頭方向移多少。
 * 用來在確認卡片升起時讓建築留在卡片上方。
 */
export function groundOffsetForScreenUp(camera, zoom, frac) {
  const { up } = screenAxes();
  const ground = new THREE.Vector3(up.x, 0, up.z).normalize();
  const d = (frac * (camera.userData.baseFrustumY || 100)) / zoom / Math.sin(ELEV);
  return ground.multiplyScalar(-d);
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.zoom = 1;
    this.minZoom = 0.8;
    this.maxZoom = 4;
    this.panLimit = 40;
    this.overviewZoom = 1;
    this._base = new THREE.Vector3();
    this._shift = new THREE.Vector3();
  }

  setPanBounds(limit) {
    this.panLimit = limit;
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

  pan(dx, dy, viewportH) {
    // 螢幕拖曳像素 → 地面位移（右／上兩軸換算成世界 XZ）
    const frustumY = this.camera.userData.baseFrustumY || 100;
    const k = frustumY / this.zoom / (viewportH || 800);
    const { right, up } = screenAxes();
    const groundUp = new THREE.Vector3(up.x, 0, up.z).normalize().multiplyScalar(1 / Math.sin(ELEV));
    this.target.addScaledVector(right, -dx * k);
    this.target.addScaledVector(groundUp, dy * k);
    this.target.y = 0;
    const len = Math.hypot(this.target.x, this.target.z);
    if (len > this.panLimit) this.target.multiplyScalar(this.panLimit / len);
  }

  resetOverview() {
    this.target.set(0, 0, 0);
    this.setYaw(0);
    this.setZoom(this.overviewZoom);
  }

  update() {
    const yawRad = (this.yaw * Math.PI) / 180;
    this._base.copy(DIR).applyAxisAngle(UP, yawRad);
    // UI 遮擋補償：沿畫面上方向平移（只在總覽縮放時完整生效）
    const shift = (this.camera.userData.screenShiftY || 0) / this.zoom;
    const { up } = screenAxes();
    this._shift.copy(up).applyAxisAngle(UP, yawRad).multiplyScalar(shift);
    this.camera.position.copy(this._base).multiplyScalar(CAM_DIST).add(this.target).add(this._shift);
    this.camera.lookAt(this._shift.add(this.target));
  }

  worldToScreen(point, width, height, out = {}) {
    const v = point.clone().project(this.camera);
    out.x = ((v.x + 1) / 2) * width;
    out.y = ((-v.y + 1) / 2) * height;
    out.behind = v.z > 1;
    return out;
  }
}
