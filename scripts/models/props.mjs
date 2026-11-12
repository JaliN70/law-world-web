/**
 * 園區道具：中央廣場、樹、路燈、旗幟、無障礙標誌牌。
 * 地形與道路依布局在網站端即時產生，不在這裡。
 */
import { Parts, meshNode, group, THREE } from './kit.mjs';

const hex = (r, h, color, at = {}) => new Parts().cyl(r, r, h, 6, color, { ry: Math.PI / 6, ...at });

/** 中央廣場：#1F4E79 六角基座＋Logo 紅小六角（藍圖 §1.1：場景中紅色只在此與消火栓） */
export function plaza() {
  const base = new Parts();
  base.cyl(6.6, 6.6, 0.12, 6, 'road', { ry: Math.PI / 6 });
  base.cyl(5.4, 5.6, 0.32, 6, 'light', { ry: Math.PI / 6, y: 0.12 });
  base.cyl(4.9, 5.0, 0.5, 6, 'brand', { ry: Math.PI / 6, y: 0.12 });
  // 基座同心刻線（淺色細環）
  for (const r of [3.3, 4.2]) {
    const ring = new THREE.RingGeometry(r - 0.06, r, 6, 1, Math.PI / 6);
    ring.rotateX(-Math.PI / 2);
    base.add(ring, 'light', { y: 0.63 });
  }
  base.cyl(2.4, 2.6, 0.18, 6, 'brand', { ry: Math.PI / 6, y: 0.62 });
  // 六條通往道路的淺色踏階
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    base.box(1.6, 0.3, 1.0, 'light', { x: Math.sin(a) * 5.35, y: 0.12, z: Math.cos(a) * 5.35, ry: a });
  }
  const logo = hex(1.35, 0.32, 'logoRed', { y: 0 });
  return group('plaza', [meshNode('plaza_base', base), meshNode('plaza_logo', logo, { y: 0.8 })]);
}

export function treeRound() {
  return group('tree_round', [meshNode('tree_round_mesh', new Parts().tree('round'))]);
}
export function treeCone() {
  return group('tree_cone', [meshNode('tree_cone_mesh', new Parts().tree('cone'))]);
}
export function bush() {
  return group('bush', [meshNode('bush_mesh', new Parts().tree('bush').blob(0.4, 'grass', { x: 0.5, y: 0.3, z: 0.2 }, 0))]);
}

/** 園區路燈（三域巡禮解鎖）：燈頭獨立，夜景時發光 */
export function lamp() {
  const post = new Parts()
    .cyl(0.18, 0.22, 0.2, 6, 'dark')
    .cyl(0.06, 0.07, 2.6, 6, 'dark', { y: 0.2 })
    .box(0.5, 0.08, 0.08, 'dark', { x: 0.2, y: 2.75 });
  const head = new Parts().box(0.36, 0.28, 0.36, 'yellow').box(0.44, 0.08, 0.44, 'dark', { y: 0.28 });
  return group('lamp', [meshNode('lamp_post', post), meshNode('lamp_head', head, { x: 0.4, y: 2.45 })]);
}

/** 廣場旗幟（防火雙視角解鎖） */
export function flag() {
  const pole = new Parts().cyl(0.25, 0.3, 0.2, 6, 'light').cyl(0.05, 0.05, 4.2, 6, 'light', { y: 0.2 }).blob(0.1, 'yellow', { y: 4.45 }, 0);
  const cloth = new Parts().box(1.5, 0.95, 0.04, 'brand').box(1.5, 0.12, 0.05, 'light', { y: 0.42 });
  return group('flag', [meshNode('flag_pole', pole), meshNode('flag_cloth', cloth, { x: 0.78, y: 3.25 })]);
}

/** 廣場無障礙標誌牌（A3）：藍底白圖（規範 902.2 建議配色） */
export function accessSign() {
  const p = new Parts()
    .box(0.12, 1.6, 0.12, 'dark')
    .box(1.0, 1.0, 0.08, 'brand', { y: 1.5 })
    .blob(0.08, 'light', { x: -0.05, y: 2.22, z: 0.05 }, 0)
    .box(0.08, 0.32, 0.03, 'light', { x: -0.08, y: 1.82, z: 0.05 })
    .box(0.28, 0.06, 0.03, 'light', { x: 0.02, y: 1.84, z: 0.05 });
  const wheel = new THREE.TorusGeometry(0.2, 0.035, 4, 14);
  p.add(wheel, 'light', { x: 0.0, y: 1.72, z: 0.06 });
  return group('access_sign', [meshNode('access_sign_mesh', p)]);
}

/**
 * 行人（低多邊形，約 1.7 m）：原點在兩腳之間、面向 +Z。
 * 網站端以 InstancedMesh 沿道路行走；四種上衣配色取自園區色盤。
 */
function person(name, shirt, pants) {
  const p = new Parts()
    .box(0.17, 0.78, 0.2, pants, { x: -0.11 })
    .box(0.17, 0.78, 0.2, pants, { x: 0.11 })
    .box(0.5, 0.62, 0.3, shirt, { y: 0.78 })
    .box(0.12, 0.56, 0.14, shirt, { x: -0.32, y: 0.82 })
    .box(0.12, 0.56, 0.14, shirt, { x: 0.32, y: 0.82 })
    .blob(0.17, 'soil', { y: 1.56 }, 1)
    .box(0.3, 0.1, 0.3, 'dark', { y: 1.66 });
  return group(name, [meshNode(`${name}_mesh`, p)]);
}

export const PROPS = {
  plaza,
  tree_round: treeRound,
  tree_cone: treeCone,
  bush,
  lamp,
  flag,
  access_sign: accessSign,
  person_a: () => person('person_a', 'telecom', 'dark'),
  person_b: () => person('person_b', 'yellow', 'brand'),
  person_c: () => person('person_c', 'accessibility', 'dark'),
  person_d: () => person('person_d', 'fire', 'building'),
};
