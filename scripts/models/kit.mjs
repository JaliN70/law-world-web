/**
 * 低多邊形建模小工具：以 three.js 幾何體拼裝，所有面以 UV 指向 4×4 園區色盤的格心。
 * 只在 Node 端產生模型用，不進網站 bundle。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 藍圖 §2.1 園區色盤（4×4，每格一色；順序即圖集位置，列優先） */
export const PALETTE = [
  ['brand', '#1F4E79'],
  ['logoRed', '#FF0000'],
  ['fire', '#B5533C'],
  ['building', '#9CA3AF'],
  ['telecom', '#3B6FB6'],
  ['accessibility', '#7FA77F'],
  ['water', '#3E8E8A'],
  ['electrical', '#8B6FC9'],
  ['road', '#D1D5DB'],
  ['grass', '#86B86B'],
  ['canopy', '#5E9E4F'],
  ['soil', '#C9A27A'],
  ['light', '#F5F1E8'],
  ['dark', '#4B5563'],
  ['yellow', '#F2C94C'],
  ['waterBlue', '#5DADE2'],
];
const CELL = Object.fromEntries(PALETTE.map(([name], i) => [name, i]));

/** 色名 → 格心 UV（貼圖 flipY=false，v 由上往下） */
export function cellUV(color) {
  const i = CELL[color];
  if (i === undefined) throw new Error(`unknown palette color: ${color}`);
  return [((i % 4) + 0.5) / 4, (Math.floor(i / 4) + 0.5) / 4];
}

function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const [u, v] = cellUV(color);
  const uv = new Float32Array(g.attributes.position.count * 2);
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] = u;
    uv[i + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.deleteAttribute('normal');
  return g;
}

/**
 * Parts：同一個 mesh 的零件集合。每個零件都已上色、已放到位置。
 * 位置參數一律以「底面中心」為基準（y 為底面高度），方便堆疊。
 */
export class Parts {
  constructor() {
    this.list = [];
  }

  add(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const g = paint(geo, color);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    );
    g.applyMatrix4(m);
    this.list.push(g);
    return this;
  }

  /** 方塊：w(x) × h(y) × d(z)，底面在 y */
  box(w, h, d, color, at = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.add(g, color, at);
  }

  /** 圓柱／稜柱：底面在 y */
  cyl(rTop, rBot, h, seg, color, at = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    g.translate(0, h / 2, 0);
    return this.add(g, color, at);
  }

  /** 楔形（斜坡）：沿 +X 由 0 升到 h，長 d（x 方向）、寬 w（z 方向） */
  wedge(w, h, d, color, at = {}) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0);
    s.lineTo(d / 2, 0);
    s.lineTo(d / 2, h);
    s.lineTo(-d / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    return this.add(g, color, at);
  }

  /** 低多邊形球（樹冠、圓角量體） */
  blob(r, color, at = {}, detail = 1) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    return this.add(g, color, at);
  }

  torus(r, tube, color, at = {}, seg = 20) {
    const g = new THREE.TorusGeometry(r, tube, 5, seg);
    return this.add(g, color, at);
  }

  /** 屋頂女兒牆：外框 w×d、牆厚 t、高 h，底面在 y */
  parapet(w, d, t, h, color, at = {}) {
    const { x = 0, y = 0, z = 0 } = at;
    this.box(w, h, t, color, { x, y, z: z - d / 2 + t / 2 });
    this.box(w, h, t, color, { x, y, z: z + d / 2 - t / 2 });
    this.box(t, h, d - 2 * t, color, { x: x - w / 2 + t / 2, y, z });
    this.box(t, h, d - 2 * t, color, { x: x + w / 2 - t / 2, y, z });
    return this;
  }

  /**
   * 量體外殼細節：底部勒腳（比牆寬一圈的深色基座）＋四角壁柱。
   * (w,h,d) 為牆體尺寸，at 為牆體底面中心（與 box 相同）。
   */
  shell(w, h, d, at = {}, trim = 'light', base = 'dark') {
    const { x = 0, y = 0, z = 0 } = at;
    this.box(w + 0.18, 0.42, d + 0.18, base, { x, y, z });
    const k = 0.3;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.box(k, h - 0.1, k, trim, { x: x + sx * (w / 2 - k / 2 + 0.06), y: y + 0.42, z: z + sz * (d / 2 - k / 2 + 0.06) });
    }
    return this;
  }

  /** 磚縫：每隔 step 一道略比牆大的細條，四面牆一次到位 */
  courses(w, h, d, at = {}, color = 'soil', step = 0.55, from = 0.75) {
    const { x = 0, y = 0, z = 0 } = at;
    for (let yy = from; yy < h - 0.25; yy += step) this.box(w + 0.04, 0.05, d + 0.04, color, { x, y: y + yy, z });
    return this;
  }

  /** 牆面窗列：在 face（'+z' | '-z' | '+x' | '-x'）平面上排一列窗 */
  windows(face, { count, w, h, gap, y, offset, along = 0 }, color = 'dark', frame = 'light') {
    const total = count * w + (count - 1) * gap;
    for (let i = 0; i < count; i++) {
      const c = along - total / 2 + w / 2 + i * (w + gap);
      const depth = 0.08;
      const fd = 0.05;
      if (face === '+z' || face === '-z') {
        const z = face === '+z' ? offset + depth / 2 : -offset - depth / 2;
        this.box(w + 0.16, h + 0.16, fd, frame, { x: c, y: y - 0.08, z });
        this.box(w, h, depth, color, { x: c, y, z: face === '+z' ? z + 0.02 : z - 0.02 });
      } else {
        const x = face === '+x' ? offset + depth / 2 : -offset - depth / 2;
        this.box(fd, h + 0.16, w + 0.16, frame, { x, y: y - 0.08, z: c });
        this.box(depth, h, w, color, { x: face === '+x' ? x + 0.02 : x - 0.02, y, z: c });
      }
    }
    return this;
  }

  /** 樹（低多邊形）：type 'round' | 'cone' | 'bush' */
  tree(type, at = {}, s = 1) {
    const { x = 0, y = 0, z = 0 } = at;
    if (type === 'bush') return this.blob(0.6 * s, 'canopy', { x, y: y + 0.45 * s, z, sy: 0.75 }, 0);
    this.cyl(0.12 * s, 0.16 * s, 1.0 * s, 5, 'soil', { x, y, z });
    if (type === 'cone') {
      const g = new THREE.ConeGeometry(0.95 * s, 2.2 * s, 6);
      g.translate(0, 1.1 * s, 0);
      this.add(g, 'canopy', { x, y: y + 0.8 * s, z });
    } else {
      this.blob(0.95 * s, 'canopy', { x, y: y + 1.75 * s, z }, 0);
      this.blob(0.6 * s, 'grass', { x: x + 0.45 * s, y: y + 1.35 * s, z: z + 0.3 * s }, 0);
    }
    return this;
  }

  geometry() {
    return mergeGeometries(this.list, false);
  }

  get triangles() {
    return this.list.reduce((a, g) => a + g.attributes.position.count / 3, 0);
  }
}

/** 具名 mesh 節點 */
export function meshNode(name, parts, at = {}) {
  const m = new THREE.Mesh(parts.geometry());
  m.name = name;
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = at;
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

export function group(name, children = [], at = {}) {
  const g = new THREE.Group();
  g.name = name;
  const { x = 0, y = 0, z = 0, ry = 0 } = at;
  g.position.set(x, y, z);
  g.rotation.y = ry;
  children.forEach((c) => g.add(c));
  return g;
}

export { THREE };
