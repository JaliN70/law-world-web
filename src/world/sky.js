import * as THREE from 'three';
import { toWorld } from './layout.js';

/**
 * 背景天空：低多邊形雲朵（InstancedMesh，三種造型各一個 draw call），
 * 只放在島體以外的區域，緩慢沿畫面橫向飄動；夜間變成暗藍色。
 */
function cloudGeometry(seed) {
  const parts = [];
  const rnd = (() => {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const k = 1.5 + rnd() * 1.4;
    g.scale(k * 1.25, k * 0.8, k);
    g.translate((i - n / 2) * 2.1 + rnd(), rnd() * 0.8, (rnd() - 0.5) * 2.2);
    parts.push(g.toNonIndexed());
  }
  const out = new THREE.BufferGeometry();
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o);
    o += g.attributes.position.array.length;
    g.dispose();
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export class Sky {
  constructor(root, preset) {
    this.group = new THREE.Group();
    this.group.name = 'sky';
    root.add(this.group);
    const { hr, hu } = preset.island;
    this.range = Math.max(hr + 34, 52);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xbfd8f0, emissiveIntensity: 0.35, flatShading: true });
    this.items = [];
    const rand = (() => {
      let s = 77;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    const variants = [cloudGeometry(11), cloudGeometry(23), cloudGeometry(37)];
    const counts = [5, 5, 4];
    this.meshes = variants.map((geo, vi) => {
      const mesh = new THREE.InstancedMesh(geo, this.mat, counts[vi]);
      mesh.frustumCulled = false;
      mesh.userData.ownGeometry = true;
      mesh.userData.disposeMat = false;
      this.group.add(mesh);
      for (let i = 0; i < counts[vi]; i++) {
        let r;
        let u;
        for (let t = 0; t < 40; t++) {
          r = (rand() * 2 - 1) * this.range;
          u = (i % 2 ? 1 : -1) * (hu + 6 + rand() * 40);
          // 避開島體本身（含餘裕），雲只出現在島的外圍
          if (Math.abs(r) > hr + 15 || Math.abs(u) > hu + 12) break;
        }
        this.items.push({ mesh, i, r, u, y: (u < 0 ? 10 : 4) + rand() * 10, s: 0.55 + rand() * 0.7, v: 0.35 + rand() * 0.5 });
      }
      return mesh;
    });
    this.hu = hu;
    this.hr = hr;
    this.update(0, true);
  }

  setNight(on) {
    this.mat.color.set(on ? 0x6b7fa8 : 0xffffff);
    this.mat.emissive.set(on ? 0x1b2a4a : 0xbfd8f0);
    this.mat.emissiveIntensity = on ? 0.5 : 0.35;
  }

  update(dt, force = false) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    for (const it of this.items) {
      if (!force) {
        it.r += it.v * dt;
        if (it.r > this.range) it.r = -this.range;
      }
      // 橫穿島體正上方／正下方的雲會遮住建築：進入島體範圍時推到外圍
      let u = it.u;
      if (Math.abs(it.r) < this.hr + 15 && Math.abs(u) < this.hu + 12) u = Math.sign(u || 1) * (this.hu + 12);
      const [x, z] = toWorld(it.r, u);
      pos.set(x, it.y, z);
      sc.setScalar(it.s);
      m.compose(pos, q, sc);
      it.mesh.setMatrixAt(it.i, m);
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}
