/**
 * 依布局即時產生：浮島（草地頂面＋分層岸壁）、道路、樹木位置、路燈位置。
 * 全部以色盤 UV 上色，和 park.glb 共用同一張 4×4 色盤與材質。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toWorld, islandOutline, pointInPolygon, distToSegment, PLAZA_R, PLOT_HALF, ROAD_W } from './layout.js';

const CELLS = ['brand', 'logoRed', 'fire', 'building', 'telecom', 'accessibility', 'water', 'electrical', 'road', 'grass', 'canopy', 'soil', 'light', 'dark', 'yellow', 'waterBlue'];
export function cellUV(color) {
  const i = CELLS.indexOf(color);
  return [((i % 4) + 0.5) / 4, (Math.floor(i / 4) + 0.5) / 4];
}

/** 可重現的亂數（同一布局每次長得一樣） */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class Tris {
  constructor() {
    this.pos = [];
    this.uv = [];
  }
  tri(a, b, c, color) {
    const [u, v] = cellUV(color);
    this.pos.push(...a, ...b, ...c);
    this.uv.push(u, v, u, v, u, v);
  }
  quad(a, b, c, d, color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }
  /** 依參考點把每個三角形翻成「朝外」（島體用；避免手算繞序） */
  orientFrom(ox, oy, oz) {
    const P = this.pos;
    for (let i = 0; i < P.length; i += 9) {
      const ax = P[i], ay = P[i + 1], az = P[i + 2];
      const e1 = [P[i + 3] - ax, P[i + 4] - ay, P[i + 5] - az];
      const e2 = [P[i + 6] - ax, P[i + 7] - ay, P[i + 8] - az];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const c = [(ax + P[i + 3] + P[i + 6]) / 3 - ox, (ay + P[i + 4] + P[i + 7]) / 3 - oy, (az + P[i + 5] + P[i + 8]) / 3 - oz];
      if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) {
        for (let k = 0; k < 3; k++) [P[i + 3 + k], P[i + 6 + k]] = [P[i + 6 + k], P[i + 3 + k]];
      }
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals(); // 非索引 → 每面一個法線（低多邊形平面著色）
    return g;
  }
}

/** 沿外框每約 step 公尺取一點 */
function densify(poly, step) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/** 浮島：草地頂面 Y=0、草皮邊、土層、岩層、底部收尖 */
export function buildIsland(preset) {
  const rand = rng(preset.id === 'ring' ? 7 : 11);
  const outline = densify(islandOutline(preset.island), 3.2);
  const t = new Tris();
  const W = (r, u, y) => {
    const [x, z] = toWorld(r, u);
    return [x, y, z];
  };
  const n = outline.length;
  // 頂面（扇形三角化；外框為凸多邊形）
  for (let i = 0; i < n; i++) {
    const [ar, au] = outline[i];
    const [br, bu] = outline[(i + 1) % n];
    t.tri(W(0, 0, 0), W(br, bu, 0), W(ar, au, 0), 'grass');
  }
  // 岸壁分層：每層向內收、往下並帶一點起伏
  const layers = [
    { y: 0, inset: 0, jitter: 0 },
    { y: -0.6, inset: 0, jitter: 0, color: 'canopy' },
    { y: -1.9, inset: 0.15, jitter: 0.3, color: 'soil' },
    { y: -3.4, inset: 0.4, jitter: 0.45, color: 'soil' },
    { y: -5.4, inset: 1.1, jitter: 0.7, color: 'building' },
    { y: -7.6, inset: 2.6, jitter: 0.9, color: 'building' },
    { y: -9.4, inset: 5.5, jitter: 0.8, color: 'dark' },
  ];
  const cx = 0;
  const cu = 0;
  const rings = layers.map((L) =>
    outline.map(([r, u]) => {
      const d = Math.hypot(r - cx, u - cu) || 1;
      const k = Math.max(0.15, (d - L.inset) / d);
      const j = (rand() - 0.5) * L.jitter;
      return W(r * k + j, u * k + j, L.y + (rand() - 0.5) * L.jitter);
    })
  );
  for (let l = 1; l < layers.length; l++) {
    const up = rings[l - 1];
    const dn = rings[l];
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      t.quad(up[i], up[i2], dn[i2], dn[i], layers[l].color);
    }
  }
  // 底部收尖
  const bottom = [0, -13, 0];
  const last = rings[rings.length - 1];
  for (let i = 0; i < n; i++) t.tri(last[i], bottom, last[(i + 1) % n], 'dark');
  return t.orientFrom(0, -3, 0).geometry();
}

/** 道路：灰色路面＋淺色路緣＋中線虛線（略高於草地，避免共面閃爍） */
export function buildRoads(segments, { width = ROAD_W, color = 'road', dashes = true } = {}) {
  const t = new Tris();
  const quad = (a, b, half, y0, y1, col, from = 0, to = 1) => {
    const [ar, au] = a;
    const [br, bu] = b;
    const len = Math.hypot(br - ar, bu - au) || 1;
    const dr = (br - ar) / len;
    const du = (bu - au) / len;
    const nr = -du;
    const nu = dr;
    const p = (s, o, y) => {
      const [x, z] = toWorld(ar + dr * s + nr * o, au + du * s + nu * o);
      return [x, y, z];
    };
    const s0 = len * from;
    const s1 = len * to;
    // 頂面
    t.quad(p(s0, -half, y1), p(s0, half, y1), p(s1, half, y1), p(s1, -half, y1), col);
    // 兩側立面
    t.quad(p(s0, -half, y0), p(s0, -half, y1), p(s1, -half, y1), p(s1, -half, y0), col);
    t.quad(p(s1, half, y0), p(s1, half, y1), p(s0, half, y1), p(s0, half, y0), col);
    return len;
  };
  for (const [a, b] of segments) {
    const len = quad(a, b, width / 2 + 0.25, 0, 0.05, 'light');
    quad(a, b, width / 2, 0.05, 0.07, color);
    if (dashes) {
      const step = 2.4;
      for (let s = 1.2; s < len - 1.2; s += step) quad(a, b, 0.09, 0.07, 0.08, 'light', s / len, (s + 1.0) / len);
    }
  }
  return t.pos.length ? t.orientFrom(0, -1000, 0).geometry() : null;
}

/** 合併成一個地形幾何（島＋道路），一次 draw call */
export function buildGround(preset) {
  const parts = [buildIsland(preset), buildRoads(preset.roads)].filter(Boolean);
  return mergeGeometries(parts, false);
}

/** 樹木散布：避開廣場、建築地塊、道路與道具位置 */
export function scatterTrees(preset) {
  const rand = rng(preset.id === 'ring' ? 21 : 5);
  const poly = islandOutline({ ...preset.island, hr: preset.island.hr - 2.2, hu: preset.island.hu - 2.2 });
  const plots = Object.values(preset.buildings);
  const keep = [...preset.flags, preset.sign];
  const spots = [];
  const target = preset.id === 'ring' ? 34 : 22;
  for (let tries = 0; tries < 3000 && spots.length < target; tries++) {
    const p = [(rand() * 2 - 1) * preset.island.hr, (rand() * 2 - 1) * preset.island.hu];
    if (!pointInPolygon(p, poly)) continue;
    if (Math.hypot(p[0], p[1]) < PLAZA_R * (preset.plazaScale || 1) + 2.2) continue;
    if (plots.some(([r, u]) => Math.abs(p[0] - r) < PLOT_HALF + 1.6 && Math.abs(p[1] - u) < PLOT_HALF + 1.6)) continue;
    if (preset.roads.some((seg) => distToSegment(p, seg) < ROAD_W / 2 + 1.4)) continue;
    if (keep.some(([r, u]) => Math.hypot(p[0] - r, p[1] - u) < 2.2)) continue;
    if (spots.some((s) => Math.hypot(p[0] - s.r, p[1] - s.u) < 2.6)) continue;
    const k = rand();
    spots.push({ r: p[0], u: p[1], type: k < 0.5 ? 'tree_round' : k < 0.78 ? 'tree_cone' : 'bush', scale: 0.85 + rand() * 0.4, rot: rand() * Math.PI * 2 });
  }
  return spots.map((s) => {
    const [x, z] = toWorld(s.r, s.u);
    return { ...s, x, z };
  });
}

/** 路燈：沿道路兩側每約 11 m 一盞，避開廣場與地塊 */
export function lampSpots(preset) {
  const out = [];
  const plots = Object.values(preset.buildings);
  for (const [a, b] of preset.roads) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dr = (b[0] - a[0]) / len;
    const du = (b[1] - a[1]) / len;
    let side = 1;
    for (let s = 5; s < len - 2; s += 11) {
      const r = a[0] + dr * s - du * (ROAD_W / 2 + 0.9) * side;
      const u = a[1] + du * s + dr * (ROAD_W / 2 + 0.9) * side;
      side = -side;
      if (Math.hypot(r, u) < PLAZA_R * (preset.plazaScale || 1) + 1.5) continue;
      if (plots.some(([pr, pu]) => Math.abs(r - pr) < PLOT_HALF + 0.8 && Math.abs(u - pu) < PLOT_HALF + 0.8)) continue;
      const [x, z] = toWorld(r, u);
      out.push({ x, z });
    }
  }
  return out;
}

/** 柔和接觸陰影貼圖（低階模式或關閉即時陰影時的「烘焙」陰影） */
export function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(15,42,68,0.42)');
  grad.addColorStop(1, 'rgba(15,42,68,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
