import * as THREE from 'three';

/**
 * 解鎖裝飾與小動畫（藍圖 §4.4、§4.5）。任務只解鎖這些裝飾，不影響任何內容。
 * reduced＝減少動態：動畫停在最終狀態、不脈動、不上浮。
 */
export class Effects {
  constructor(world) {
    this.world = world;
    this.unlocked = new Set();
    this.reduced = false;
    this.anims = []; // 一次性動畫 { t, dur, fn }
    this.night = false;
  }

  /** 布局重建後重新抓節點並套用目前解鎖狀態 */
  bind() {
    const B = this.world.buildings;
    const part = (id, name) => B[id]?.parts[name];
    this.n = {
      hydrant: part('fire', 'fire_hydrant'),
      smoke: part('fire', 'unlock_fire_smoke'),
      truck: part('fire', 'unlock_fire_truck'),
      compass: part('building', 'building_compass'),
      grille: part('building', 'unlock_building_grille'),
      rings: part('telecom', 'telecom_rings'),
      ringA: part('telecom', 'telecom_ring_a'),
      ringB: part('telecom', 'telecom_ring_b'),
      tWindows: part('telecom', 'telecom_windows'),
      dish: part('telecom', 'unlock_telecom_dish'),
      tactile: part('accessibility', 'access_tactile'),
      doorL: part('accessibility', 'access_door_l'),
      doorR: part('accessibility', 'access_door_r'),
      gauge: part('water', 'water_tank_gauge'),
      flow: part('water', 'unlock_water_flow'),
      bubbles: part('water', 'unlock_water_bubbles'),
      eyeL: part('electrical', 'electrical_eye_l'),
      eyeR: part('electrical', 'electrical_eye_r'),
      insulators: part('electrical', 'electrical_insulators'),
      charger: part('electrical', 'unlock_ev_charger'),
      logo: this.world.props.plaza.getObjectByName('plaza_logo'),
      ...this.world.props,
    };
    const hide = ['smoke', 'truck', 'grille', 'dish', 'flow', 'bubbles', 'charger'];
    hide.forEach((k) => this.n[k] && (this.n[k].visible = false));
    if (this.n.gauge) this.n.gauge.scale.y = 0.08;
    this.base = {
      doorLx: this.n.doorL?.position.x,
      doorRx: this.n.doorR?.position.x,
      truckZ: this.n.truck?.position.z,
      flowX: this.n.flow?.position.x ?? 0,
    };
    const keys = [...this.unlocked];
    this.unlocked.clear();
    keys.forEach((k) => this.unlock(k, { animate: false }));
  }

  glow(obj, intensity) {
    obj?.traverse((o) => {
      if (o.isMesh && o.material.emissiveMap) o.material.emissiveIntensity = intensity;
    });
  }

  /** 一次性補間；reduced 時直接到終點 */
  play(dur, fn) {
    if (this.reduced || dur <= 0) {
      fn(1);
      return;
    }
    fn(0);
    this.anims.push({ t: 0, dur, fn });
  }

  pop(obj) {
    this.play(0.35, (k) => obj.scale.setScalar(0.2 + 0.8 * (1 - (1 - k) ** 3)));
  }

  unlock(key, { animate = true } = {}) {
    if (this.unlocked.has(key)) return;
    this.unlocked.add(key);
    const n = this.n;
    const d = animate ? 1 : 0;
    switch (key) {
      case 'fire_hydrant':
        break; // 每幀處理亮燈呼吸
      case 'fire_smoke':
        n.smoke.visible = true;
        break;
      case 'fire_truck':
        n.truck.visible = true;
        this.play(1.4 * d, (k) => (n.truck.position.z = this.base.truckZ - 2.2 + 2.2 * (1 - (1 - k) ** 2)));
        break;
      case 'building_compass':
        break;
      case 'building_grille':
        n.grille.visible = true;
        this.play(0.8 * d, (k) => this.glow(n.grille, 0.9 * k));
        break;
      case 'bridge_fire_building':
        n.bridge.visible = true;
        this.play(0.6 * d, (k) => n.bridge.scale.set(1, k, 1));
        break;
      case 'telecom_rings':
        break;
      case 'telecom_windows':
        this.play(0.8 * d, (k) => this.glow(n.tWindows, 0.85 * k));
        break;
      case 'telecom_dish':
        n.dish.visible = true;
        this.pop(n.dish);
        break;
      case 'access_tactile':
        break;
      case 'access_door':
        this.play(1.0 * d, (k) => {
          const e = 1 - (1 - k) ** 3;
          n.doorL.position.x = this.base.doorLx - 1.0 * e;
          n.doorR.position.x = this.base.doorRx + 1.0 * e;
        });
        break;
      case 'access_sign':
        n.sign.visible = true;
        this.pop(n.sign);
        break;
      case 'water_tank':
        this.play(1.6 * d, (k) => (n.gauge.scale.y = 0.08 + 0.92 * k));
        this.glow(n.gauge, 0.35);
        break;
      case 'water_flow':
        n.flow.visible = true;
        break;
      case 'water_bubbles':
        n.bubbles.visible = true;
        break;
      case 'electrical_face':
        break;
      case 'electrical_insulators':
        this.play(0.8 * d, (k) => this.glow(n.insulators, 0.9 * k));
        break;
      case 'ev_charger':
        n.charger.visible = true;
        this.pop(n.charger);
        break;
      case 'park_lamps':
        n.lamps.visible = true;
        n.lamps.children.forEach((l, i) => this.play((0.4 + i * 0.05) * d, (k) => l.scale.setScalar(Math.max(0.01, k))));
        break;
      case 'plaza_flags':
        n.flags.visible = true;
        n.flags.children.forEach((f) => this.pop(f));
        break;
      case 'law_pass':
        this.play(1.2 * d, (k) => this.glow(n.logo, 0.75 * k));
        break;
      default:
        break;
    }
  }

  setNight(on) {
    this.night = on;
    if (this.n?.lampHeadMat) this.n.lampHeadMat.emissiveIntensity = on ? 1.1 : 0.15;
    // 夜景：各棟窗戶微亮（已解鎖的點燈效果不受影響）
    if (this.n && !this.unlocked.has('telecom_windows')) this.glow(this.n.tWindows, on ? 0.5 : 0);
  }

  /** S2：建築輕微上浮 0.2 m（點名時） */
  lift(id, on) {
    const b = this.world.buildings[id];
    if (!b || this.reduced) return;
    const from = b.lift || 0;
    const to = on ? 0.2 : 0;
    this.anims.push({
      t: 0,
      dur: 0.3,
      fn: (k) => {
        b.lift = from + (to - from) * k;
        b.holder.position.y = b.lift;
      },
    });
  }

  update(dt, t) {
    // 一次性動畫
    for (const a of this.anims) {
      a.t += dt;
      a.fn(Math.min(1, a.t / a.dur));
    }
    this.anims = this.anims.filter((a) => a.t < a.dur);

    const n = this.n;
    if (!n) return;
    const u = this.unlocked;
    const moving = !this.reduced;
    const breathe = moving ? 0.5 + 0.5 * Math.sin(t * 2.2) : 1;

    if (u.has('fire_hydrant')) this.glow(n.hydrant, 0.25 + 0.45 * breathe);
    if (u.has('access_tactile')) this.glow(n.tactile, 0.3 + 0.5 * breathe);
    if (u.has('law_pass') && !this.anims.length) this.glow(n.logo, 0.45 + 0.3 * breathe);

    if (u.has('fire_smoke') && n.smoke) {
      n.smoke.children.forEach((p, i) => {
        const k = moving ? (t * 0.35 + i / 3) % 1 : i / 3;
        p.position.y = 11.2 + k * 3;
        p.scale.setScalar(0.6 + k * 0.9);
      });
    }
    if (u.has('building_compass') && n.compass && moving) n.compass.rotation.y = t * 0.6;
    if (u.has('telecom_rings') && n.ringA) {
      const s = moving ? 1 + 0.12 * Math.sin(t * 2.6) : 1;
      const s2 = moving ? 1 + 0.12 * Math.sin(t * 2.6 + 1.4) : 1;
      n.ringA.scale.set(s, s, s);
      n.ringB.scale.set(s2, s2, s2);
      this.glow(n.rings, 0.5 + 0.4 * breathe);
    }
    if (u.has('water_flow') && n.flow) n.flow.position.x = moving ? this.base.flowX + ((t * 1.2) % 1.2) - 0.6 : this.base.flowX;
    if (u.has('water_bubbles') && n.bubbles) {
      n.bubbles.children.forEach((b, i) => {
        const k = moving ? (t * 0.5 + i / 4) % 1 : i / 4;
        b.position.y = 2.0 + k * 1.8;
        b.scale.setScalar(k < 0.9 ? 1 : (1 - k) * 10);
      });
    }
    if (u.has('electrical_face') && n.eyeL) {
      // 每 3.2 秒眨一次眼
      const p = moving ? t % 3.2 : 1;
      const s = p < 0.14 ? 0.15 : 1;
      n.eyeL.scale.y = s;
      n.eyeR.scale.y = s;
    }
    if (u.has('plaza_flags') && moving) {
      n.flags.children.forEach((f, i) => {
        const c = f.getObjectByName('flag_cloth');
        if (c) c.rotation.y = Math.sin(t * 1.8 + i) * 0.18;
      });
    }
  }
}
