import * as THREE from 'three';
import { AREA_ORDER } from '../data/areas.js';
import { PRESETS, toWorld, BUILDING_YAW, BUILDING_SCALE, PLOT_HALF, PLAZA_R, ROAD_W } from './layout.js';
import { buildGround, buildRoads, scatterTrees, lampSpots, blobShadowTexture } from './terrain.js';
import { IsoCamera } from './camera.js';
import { Effects } from './effects.js';

/** 各棟主量體屋頂高度（公尺，不含塔、水塔、電桿） */
const LABEL_ROOF = { fire: 5.4, building: 7.5, telecom: 4.4, accessibility: 6.0, water: 3.4, electrical: 3.2 };

const SKY_DAY = { top: 0xbfe6fa, hemi: [0xffffff, 0x9fb6c8, 1.15], sun: [0xfff4e0, 1.55] };
const SKY_NIGHT = { top: 0x1b2a44, hemi: [0x7f93c8, 0x1b2236, 0.55], sun: [0x9fb4ff, 0.45] };

/**
 * 3D 世界：一座浮島＋六棟建築＋中央廣場。
 * 只負責場景、相機與點選；UI（標籤、卡片）由 main.js 透過事件與 screenPositions() 控制。
 */
export class World {
  constructor(canvas, park, { mobileQuery }) {
    this.canvas = canvas;
    this.park = park;
    this.mq = mobileQuery;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dprCap = 2;
    this.lowEnd = false;

    this.scene = new THREE.Scene();
    this.iso = new IsoCamera();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9fb6c8, 1.15);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.55);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.blobTex = blobShadowTexture();
    this.effects = new Effects(this);
    this.buildings = {};
    this.proxies = [];
    this.hotspots = [];
    this.night = false;
    this.preset = null;
    this.size = { w: 1, h: 1 };
    this.reserve = { top: 0, bottom: 0 };
  }

  /** 依目前螢幕決定布局；不同才重建 */
  applyLayout() {
    const id = this.mq.matches ? 'ringTall' : 'ring';
    if (this.preset?.id === id) return false;
    this.preset = PRESETS[id];
    this.build();
    return true;
  }

  build() {
    // 清掉舊布局（模板幾何共用，不釋放）
    this.root.traverse((o) => {
      if (o.userData.ownGeometry) o.geometry.dispose();
    });
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.buildings = {};
    this.proxies = [];
    this.hotspots = [];

    const P = this.preset;
    const { templates, palette } = this.park;
    const own = (mesh) => {
      mesh.userData.ownGeometry = true;
      return mesh;
    };

    // 地形＋道路：一個 mesh
    const ground = own(new THREE.Mesh(buildGround(P), palette.base));
    ground.name = 'ground';
    ground.receiveShadow = true;
    this.root.add(ground);

    // 中央廣場
    const plaza = templates.plaza.clone(true);
    plaza.name = 'plaza';
    plaza.scale.setScalar((P.plazaScale || 1) * (PLAZA_R / 6.6));
    this.root.add(plaza);
    plaza.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      o.castShadow = true;
      o.material = o.name === 'plaza_logo' ? palette.glowing('plaza_logo') : palette.base;
    });

    // 六棟建築：正面朝鏡頭；每棟一份可降飽和材質，發光零件另各一份
    for (const id of AREA_ORDER) {
      const [r, u] = P.buildings[id];
      const [x, z] = toWorld(r, u);
      const holder = new THREE.Group();
      holder.name = `${id}_holder`;
      holder.position.set(x, 0, z);
      holder.rotation.y = BUILDING_YAW;
      const b = templates[id].clone(true);
      b.name = id;
      b.scale.setScalar(BUILDING_SCALE);
      const sat = { value: 1 };
      const bodyMat = palette.saturatable(`${id}_body`);
      bodyMat.userData.uSat = sat;
      const parts = {};
      // GLTFLoader 會把與 scene 同名的節點改成 fire_1 之類；找回主體 mesh 並還原名稱
      const mainMesh = [];
      b.traverse((o) => {
        if (o.isMesh && o.name.replace(/_\d+$/, '') === id) mainMesh.push(o);
      });
      mainMesh[0].name = id;
      b.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.material = o.name === id ? bodyMat : palette.glowing(`${o.name}_mat`, sat);
        }
        if (o !== b) parts[o.name] = o;
        o.userData.areaId = id;
      });
      holder.add(b);
      this.root.add(holder);

      // 主體外框（世界座標；mesh 節點帶量化縮放，不能直接讀幾何 bbox）
      const main = mainMesh[0];
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(main);
      const top = box.max.y; // 標籤高度（不含煙等解鎖物）

      // 點擊判定：比模型外擴 20%（藍圖 §5）
      const size = box.getSize(new THREE.Vector3()).multiplyScalar(1.2);
      const center = box.getCenter(new THREE.Vector3());
      const proxy = own(new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false })));
      proxy.position.copy(center);
      proxy.userData.areaId = id;
      this.root.add(proxy);
      this.proxies.push(proxy);

      // 低階模式用的「烘焙」接觸陰影
      const blob = own(new THREE.Mesh(new THREE.PlaneGeometry(PLOT_HALF * 3.2, PLOT_HALF * 3.2), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false })));
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(x, 0.09, z);
      blob.visible = false;
      blob.name = 'blob_shadow';
      this.root.add(blob);

      this.buildings[id] = { id, holder, model: b, parts, sat, top, center: new THREE.Vector3(x, 0, z), blob };
    }

    // 樹：每種一個 InstancedMesh
    const spots = scatterTrees(P);
    for (const type of ['tree_round', 'tree_cone', 'bush']) {
      const list = spots.filter((s) => s.type === type);
      const mesh = templates[type].getObjectByProperty('isMesh', true);
      const inst = new THREE.InstancedMesh(mesh.geometry, palette.base, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      list.forEach((s, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
        m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3().setScalar(s.scale));
        // 模板節點自帶量化位移／縮放
        inst.setMatrixAt(i, m.clone().multiply(mesh.matrixWorld));
      });
      inst.castShadow = true;
      inst.name = type;
      this.root.add(inst);
    }

    // 解鎖道具（預設隱藏）
    const lamps = lampSpots(P);
    const lampGroup = new THREE.Group();
    lampGroup.name = 'park_lamps';
    lampGroup.visible = false;
    const lampHeadMat = palette.glowing('lamp_head');
    for (const { x, z } of lamps) {
      const l = templates.lamp.clone(true);
      l.position.set(x, 0, z);
      l.rotation.y = BUILDING_YAW;
      l.traverse((o) => {
        if (o.isMesh) {
          o.material = o.name === 'lamp_head' ? lampHeadMat : palette.base;
          o.castShadow = true;
        }
      });
      lampGroup.add(l);
    }
    this.root.add(lampGroup);

    const flags = new THREE.Group();
    flags.name = 'plaza_flags';
    flags.visible = false;
    for (const [r, u] of P.flags) {
      const f = templates.flag.clone(true);
      const [x, z] = toWorld(r, u);
      f.position.set(x, 0, z);
      f.rotation.y = BUILDING_YAW;
      f.traverse((o) => {
        if (o.isMesh) {
          o.material = palette.base;
          o.castShadow = true;
        }
      });
      flags.add(f);
    }
    this.root.add(flags);

    const sign = templates.access_sign.clone(true);
    sign.name = 'plaza_access_sign';
    const [sx, sz] = toWorld(...P.sign);
    sign.position.set(sx, 0, sz);
    sign.rotation.y = BUILDING_YAW;
    sign.visible = false;
    sign.traverse((o) => {
      if (o.isMesh) {
        o.material = palette.base;
        o.castShadow = true;
      }
    });
    this.root.add(sign);

    // 消防站 ↔ 建築技術館 連通步道（B3）
    const fr = P.buildings.fire;
    const br = P.buildings.building;
    const bridgeGeo = buildRoads([[fr, br]], { width: 1.8, color: 'light', dashes: false });
    const bridge = own(new THREE.Mesh(bridgeGeo, palette.base));
    bridge.position.y = 0.04;
    bridge.name = 'bridge_fire_building';
    bridge.visible = false;
    bridge.receiveShadow = true;
    this.root.add(bridge);

    this.buildPeople();

    this.props = { lamps: lampGroup, flags, sign, bridge, plaza, lampHeadMat };
    this.effects.bind();
    this.setNight(this.night);
    this.setShadows(!this.lowEnd);
    this.fit();
  }

  /**
   * 行人：沿每條道路兩側的人行位置來回走（往返之間會停一下），另有幾位繞廣場散步。
   * 每種穿著一個 InstancedMesh，每幀只更新矩陣。
   */
  buildPeople() {
    const P = this.preset;
    const { templates, palette } = this.park;
    const variants = ['person_a', 'person_b', 'person_c', 'person_d'];
    const rand = (() => {
      let x = P.id === 'ring' ? 3 : 9;
      return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
    })();
    const plazaR = PLAZA_R * (P.plazaScale || 1);
    const walkers = [];
    for (const [a, b] of P.roads) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const s0 = plazaR + 0.8;
      const s1 = len - PLOT_HALF - 0.8;
      if (s1 - s0 < 2) continue;
      for (const side of [-1, 1]) {
        if (rand() < 0.25) continue;
        walkers.push({
          kind: 'line',
          a: [a[0] + dir[0] * s0, a[1] + dir[1] * s0],
          dir,
          len: s1 - s0,
          off: side * (ROAD_W / 2 - 0.45),
          s: rand() * (s1 - s0),
          v: (0.9 + rand() * 0.5) * (rand() < 0.5 ? 1 : -1),
          pause: 0,
          variant: variants[walkers.length % variants.length],
          phase: rand() * 10,
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      walkers.push({
        kind: 'loop',
        r: plazaR + 0.9,
        ang: (i / 3) * Math.PI * 2 + rand(),
        v: (0.12 + rand() * 0.05) * (i % 2 ? 1 : -1),
        variant: variants[(i + 1) % variants.length],
        phase: rand() * 10,
      });
    }
    this.people = { walkers, meshes: {} };
    for (const v of variants) {
      const list = walkers.filter((w) => w.variant === v);
      if (!list.length) continue;
      const src = templates[v].getObjectByProperty('isMesh', true);
      const inst = new THREE.InstancedMesh(src.geometry, palette.base, list.length);
      inst.castShadow = true;
      inst.frustumCulled = false;
      inst.name = `people_${v}`;
      inst.userData.base = src.matrixWorld.clone();
      list.forEach((w, i) => (w.slot = i));
      this.root.add(inst);
      this.people.meshes[v] = inst;
    }
    this.updatePeople(0, 0, true);
  }

  updatePeople(dt, t, force = false) {
    if (!this.people) return;
    const moving = !this.effects.reduced;
    if (!moving && !force) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1.25, 1.25, 1.25); // 略放大，概覽時也看得出是人
    const up = new THREE.Vector3(0, 1, 0);
    for (const w of this.people.walkers) {
      let r, u, dr, du;
      if (w.kind === 'line') {
        if (w.pause > 0) w.pause -= dt;
        else {
          w.s += w.v * dt;
          if (w.s > w.len || w.s < 0) {
            w.s = Math.max(0, Math.min(w.len, w.s));
            w.v = -w.v;
            w.pause = 0.6 + Math.random() * 1.5; // 到端點停一下再折返
          }
        }
        const sgn = Math.sign(w.v);
        r = w.a[0] + w.dir[0] * w.s - w.dir[1] * w.off;
        u = w.a[1] + w.dir[1] * w.s + w.dir[0] * w.off;
        dr = w.dir[0] * sgn;
        du = w.dir[1] * sgn;
      } else {
        w.ang += w.v * dt;
        r = Math.cos(w.ang) * w.r;
        u = Math.sin(w.ang) * w.r;
        const sgn = Math.sign(w.v);
        dr = -Math.sin(w.ang) * sgn;
        du = Math.cos(w.ang) * sgn;
      }
      const [x, z] = toWorld(r, u);
      const [x2, z2] = toWorld(r + dr, u + du);
      const walking = w.kind === 'loop' || w.pause <= 0;
      const bob = moving && walking ? Math.abs(Math.sin((t + w.phase) * 7)) * 0.07 : 0;
      pos.set(x, 0.07 + bob, z);
      q.setFromAxisAngle(up, Math.atan2(x2 - x, z2 - z));
      m.compose(pos, q, one).multiply(this.people.meshes[w.variant].userData.base);
      this.people.meshes[w.variant].setMatrixAt(w.slot, m);
    }
    for (const inst of Object.values(this.people.meshes)) inst.instanceMatrix.needsUpdate = true;
  }

  /** 相機框住整座島（含岩底與建築頂） */
  fit() {
    const { w, h } = this.size;
    const P = this.preset;
    if (!P) return;
    const pts = [];
    const { hr, hu } = P.island;
    for (const [r, u] of [[hr, hu], [-hr, hu], [hr, -hu], [-hr, -hu], [0, hu], [0, -hu], [hr, 0], [-hr, 0]]) {
      const [x, z] = toWorld(r, u);
      pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 0.85, -7.6, z * 0.85));
    }
    // 建築外框（含塔頂）＋標籤高度
    for (const b of Object.values(this.buildings)) {
      const box = new THREE.Box3().setFromObject(b.model.getObjectByName(b.id));
      for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, box.max.y + 2.5, z));
    }
    const mobile = P.id === 'ringTall';
    this.iso.fit(pts, w, h, { margin: mobile ? 0.03 : 0.06, reserveTop: this.reserve.top, reserveBottom: this.reserve.bottom });
    this.iso.panLimit = { r: P.island.hr * 0.55, u: P.island.hu * 0.55 };
    // 陰影相機涵蓋整座島
    const R = Math.hypot(P.island.hr, P.island.hu) + 6;
    const cam = this.sun.shadow.camera;
    Object.assign(cam, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 220 });
    cam.updateProjectionMatrix();
    this.sun.position.set(-40, 90, 55);
    this.sun.shadow.mapSize.set(this.mq.matches ? 1024 : 2048, this.mq.matches ? 1024 : 2048);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  resize(w, h, reserve = this.reserve) {
    this.size = { w, h };
    this.reserve = reserve;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    this.renderer.setSize(w, h, false);
    this.fit();
  }

  setShadows(on) {
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    Object.values(this.buildings).forEach((b) => (b.blob.visible = !on));
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
  }

  /** 低階機（FPS < 30 持續 2 秒）：關動態、陰影改烘焙、DPR 降到 1（藍圖 §3） */
  enterLowEnd() {
    if (this.lowEnd) return;
    this.lowEnd = true;
    this.dprCap = 1;
    this.setShadows(false);
    this.resize(this.size.w, this.size.h);
  }

  setNight(on) {
    this.night = on;
    const s = on ? SKY_NIGHT : SKY_DAY;
    this.hemi.color.set(s.hemi[0]);
    this.hemi.groundColor.set(s.hemi[1]);
    this.hemi.intensity = s.hemi[2];
    this.sun.color.set(s.sun[0]);
    this.sun.intensity = s.sun[1];
    document.documentElement.classList.toggle('night', on);
    this.effects.setNight(on);
  }

  /** 其他建築降飽和 40%（focusId 為 null 時全部恢復） */
  focus(focusId) {
    for (const b of Object.values(this.buildings)) b.sat.value = focusId && b.id !== focusId ? 0.6 : 1;
  }

  /** 每棟標籤位置（建築頂上方）；回傳畫面像素 */
  labelPositions() {
    const out = {};
    const v = new THREE.Vector3();
    for (const b of Object.values(this.buildings)) {
      // 標籤放在主量體屋頂上方；細高的塔不算，避免標籤疊到後排建築
      // 往島外側挪一點，標籤才不會蓋在中央廣場上
      v.copy(b.center);
      const d = Math.hypot(v.x, v.z) || 1;
      v.x += (v.x / d) * PLOT_HALF * 0.7;
      v.z += (v.z / d) * PLOT_HALF * 0.7;
      v.setY((LABEL_ROOF[b.id] != null ? LABEL_ROOF[b.id] * BUILDING_SCALE : b.top) + 1.4 + (b.lift || 0));
      out[b.id] = this.iso.project(v, this.size.w, this.size.h);
    }
    return out;
  }

  ndc(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** 點到哪棟建築（含外擴判定區） */
  pickBuilding(clientX, clientY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(clientX, clientY), this.iso.camera);
    const hit = ray.intersectObjects(this.proxies, false)[0];
    return hit?.object.userData.areaId || null;
  }

  /** 場景任務（A1、A3）：在建築上放幾個隱形熱點 */
  setHotspots(areaId, targets) {
    this.clearHotspots();
    const b = this.buildings[areaId];
    if (!b) return;
    for (const t of targets) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(t.r, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set(...t.local);
      m.userData = { hotspot: t.id, ownGeometry: true };
      b.holder.add(m);
      this.hotspots.push(m);
    }
  }

  clearHotspots() {
    this.hotspots.forEach((m) => {
      m.parent?.remove(m);
      m.geometry.dispose();
    });
    this.hotspots = [];
  }

  pickHotspot(clientX, clientY) {
    if (!this.hotspots.length) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(clientX, clientY), this.iso.camera);
    const hit = ray.intersectObjects(this.hotspots, false)[0];
    if (!hit) return null;
    return { id: hit.object.userData.hotspot, point: hit.object.getWorldPosition(new THREE.Vector3()) };
  }

  /** 熱點找到時的標記環 */
  markFound(point) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 6, 24), this.park.palette.glowing('found_mark'));
    m.material.emissiveIntensity = 0.8;
    m.rotation.x = Math.PI / 2;
    m.position.copy(point).setY(point.y + 0.15);
    m.userData.ownGeometry = true;
    m.name = 'found_mark';
    this.root.add(m);
    this.effects.pop(m);
  }

  clearFoundMarks() {
    this.root.children.filter((c) => c.name === 'found_mark').forEach((m) => {
      this.root.remove(m);
      m.geometry.dispose();
    });
  }

  render(dt, t) {
    this.effects.update(dt, t);
    this.updatePeople(dt, t);
    this.iso.update();
    this.renderer.render(this.scene, this.iso.camera);
  }
}

export { SKY_DAY, SKY_NIGHT };
