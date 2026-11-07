/** 建築座標預設（公尺，原點為廣場中心） */

export const BUILDING_NAMES = [
  'fire',
  'building',
  'telecom',
  'accessibility',
  'water',
  'electrical',
];

export const LABELS_ZH = {
  fire: '消防站',
  building: '建築技術館',
  telecom: '電信機房',
  accessibility: '無障礙民眾中心',
  water: '給排水泵房',
  electrical: '電氣變電所',
};

/** 手機直式 2×3：左欄上→下 fire, telecom, water；右欄 building, accessibility, electrical */
export const LAYOUT_MOBILE = {
  fire: [-14, 0, 10],
  building: [14, 0, 10],
  telecom: [-14, 0, 0],
  accessibility: [14, 0, 0],
  water: [-14, 0, -10],
  electrical: [14, 0, -10],
};

/** 桌機六邊環狀 */
const R = 22;
const HEX_ANGLES = [90, 30, -30, -90, -150, 150];
const ORDER = ['fire', 'building', 'telecom', 'accessibility', 'water', 'electrical'];

export function layoutDesktop() {
  const out = {};
  ORDER.forEach((id, i) => {
    const rad = (HEX_ANGLES[i] * Math.PI) / 180;
    out[id] = [Math.cos(rad) * R, 0, -Math.sin(rad) * R];
  });
  return out;
}

export function pickLayout(isMobile) {
  return isMobile ? { ...LAYOUT_MOBILE } : layoutDesktop();
}
