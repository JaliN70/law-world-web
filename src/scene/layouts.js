/** 建築座標預設（公尺，原點為廣場中心） */

export const BUILDING_NAMES = [
  'fire',
  'building',
  'telecom',
  'accessibility',
  'water',
  'electrical',
];

/** 場景中標籤短名稱（設計稿） */
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

/** 手機直式 2×3，縮小橫向間距避免裁切 */
export const LAYOUT_MOBILE = {
  fire: [-9, 0, 8],
  building: [9, 0, 8],
  telecom: [-9, 0, 0],
  accessibility: [9, 0, 0],
  water: [-9, 0, -8],
  electrical: [9, 0, -8],
};

const R_DESKTOP = 17;
const HEX_ANGLES = [90, 30, -30, -90, -150, 150];
const ORDER = ['fire', 'building', 'telecom', 'accessibility', 'water', 'electrical'];

export function layoutDesktop() {
  const out = {};
  ORDER.forEach((id, i) => {
    const rad = (HEX_ANGLES[i] * Math.PI) / 180;
    out[id] = [Math.cos(rad) * R_DESKTOP, 0, -Math.sin(rad) * R_DESKTOP];
  });
  return out;
}

export function pickLayout(isMobile) {
  return isMobile ? { ...LAYOUT_MOBILE } : layoutDesktop();
}

/**
 * 計算布局 + 島體外框，供相機 frustum 擬合。
 */
export function computeWorldBounds(layout, { islandRadius = 32, maxBuildingY = 11 } = {}) {
  let minX = -islandRadius;
  let maxX = islandRadius;
  let minZ = -islandRadius;
  let maxZ = islandRadius;

  for (const [x, , z] of Object.values(layout)) {
    minX = Math.min(minX, x - BUILDING_HALF);
    maxX = Math.max(maxX, x + BUILDING_HALF);
    minZ = Math.min(minZ, z - BUILDING_HALF);
    maxZ = Math.max(maxZ, z + BUILDING_HALF);
  }

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    maxY: maxBuildingY,
    islandRadius,
    spanX: maxX - minX,
    spanZ: maxZ - minZ,
  };
}
