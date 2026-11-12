/**
 * 布局預設組（藍圖 §1.1）。兩種布局共用同一份場景，只切換座標：
 *   ring：桌機橫式，六棟等距環繞中央廣場（畫面上呈六角）
 *   grid：手機直式，2×3，左右兩欄各三棟、廣場在中段
 *
 * 座標用「畫面對齊」的 (r, u)：r 為畫面右方、u 為畫面上方（沿地面往遠處）。
 * 等角相機方位 45°：畫面右 = 世界 (1,0,-1)/√2，畫面上 = 世界 (-1,0,-1)/√2。
 */
import { AREA_ORDER } from '../data/areas.js';

const S = Math.SQRT1_2;

/** (r, u) → 世界 [x, z] */
export function toWorld(r, u) {
  return [(r - u) * S, (-r - u) * S];
}

/** 世界 (x, z) → [r, u] */
export function toScreenPlane(x, z) {
  return [(x - z) * S, (-x - z) * S];
}

/** 建築一律正面（入口 +Z）朝鏡頭：local +Z → 世界 (1,0,1)/√2 */
export const BUILDING_YAW = Math.PI / 4;
export const PLOT_HALF = 4;
export const PLAZA_R = 6.6;
export const ROAD_W = 2.8;

function ring() {
  const pos = {};
  AREA_ORDER.forEach((id, i) => {
    const a = ((90 - 60 * i) * Math.PI) / 180; // 消防在正上方，順時針
    pos[id] = [17 * Math.cos(a), 19 * Math.sin(a)];
  });
  return {
    id: 'ring',
    island: { hr: 27, hu: 31, chamfer: 10 },
    buildings: pos,
    roads: AREA_ORDER.map((id) => [[0, 0], pos[id]]),
    flags: [[8, 0], [-8, 0]],
    sign: [4.6, -7.6],
  };
}

function grid() {
  // 手機直式：廣場縮成 0.72 倍（半徑約 4.75 m），兩欄靠攏，讓建築在窄螢幕上夠大
  const C = 9.6;
  const R = 28;
  const buildings = {
    fire: [-C, R],
    building: [C, R],
    electrical: [-C, 0],
    telecom: [C, 0],
    water: [-C, -R],
    accessibility: [C, -R],
  };
  return {
    id: 'grid',
    island: { hr: 15.8, hu: 35, chamfer: 4.5 },
    plazaScale: 0.72,
    buildings,
    roads: [
      [[0, -33.5], [0, 33.5]],
      [[-C, R], [C, R]],
      [[-C, 0], [C, 0]],
      [[-C, -R], [C, -R]],
    ],
    flags: [[3.4, 6.6], [-3.4, 6.6]],
    sign: [3.4, -6.6],
  };
}

export const PRESETS = { ring: ring(), grid: grid() };

/** 島體外緣（八角，畫面對齊），逆時針 */
export function islandOutline({ hr, hu, chamfer: c }) {
  return [
    [hr - c, hu],
    [-hr + c, hu],
    [-hr, hu - c],
    [-hr, -hu + c],
    [-hr + c, -hu],
    [hr - c, -hu],
    [hr, -hu + c],
    [hr, hu - c],
  ];
}

export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment([px, py], [[ax, ay], [bx, by]]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
