import * as THREE from 'three';

/**
 * 固定等角正交相機（藍圖 §3）：俯角 35°、方位 45°，不開自由旋轉。
 * 只有巡禮與推近時能微調方位角（±15°）；拖曳平移與縮放都有邊界。
 */
const ELEV = THREE.MathUtils.degToRad(35);
const AZIM = THREE.MathUtils.degToRad(45);
const DIST = 200; // 正交投影不受距離影響；拉遠避免近裁切面切到島底
const UP = new THREE.Vector3(0, 1, 0);

const DIR = new THREE.Vector3(Math.sin(AZIM) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(AZIM) * Math.cos(ELEV));

export class IsoCamera {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DIST * 2.5);
    this.target = new THREE.Vector3();
    this.yaw = 0; // 度
    this.zoom = 1;
    this.minZoom = 0.8;
    this.maxZoom = 2.2;
    this.frustumH = 60;
    this.aspect = 1;
    this.shiftY = 0; // UI 遮擋補償（畫面單位）
    this.panLimit = { r: 20, u: 20 };
    this._dir = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  /** 以「畫面右／上」兩軸量測一組世界點，回傳需要的半寬、半高與中心 */
  static extent(points, yawDeg = 0) {
    const dir = DIR.clone().applyAxisAngle(UP, THREE.MathUtils.degToRad(yawDeg));
    const right = new THREE.Vector3().crossVectors(dir.clone().negate(), UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir.clone().negate()).normalize();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      const x = p.dot(right);
      const y = p.dot(up);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  /**
   * 讓一組世界點完整落在可見區：margin 為四周安全邊距比例（藍圖：島體四周留 12%）；
   * reserveTop／reserveBottom 為被 UI 蓋住的像素。
   */
  fit(points, width, height, { margin = 0.12, reserveTop = 0, reserveBottom = 0 } = {}) {
    this.aspect = width / height;
    const e = IsoCamera.extent(points);
    const visH = Math.max(0.3, (height - reserveTop - reserveBottom) / height);
    const k = 1 + margin;
    this.frustumH = Math.max((e.h * k) / visH, (e.w * k) / this.aspect);
    // 讓內容中心落在可見區中心
    const visCenterPx = (reserveTop - reserveBottom) / 2;
    this.shiftY = e.cy + (visCenterPx / height) * this.frustumH;
    this.shiftX = e.cx;
    this.applyProjection();
  }

  applyProjection() {
    const h = this.frustumH / 2;
    const w = h * this.aspect;
    Object.assign(this.camera, { left: -w, right: w, top: h, bottom: -h, zoom: this.zoom });
    this.camera.updateProjectionMatrix();
  }

  setZoom(z) {
    this.zoom = THREE.MathUtils.clamp(z, this.minZoom * 0.6, this.maxZoom * 1.15);
    this.applyProjection();
  }

  axes() {
    this._dir.copy(DIR).applyAxisAngle(UP, THREE.MathUtils.degToRad(this.yaw));
    const back = this._dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(back, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, back).normalize();
    return { dir: this._dir, right, up };
  }

  /** 每幀：視線中心 = target ＋ 畫面偏移（讓群島置中於未被 UI 遮住的區域） */
  update() {
    const { dir, right, up } = this.axes();
    const look = this.target.clone().addScaledVector(right, this.shiftX || 0).addScaledVector(up, this.shiftY);
    this.camera.position.copy(look).addScaledVector(dir, DIST);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
  }

  /** 畫面拖曳像素 → 沿地面移動 target（含邊界） */
  panBy(dxPx, dyPx, heightPx) {
    const unit = this.frustumH / this.zoom / heightPx;
    const right = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
    const groundUp = new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2);
    this.target.addScaledVector(right, -dxPx * unit);
    this.target.addScaledVector(groundUp, (dyPx * unit) / Math.sin(ELEV));
  }

  /** 目前 target 超出邊界多少（畫面對齊的 r／u） */
  overshoot() {
    const r = (this.target.x - this.target.z) * Math.SQRT1_2;
    const u = (-this.target.x - this.target.z) * Math.SQRT1_2;
    const lr = this.panLimit.r / this.zoom ** 0.5;
    const lu = this.panLimit.u / this.zoom ** 0.5;
    return { r: r - THREE.MathUtils.clamp(r, -lr, lr), u: u - THREE.MathUtils.clamp(u, -lu, lu) };
  }

  /** 邊界回彈：每幀把超出的部分拉回 */
  relax(dt) {
    const o = this.overshoot();
    if (!o.r && !o.u) return false;
    const k = 1 - Math.exp(-dt * 12);
    const dr = -o.r * k;
    const du = -o.u * k;
    this.target.x += (dr - du) * Math.SQRT1_2;
    this.target.z += (-dr - du) * Math.SQRT1_2;
    return true;
  }

  project(world, width, height, out = {}) {
    const v = this._v.copy(world).project(this.camera);
    out.x = ((v.x + 1) / 2) * width;
    out.y = ((1 - v.y) / 2) * height;
    out.visible = v.z > -1 && v.z < 1;
    return out;
  }

  /** 讓世界點 point 出現在畫面水平中央、垂直位置 screenY（0＝頂、1＝底）時，target 應在哪 */
  targetFor(point, zoom, screenY = 0.5, screenX = 0.5) {
    const { right, up } = this.axes();
    const dy = (0.5 - screenY) * (this.frustumH / zoom);
    const dx = (screenX - 0.5) * ((this.frustumH * this.aspect) / zoom);
    const look = point.clone().addScaledVector(up, -dy).addScaledVector(right, -dx);
    return look.addScaledVector(right, -(this.shiftX || 0)).addScaledVector(up, -this.shiftY);
  }
}
