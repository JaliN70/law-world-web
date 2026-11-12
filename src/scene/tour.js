import * as THREE from 'three';
import { islandZoomFor, groundOffsetForScreenUp } from './camera.js';
import { ISLAND_POSITIONS } from './layouts.js';

const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);

/**
 * 鏡頭導覽：只移動相機目標與 zoom，不切換 frustum，避免推近結束時畫面「跳一下」。
 */
export class TourDirector {
  constructor({ rig, camera, buildings, onBeat, reducedMotion }) {
    this.rig = rig;
    this.camera = camera;
    this.buildings = buildings;
    this.onBeat = onBeat;
    this.reducedMotion = reducedMotion;
    this.mode = 'idle';
    this.t = 0;
    this.view = 'overview';
    this.activeIsland = null;
  }

  islandCenter(id) {
    const [x, , z] = ISLAND_POSITIONS[id];
    return new THREE.Vector3(x, 0, z);
  }

  islandZoom(id) {
    return islandZoomFor(this.camera, id);
  }

  startFirstVisit() {
    this.rig.resetOverview();
    if (this.reducedMotion) {
      this.onBeat?.('labels-all');
      setTimeout(() => this.onBeat?.('tour-done'), 200);
      return;
    }
    // S1 降落：由高空（小 zoom）收到概覽；S2 依序點名六個標籤（每 0.3 s）
    this.mode = 's1';
    this.t = 0;
    this.rig.setZoom(this.rig.minZoom);
    this._labelIdx = 0;
  }

  startReturnVisit() {
    this.mode = 'idle';
    this.view = 'overview';
    this.activeIsland = null;
    this.rig.resetOverview();
    this.onBeat?.('labels-all');
  }

  update(dt) {
    if (this.mode !== 's1') return;
    this.t += dt;
    const k = Math.min(1, this.t / 1.2);
    this.rig.setZoom(THREE.MathUtils.lerp(this.rig.minZoom, this.rig.overviewZoom, easeOutCubic(k)));
    const n = Math.min(6, Math.floor((this.t - 0.6) / 0.3) + 1);
    if (n > this._labelIdx && n > 0) {
      this._labelIdx = n;
      this.onBeat?.('label', n);
    }
    if (this.t >= 0.6 + 6 * 0.3) {
      this.mode = 'idle';
      this.onBeat?.('tour-done');
    }
  }

  /** 回傳每幀呼叫的 tick；完成時回傳 null */
  _fly({ target, zoom, duration, onDone }) {
    const dur = this.reducedMotion ? 0.2 : duration;
    const startTarget = this.rig.target.clone();
    const startZoom = this.rig.zoom;
    const startYaw = this.rig.yaw;
    let elapsed = 0;
    const tick = (dt) => {
      elapsed += dt;
      const k = Math.min(1, elapsed / dur);
      const e = this.reducedMotion ? k : easeOutCubic(k);
      this.rig.target.lerpVectors(startTarget, target, e);
      // 縮放用對數插值，推近速度感比較均勻
      this.rig.setZoom(Math.exp(THREE.MathUtils.lerp(Math.log(startZoom), Math.log(zoom), e)));
      this.rig.setYaw(THREE.MathUtils.lerp(startYaw, 0, e));
      if (k >= 1) {
        onDone?.();
        return null;
      }
      return tick;
    };
    return tick;
  }

  flyToIsland(islandId, duration = 0.8, onDone) {
    this.view = 'island';
    this.activeIsland = islandId;
    return this._fly({
      target: this.islandCenter(islandId),
      zoom: this.islandZoom(islandId),
      duration,
      onDone,
    });
  }

  flyToOverview(duration = 0.8, onDone) {
    return this._fly({
      target: new THREE.Vector3(),
      zoom: this.rig.overviewZoom,
      duration,
      onDone: () => {
        this.view = 'overview';
        this.activeIsland = null;
        onDone?.();
      },
    });
  }

  /** S4：鏡頭停在建築前（島中心）並略再推近，讓卡片升起時建築仍在上半部 */
  focusBuilding(building, onDone, { cardLift = 0.18 } = {}) {
    const id = building.userData?.areaId;
    if (!id) {
      onDone?.();
      return null;
    }
    const zoom = this.islandZoom(id) * 1.1;
    return this._fly({
      target: this.islandCenter(id).add(groundOffsetForScreenUp(this.camera, zoom, cardLift)),
      zoom,
      duration: 0.45,
      onDone,
    });
  }
}
