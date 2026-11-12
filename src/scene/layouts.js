/**
 * 群島布局預設組（layout preset）— 藍圖 §1.1：
 *   桌機橫式：六角環狀（六島 v1.2，環半徑 34 m）
 *   手機直式：2×3（左右兩欄各三座，中央 Logo 平台在中段）
 * 兩種布局共用同一份場景與模型，只切換島嶼座標。
 */

export const BUILDING_NAMES = ['fire', 'building', 'telecom', 'accessibility', 'water', 'electrical'];
export const ISLAND_ORDER = BUILDING_NAMES;

export const LABELS_ZH = {
  fire: '消防',
  building: '建築技術',
  telecom: '電信',
  accessibility: '無障礙',
  water: '給排水',
  electrical: '電氣',
};

/** 建築 GLB 占地半徑（8×8 m 基座） */
export const BUILDING_HALF = 4;
export const ARCHIPELAGO_RING_R = 34;
/** 島外緣（含岸緣微擾）；碼頭另外伸到本地 +Z 13.8 m */
export const ISLAND_GRASS_R = 12.3;
export const ISLAND_DOCK_TIP = 13.8;
export const ISLAND_CLIFF_BOTTOM = -5.7;
/** 建築最高約 14 m，另留標籤空間 */
export const BUILDING_TOP = 14;
export const LOGO_PLATFORM_R = 4;

const RING = {
  fire: [0, 0, -34],
  building: [29.444864, 0, -17],
  telecom: [29.444864, 0, 17],
  accessibility: [0, 0, 34],
  water: [-29.444864, 0, 17],
  electrical: [-29.444864, 0, -17],
};

/**
 * 等角相機方位角 45°：畫面右 = 世界 (1,0,-1)/√2，畫面上（地面方向）= 世界 (-1,0,-1)/√2。
 * 以畫面座標排 2×3，再換回世界座標，讓手機直式上看起來是整齊的兩欄三列。
 *   GRID_COL：左右欄中心離中軸距離（m）。碼頭朝中心，中段兩島碼頭尖端距平台約 0.7 m。
 *   GRID_ROW：列距（沿地面，m）；俯角 35° 時畫面上約縮成 0.57 倍。
 */
const GRID_COL = 18.5;
const GRID_ROW = 62;
const S = Math.SQRT1_2;
function gridToWorld(col, row) {
  // col: -1 左 / +1 右；row: -1 上 / 0 中 / +1 下
  const r = col * GRID_COL;
  const u = -row * GRID_ROW;
  return [r * S - u * S, 0, -r * S - u * S];
}
/** 依環狀順時針順序填入兩欄：上排 消防｜建築技術、中排 電氣｜電信、下排 給排水｜無障礙 */
const GRID = {
  fire: gridToWorld(-1, -1),
  building: gridToWorld(1, -1),
  electrical: gridToWorld(-1, 0),
  telecom: gridToWorld(1, 0),
  water: gridToWorld(-1, 1),
  accessibility: gridToWorld(1, 1),
};

export const LAYOUT_PRESETS = { ring: RING, grid: GRID };

/** 目前布局的島嶼座標（就地更新，所有 import 端都會看到新值） */
export const ISLAND_POSITIONS = { ...RING };
let currentPreset = 'ring';

export function setLayoutPreset(preset) {
  currentPreset = LAYOUT_PRESETS[preset] ? preset : 'ring';
  Object.assign(ISLAND_POSITIONS, LAYOUT_PRESETS[currentPreset]);
  return currentPreset;
}

export function getLayoutPreset() {
  return currentPreset;
}

export function islandYawTowardCenter(id) {
  const [wx, , wz] = ISLAND_POSITIONS[id];
  return Math.atan2(-wx, -wz);
}

/** 世界座標點 → 最近的島（在島緣＋碼頭範圍內才算） */
export function islandAtPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const id of ISLAND_ORDER) {
    const [cx, , cz] = ISLAND_POSITIONS[id];
    const d = Math.hypot(x - cx, z - cz);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return bestD <= ISLAND_DOCK_TIP + 0.5 ? best : null;
}
