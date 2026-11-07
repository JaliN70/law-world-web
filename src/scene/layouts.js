/** 群島 v1.2 — 六島環狀座標（手機／桌機同一套） */

export const BUILDING_NAMES = [
  'fire',
  'building',
  'telecom',
  'accessibility',
  'water',
  'electrical',
];

export const ISLAND_ORDER = ['fire', 'building', 'telecom', 'accessibility', 'water', 'electrical'];

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
export const ISLAND_GRASS_R = 12;
export const LOGO_PLATFORM_R = 4;

/**
 * 順時針：01 消防北、02 建築技術、03 電信、04 無障礙、05 給排水、06 電氣
 * 世界 −Z 為畫面上方。
 */
export const ISLAND_POSITIONS = {
  fire: [0, 0, -34],
  building: [29.444864, 0, -17],
  telecom: [29.444864, 0, 17],
  accessibility: [0, 0, 34],
  water: [-29.444864, 0, 17],
  electrical: [-29.444864, 0, -17],
};

export function islandYawTowardCenter(id) {
  const [wx, , wz] = ISLAND_POSITIONS[id];
  return Math.atan2(-wx, -wz);
}

/** @deprecated 群島版不再區分手機布局座標 */
export function pickLayout() {
  const out = {};
  ISLAND_ORDER.forEach((id) => {
    out[id] = [0, 0, 0];
  });
  return out;
}

export function computeArchipelagoBounds({ pad = 14 } = {}) {
  const R = ARCHIPELAGO_RING_R + ISLAND_GRASS_R + pad;
  return {
    minX: -R,
    maxX: R,
    minZ: -R,
    maxZ: R,
    spanX: 2 * R,
    spanZ: 2 * R,
    islandRadius: R,
    maxY: 16,
  };
}

export function computeIslandBounds(id, { pad = 3.5 } = {}) {
  const [cx, , cz] = ISLAND_POSITIONS[id];
  const r = ISLAND_GRASS_R + pad;
  return {
    minX: cx - r,
    maxX: cx + r,
    minZ: cz - r,
    maxZ: cz + r,
    spanX: 2 * r,
    spanZ: 2 * r,
    islandRadius: r,
    maxY: 14,
    centerX: cx,
    centerZ: cz,
  };
}

/** 相容舊呼叫 */
export function computeWorldBounds() {
  return computeArchipelagoBounds();
}
