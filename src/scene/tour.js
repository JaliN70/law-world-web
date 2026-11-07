import * as THREE from 'three';
import { fitFrustumToBounds } from './camera.js';
import { computeIslandBounds, ISLAND_POSITIONS } from './layouts.js';

export class TourDirector {
  constructor({ rig, camera, buildings, onBeat, reducedMotion, isMobile }) {
    this.rig = rig;
    this.camera = camera;
    this.buildings = buildings;
    this.onBeat = onBeat;
    this.reducedMotion = reducedMotion;
    this.isMobile = isMobile;
    this.mode = 'idle';
    this.t = 0;
    this.view = 'overview';
    this.activeIsland = null;
    this.liftOffsets = {};
    Object.keys(buildings).forEach((k) => {
      this.liftOffsets[k] = 0;
    });
  }

  islandCenter(id) {
    const [x, , z] = ISLAND_POSITIONS[id];
    return new THREE.Vector3(x, 0, z);
  }

  fitIslandFrustum(id, width, height) {
    const b = computeIslandBounds(id, { pad: this.isMobile ? 4.5 : 3.8 });
    if (width && height) fitFrustumToBounds(this.camera, width, height, b, this.isMobile);
    this.rig.frustumIsland = b;
  }

  startFirstVisit() {
    if (this.reducedMotion) {
      this.mode = 'fade-in';
      this.t = 0;
      this.onBeat?.('labels-all');
      setTimeout(() => this.onBeat?.('tour-done'), 200);
      return;
    }
    this.mode = 's1';
    this.t = 0;
    this.rig.resetOverview();
    this.rig.setZoom(1);
    this.rig.target.set(0, 0, 0);
  }

  startReturnVisit() {
    this.mode = 'fade-in';
    this.t = 0;
    this.view = 'overview';
    this.activeIsland = null;
    this.rig.resetOverview();
    this.onBeat?.('labels-all');
  }

  update(dt) {
    this.t += dt;
    if (this.mode === 's1') {
      if (this.t >= 1.2) {
        this.mode = 'idle';
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

  flyToIsland(islandId, duration, onDone) {
    const dur = this.reducedMotion ? 0.2 : duration ?? 0.8;
    this.view = 'island';
    this.activeIsland = islandId;
    const startTarget = this.rig.target.clone();
    const startZoom = this.rig.zoom;
    const startYaw = this.rig.yaw;
    const end = this.islandCenter(islandId);
    const bounds = computeIslandBounds(islandId);
    const elapsed = { v: 0 };
    const tick = (dt) => {
      elapsed.v += dt;
      const k = Math.min(1, elapsed.v / dur);
      const ease = this.reducedMotion ? k : 1 - Math.pow(1 - k, 3);
      this.rig.target.lerpVectors(startTarget, end, ease);
      this.rig.setYaw(startYaw + (THREE.MathUtils.lerp(startYaw, 0, ease) - startYaw));
      this.rig.setZoom(startZoom + (1.55 - startZoom) * ease);
      if (k >= 1) {
        this.mode = 'idle';
        this.fitIslandFrustum(islandId, this.viewportW, this.viewportH);
        onDone?.();
        return null;
      }
      return tick;
    };
    this.mode = 'fly';
    return tick;
  }

  flyToOverview(duration, onDone) {
    const dur = this.reducedMotion ? 0.2 : duration ?? 0.8;
    const startTarget = this.rig.target.clone();
    const startZoom = this.rig.zoom;
    const startYaw = this.rig.yaw;
    const elapsed = { v: 0 };
    const tick = (dt) => {
      elapsed.v += dt;
      const k = Math.min(1, elapsed.v / dur);
      const ease = this.reducedMotion ? k : 1 - Math.pow(1 - k, 3);
      this.rig.target.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), ease);
      this.rig.setZoom(startZoom + (1 - startZoom) * ease);
      this.rig.setYaw(startYaw + (0 - startYaw) * ease);
      if (k >= 1) {
        this.view = 'overview';
        this.activeIsland = null;
        this.rig.resetOverview();
        this.rig.frustumIsland = null;
        onDone?.();
        return null;
      }
      return tick;
    };
    return tick;
  }

  focusBuilding(building, onDone) {
    const islandId = building.userData?.areaId;
    const center = islandId ? this.islandCenter(islandId) : building.getWorldPosition(new THREE.Vector3());
    const dur = this.reducedMotion ? 0.2 : 0.45;
    const startTarget = this.rig.target.clone();
    const elapsed = { v: 0 };
    const tick = (dt) => {
      elapsed.v += dt;
      const k = Math.min(1, elapsed.v / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      this.rig.target.lerpVectors(startTarget, center, ease);
      if (k >= 1) {
        if (islandId) this.fitIslandFrustum(islandId, this.viewportW, this.viewportH);
        onDone?.();
        return null;
      }
      return tick;
    };
    return tick;
  }
}
