import * as THREE from 'three';
import { AREA_ORDER } from '../data/areas.js';
import { toScreenPlane } from './layout.js';

const ease = {
  out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  linear: (k) => k,
};

/**
 * 鏡頭分鏡（藍圖 §3）：
 *   S1 進場降落 1.6 s → S2 輕巡點名 2.4 s → S3 概覽待命
 *   S4 點選推近 0.6 s（不重載、不重繪場景）→ S5 切換鄰棟 0.5 s → S6 返回概覽 0.5 s
 * 減少動態時一律改 0.2 s。
 */
export class Director {
  constructor(world) {
    this.world = world;
    this.iso = world.iso;
    this.reduced = false;
    this.tw = null;
    this.focused = null;
  }

  /** 單一補間；新的會取代舊的 */
  tween(dur, fn, curve = ease.out) {
    if (this.tw) this.tw.resolve(false);
    if (this.reduced) dur = Math.min(dur, 0.2);
    return new Promise((resolve) => {
      this.tw = { t: 0, dur, fn, curve, resolve };
      if (dur <= 0) {
        fn(1);
        this.tw = null;
        resolve(true);
      }
    });
  }

  update(dt) {
    const tw = this.tw;
    if (!tw) return false;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.curve(k));
    if (k >= 1) {
      this.tw = null;
      tw.resolve(true);
    }
    return true;
  }

  /** S1＋S2（首次）；onLabel(i) 每 0.3 s 點亮一個標籤 */
  async intro(onLabel) {
    const iso = this.iso;
    if (this.reduced) {
      AREA_ORDER.forEach((_, i) => onLabel(i));
      return;
    }
    iso.target.set(0, 0, 0);
    iso.yaw = 0;
    await this.tween(1.6, (k) => iso.setZoom(0.45 + 0.55 * k), ease.out);
    const lifted = [];
    let next = 0;
    await this.tween(
      2.4,
      (k) => {
        // 方位角 −15° → +15° → 0°
        iso.yaw = k < 0.4 ? -15 * (k / 0.4) : k < 0.8 ? -15 + 30 * ((k - 0.4) / 0.4) : 15 * (1 - (k - 0.8) / 0.2);
        const due = Math.min(6, Math.floor((k * 2.4) / 0.3) + 1);
        while (next < due) {
          onLabel(next);
          const id = AREA_ORDER[next];
          this.world.effects.lift(id, true);
          lifted.push(id);
          next += 1;
        }
      },
      ease.linear
    );
    lifted.forEach((id) => this.world.effects.lift(id, false));
    iso.yaw = 0;
  }

  /** S4／S5：推近到建築，建築落在卡片上方 */
  focus(id, { switching = false, card = { top: 0.6, left: 0 } } = {}) {
    const b = this.world.buildings[id];
    const iso = this.iso;
    const zoom = 1.9;
    // 建築放在卡片沒蓋到的地方：卡片在右側（桌機）→ 放左半；卡片在下方（手機）→ 放上半
    const p = b.center.clone().setY(b.top * 0.45);
    const side = card.left > 0.4;
    const screenX = side ? card.left / 2 : 0.5;
    const screenY = side ? 0.5 : Math.max(0.28, card.top * 0.52);
    const to = iso.targetFor(p, zoom, screenY, screenX);
    // 方位角最多偏 ±10°，讓側邊建築正面更朝鏡頭
    const [r] = toScreenPlane(b.center.x, b.center.z);
    const yawTo = THREE.MathUtils.clamp((-r / (this.world.preset.island.hr || 1)) * 10, -10, 10);
    const from = { t: iso.target.clone(), z: iso.zoom, y: iso.yaw };
    this.focused = id;
    return this.tween(switching ? 0.5 : 0.6, (k) => {
      iso.target.lerpVectors(from.t, to, k);
      iso.setZoom(from.z + (zoom - from.z) * k);
      iso.yaw = from.y + (yawTo - from.y) * k;
    });
  }

  /** S6：回概覽 */
  overview(dur = 0.5) {
    const iso = this.iso;
    const from = { t: iso.target.clone(), z: iso.zoom, y: iso.yaw };
    this.focused = null;
    return this.tween(dur, (k) => {
      iso.target.lerpVectors(from.t, new THREE.Vector3(), k);
      iso.setZoom(from.z + (1 - from.z) * k);
      iso.yaw = from.y * (1 - k);
    });
  }

  /** 場景任務：把整棟建築放在上半部（下方留給任務提示列） */
  frame(id, zoom = 1.7) {
    const b = this.world.buildings[id];
    const iso = this.iso;
    const to = iso.targetFor(b.center.clone().setY(b.top * 0.4), zoom, 0.42);
    const from = { t: iso.target.clone(), z: iso.zoom, y: iso.yaw };
    this.focused = id;
    return this.tween(0.6, (k) => {
      iso.target.lerpVectors(from.t, to, k);
      iso.setZoom(from.z + (zoom - from.z) * k);
      iso.yaw = from.y * (1 - k);
    });
  }
}
