import * as THREE from 'three';

export class TourDirector {
  constructor({ rig, buildings, onBeat, reducedMotion }) {
    this.rig = rig;
    this.buildings = buildings;
    this.onBeat = onBeat;
    this.reducedMotion = reducedMotion;
    this.mode = 'idle';
    this.t = 0;
    this.liftOffsets = {};
    Object.keys(buildings).forEach((k) => {
      this.liftOffsets[k] = 0;
    });
  }

  startFirstVisit() {
    if (this.reducedMotion) {
      this.mode = 'fade-in';
      this.t = 0;
      this.rig.setZoom(1);
      this.onBeat?.('labels-all');
      setTimeout(() => this.onBeat?.('tour-done'), 200);
      return;
    }
    this.mode = 's1';
    this.t = 0;
    this.rig.setZoom(0.55);
    this.rig.target.set(0, 0, 0);
  }

  startReturnVisit() {
    this.mode = 'fade-in';
    this.t = 0;
    this.rig.resetOverview();
    this.onBeat?.('labels-all');
  }

  update(dt) {
    this.t += dt;
    if (this.mode === 's1') {
      const d = 1.6;
      const k = Math.min(1, this.t / d);
      this.rig.setZoom(0.55 + k * 0.45);
      if (this.t >= d) {
        this.mode = 's2';
        this.t = 0;
      }
    } else if (this.mode === 's2') {
      const d = 2.4;
      const phase = this.t / d;
      let yaw = 0;
      if (phase < 0.33) yaw = -15 * (phase / 0.33);
      else if (phase < 0.66) yaw = -15 + 30 * ((phase - 0.33) / 0.33);
      else yaw = 15 - 15 * ((phase - 0.66) / 0.34);
      this.rig.setYaw(yaw, false);
      const labelIndex = Math.floor(this.t / 0.3);
      if (labelIndex >= 0 && labelIndex <= 6) this.onBeat?.('label', labelIndex);
      if (!this.reducedMotion) {
        const lift = Math.sin(Math.min(1, this.t / 0.8) * Math.PI) * 0.2;
        Object.keys(this.liftOffsets).forEach((k) => {
          this.liftOffsets[k] = lift;
        });
      }
      if (this.t >= d) {
        this.mode = 'idle';
        this.rig.setYaw(0, false);
        Object.keys(this.liftOffsets).forEach((k) => {
          this.liftOffsets[k] = 0;
        });
        this.onBeat?.('tour-done');
      }
    } else if (this.mode === 'fade-in') {
      if (this.t >= 0.4) this.mode = 'idle';
    }
  }

  applyLifts() {
    Object.entries(this.buildings).forEach(([id, g]) => {
      const baseY = g.userData.baseY ?? g.position.y;
      if (g.userData.baseY === undefined) g.userData.baseY = g.position.y;
      g.position.y = baseY + (this.liftOffsets[id] || 0);
    });
  }

  focusTransition(building, duration = 0.6, onDone) {
    this.mode = 'focus';
    const startTarget = this.rig.target.clone();
    const startZoom = this.rig.zoom;
    const startYaw = this.rig.yaw;
    const endTarget = building.position.clone().multiplyScalar(0.55);
    const elapsed = { v: 0 };
    const tick = (dt) => {
      elapsed.v += dt;
      const k = Math.min(1, elapsed.v / duration);
      const ease = 1 - Math.pow(1 - k, 3);
      this.rig.target.lerpVectors(startTarget, endTarget, ease);
      this.rig.setZoom(startZoom + (1.9 - startZoom) * ease);
      this.rig.setYaw(startYaw + (8 - startYaw) * ease);
      if (k >= 1) {
        this.mode = 'idle';
        onDone?.();
        return null;
      }
      return tick;
    };
    return tick;
  }

  backTransition(duration = 0.5, onDone) {
    const startTarget = this.rig.target.clone();
    const startZoom = this.rig.zoom;
    const startYaw = this.rig.yaw;
    const elapsed = { v: 0 };
    const tick = (dt) => {
      elapsed.v += dt;
      const k = Math.min(1, elapsed.v / duration);
      const ease = 1 - Math.pow(1 - k, 3);
      this.rig.target.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), ease);
      this.rig.setZoom(startZoom + (1 - startZoom) * ease);
      this.rig.setYaw(startYaw + (0 - startYaw) * ease);
      if (k >= 1) {
        this.mode = 'idle';
        onDone?.();
        return null;
      }
      return tick;
    };
    return tick;
  }
}
