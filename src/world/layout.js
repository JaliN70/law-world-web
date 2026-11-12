/**
 * 布局預設組（藍圖 §1.1）。兩種布局共用同一份場景，只切換座標：
 *   ring：桌機橫式，六棟等距環繞中央廣場（畫面上呈六角）
 *   ringTall：手機直式，同樣環狀、但拉高收窄以符合直式畫面
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
/** 建築放大倍率：藍圖效果圖中建築幾乎佔滿島面 */
export const BUILDING_SCALE = 1.2;
export const PLOT_HALF = 4 * BUILDING_SCALE;
export const PLAZA_R = 7.2;
export const ROAD_W = 3.4;

/**
 * 環狀布局：六棟等距環繞中央廣場（畫面上呈六角）。
 * rx／ru 為畫面左右／上下的半徑：桌機較寬；手機直式拉高、收窄，讓建築在窄螢幕上夠大。
 */
function ring({ id, rx, ru, island, plazaScale = 1, flags, sign }) {
  const buildings = {};
  AREA_ORDER.forEach((area, i) => {
    const a = ((90 - 60 * i) * Math.PI) / 180; // 消防在正上方，順時針
    buildings[area] = [rx * Math.cos(a), ru * Math.sin(a)];
  });
  return {
    id,
    island,
    plazaScale,
    buildings,
    roads: AREA_ORDER.map((area) => [[0, 0], buildings[area]]),
    flags,
    sign,
  };
}

export const PRESETS = {
  // 桌機橫式
  ring: ring({ id: 'ring', rx: 16.5, ru: 19, island: { hr: 24, hu: 28.5, chamfer: 9 }, flags: [[7.4, 0], [-7.4, 0]], sign: [4.4, -8.6] }),
  // 手機直式：同樣是環狀，只是較高較窄
  ringTall: ring({
    id: 'ringTall',
    rx: 11.5,
    ru: 24,
    island: { hr: 18.5, hu: 32, chamfer: 6 },
    plazaScale: 0.8,
    flags: [[6, 0], [-6, 0]],
    sign: [3.4, -7.6],
  }),
};

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
