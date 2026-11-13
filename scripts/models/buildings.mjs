/**
 * 六棟建築（藍圖 §1.2）：底面 8×8 m、原點在底面中心、入口朝 +Z。
 * 每棟一個根節點（名稱＝建築 id，點擊判定用），主體 mesh 同名；
 * 會動或會被任務點亮的零件各自獨立成具名節點；解鎖才出現的放 unlock_*（網站端預設隱藏）。
 */
import { Parts, meshNode, group, THREE } from './kit.mjs';

const PLOT = 8;

function plot(p, color = 'road') {
  p.box(PLOT, 0.15, PLOT, color);
  // 地塊邊緣收一圈淺色石邊
  p.parapet(PLOT, PLOT, 0.18, 0.2, 'light');
  return p;
}

/* ───────────── 消防站：L 形量體＋監看塔＋雙車庫門 ───────────── */
export function fire() {
  const p = plot(new Parts());
  const B = 'fire';
  // 主車庫量體
  p.box(5.2, 4.4, 5, B, { x: -1.1, y: 0.15, z: -0.3 });
  p.box(5.4, 0.3, 5.2, 'light', { x: -1.1, y: 4.55, z: -0.3 }); // 簷口
  p.parapet(5.2, 5, 0.2, 0.5, B, { x: -1.1, y: 4.85, z: -0.3 });
  // 右後方辦公翼（L 形）
  p.box(2.2, 3.2, 3.2, B, { x: 2.6, y: 0.15, z: -1.2 });
  p.box(2.4, 0.25, 3.4, 'light', { x: 2.6, y: 3.35, z: -1.2 });
  p.windows('+z', { count: 1, w: 0.9, h: 1.0, gap: 0, y: 1.6, offset: 0.4, along: 2.6 });
  p.windows('+x', { count: 2, w: 0.8, h: 1.0, gap: 0.5, y: 1.6, offset: 3.7, along: -1.2 });
  // 雙車庫門（深色門片＋淺色橫條＋門框）
  for (const dx of [-2.3, 0.1]) {
    p.box(2.1, 2.9, 0.12, 'light', { x: dx, y: 0.15, z: 2.26 });
    p.box(1.8, 2.6, 0.14, 'dark', { x: dx, y: 0.15, z: 2.3 });
    for (let k = 0; k < 4; k++) p.box(1.8, 0.06, 0.16, 'light', { x: dx, y: 0.6 + k * 0.55, z: 2.31 });
  }
  // 二樓窗列
  p.windows('+z', { count: 3, w: 0.8, h: 0.8, gap: 0.65, y: 3.3, offset: 2.2, along: -1.1 });
  p.windows('-x', { count: 3, w: 0.8, h: 0.9, gap: 0.6, y: 2.4, offset: 3.7, along: -0.3 });
  // 監看塔（左後）
  const tx = -2.6;
  const tz = -2.0;
  p.box(1.9, 8.2, 1.9, B, { x: tx, y: 0.15, z: tz });
  p.box(2.3, 0.25, 2.3, 'light', { x: tx, y: 8.35, z: tz });
  p.box(2.1, 1.3, 2.1, 'light', { x: tx, y: 8.6, z: tz }); // 瞭望室
  p.box(2.15, 0.7, 2.15, 'dark', { x: tx, y: 8.85, z: tz }); // 瞭望窗帶
  p.cyl(0, 1.75, 1.1, 4, 'dark', { x: tx, y: 9.9, z: tz, ry: Math.PI / 4 }); // 四角錐頂
  p.windows('+z', { count: 1, w: 0.5, h: 0.8, gap: 0, y: 6.2, offset: tz + 0.95, along: tx });
  p.windows('+x', { count: 1, w: 0.5, h: 0.8, gap: 0, y: 6.2, offset: tx + 0.95, along: tz });
  // 前方小灌木
  p.tree('bush', { x: 3.2, z: 1.6 }, 0.7);

  const main = meshNode('fire', p);

  // 小紅消火栓：全場唯一建築上的 #FF0000 細節
  const h = new Parts()
    .cyl(0.2, 0.24, 0.55, 8, 'logoRed')
    .cyl(0.26, 0.26, 0.1, 8, 'logoRed', { y: 0.55 })
    .cyl(0.12, 0.2, 0.18, 8, 'logoRed', { y: 0.65 })
    .box(0.62, 0.12, 0.12, 'logoRed', { y: 0.32 });
  const hydrant = meshNode('fire_hydrant', h, { x: 2.7, y: 0.15, z: 3.2 });

  // F2：瞭望塔排煙（三團煙，網站端做上浮動畫）
  const smoke = group('unlock_fire_smoke', [0, 1, 2].map((i) =>
    meshNode(`fire_smoke_${i}`, new Parts().blob(0.45 + i * 0.12, 'light', {}, 0), { x: tx, y: 11.4 + i * 0.9, z: tz })
  ));

  // F3：消防車（磚紅車身＋淺色條紋；不用純紅）
  const t = new Parts()
    .box(1.5, 1.1, 2.4, B, { y: 0.45 })
    .box(1.5, 0.9, 0.9, B, { y: 0.45, z: 1.55 })
    .box(1.3, 0.45, 0.06, 'dark', { y: 0.95, z: 2.02 })
    .box(1.54, 0.12, 2.4, 'light', { y: 0.95 })
    .box(1.2, 0.18, 2.0, 'light', { y: 1.55 }) // 雲梯
    .box(0.4, 0.15, 0.25, 'yellow', { y: 1.35, z: 1.55 });
  for (const wx of [-0.72, 0.72]) for (const wz of [-0.8, 0.9]) t.cyl(0.3, 0.3, 0.22, 10, 'dark', { x: wx, y: 0.3, z: wz, rz: Math.PI / 2 });
  const truck = meshNode('unlock_fire_truck', t, { x: -1.0, y: 0.15, z: 1.0 });

  return group('fire', [main, hydrant, smoke, truck]);
}

/* ───────────── 建築技術館：方正立方體＋立面格柵＋入口雨庇＋圓規雕塑 ───────────── */
export function building() {
  const p = plot(new Parts());
  const B = 'building';
  p.box(6.4, 6.6, 5.8, B, { y: 0.15, z: -0.6 });
  p.box(6.6, 0.3, 6.0, 'light', { y: 6.75, z: -0.6 });
  p.parapet(6.4, 5.8, 0.2, 0.45, B, { y: 7.05, z: -0.6 });
  p.box(1.6, 0.9, 1.4, 'light', { x: -1.4, y: 7.05, z: -1.4 }); // 屋頂機房
  p.box(1.1, 0.6, 1.1, 'dark', { x: 1.6, y: 7.05, z: -1.8 });
  // 立面：深色玻璃帶＋淺色垂直格柵（11 片）
  p.box(5.6, 4.6, 0.1, 'dark', { y: 1.9, z: 2.32 });
  for (let i = 0; i < 11; i++) p.box(0.16, 4.8, 0.45, 'light', { x: -2.7 + i * 0.54, y: 1.8, z: 2.5 });
  p.box(5.8, 0.2, 0.5, 'light', { y: 6.5, z: 2.5 });
  // 側面窗列
  for (const y of [2.2, 4.4]) p.windows('+x', { count: 3, w: 0.9, h: 1.2, gap: 0.6, y, offset: 3.2, along: -0.6 });
  // 入口雨庇＋柱
  p.box(3.4, 0.2, 1.6, 'light', { y: 1.95, z: 3.1 });
  for (const x of [-1.5, 1.5]) p.box(0.15, 1.8, 0.15, 'dark', { x, y: 0.15, z: 3.75 });
  p.box(1.6, 1.7, 0.12, 'dark', { y: 0.15, z: 2.4 }); // 入口門
  p.tree('bush', { x: -3.1, z: 3.2 }, 0.7);

  const main = meshNode('building', p);

  // 圓規雕塑（B1 解鎖後緩慢轉動）
  const c = new Parts()
    .cyl(0.55, 0.65, 0.3, 8, 'light')
    .cyl(0.12, 0.12, 0.35, 8, 'dark', { y: 1.95 })
    .box(0.12, 1.8, 0.12, 'brand', { x: -0.28, y: 0.3, rz: -0.18 })
    .box(0.12, 1.8, 0.12, 'brand', { x: 0.28, y: 0.3, rz: 0.18 })
    .torus(0.42, 0.05, 'yellow', { y: 1.25, rx: Math.PI / 2 }, 14);
  const compass = meshNode('building_compass', c, { x: 2.7, y: 0.15, z: 3.4 });

  // B2：格柵間燈條（預設隱藏）
  const g = new Parts();
  for (let i = 0; i < 10; i++) g.box(0.08, 4.4, 0.06, 'yellow', { x: -2.43 + i * 0.54, y: 2.0, z: 2.4 });
  const glow = meshNode('unlock_building_grille', g);

  return group('building', [main, compass, glow]);
}

/* ───────────── 電信機房：矮方塊＋細高鐵塔＋信號環 ───────────── */
export function telecom() {
  const p = plot(new Parts());
  const B = 'telecom';
  p.box(5.6, 3.6, 5.0, B, { x: -0.8, y: 0.15, z: 0.4 });
  p.box(5.8, 0.25, 5.2, 'light', { x: -0.8, y: 3.75, z: 0.4 });
  p.parapet(5.6, 5.0, 0.18, 0.4, B, { x: -0.8, y: 4.0, z: 0.4 });
  p.box(1.3, 2.1, 0.12, 'dark', { x: -2.2, y: 0.15, z: 2.95 }); // 門
  p.box(1.7, 0.15, 0.7, 'light', { x: -2.2, y: 2.35, z: 3.2 });
  p.box(1.2, 0.5, 1.0, 'building', { x: -2.4, y: 4.0, z: -0.8 }); // 屋頂空調
  // 鐵塔（右後，地面起，四腳收分）
  const tx = 2.6;
  const tz = -2.3;
  const H = 11.5;
  const base = 0.75;
  const top = 0.22;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const lean = Math.atan((base - top) / H);
      p.box(0.1, H, 0.1, 'building', {
        x: tx + sx * (base + top) / 2,
        y: 0.15,
        z: tz + sz * (base + top) / 2,
        rz: sx * lean,
        rx: -sz * lean,
      });
    }
  for (let k = 1; k <= 6; k++) {
    const yy = (k / 7) * H;
    const r = base - ((base - top) * yy) / H;
    p.box(2 * r + 0.1, 0.07, 0.07, 'building', { x: tx, y: yy, z: tz - r });
    p.box(2 * r + 0.1, 0.07, 0.07, 'building', { x: tx, y: yy, z: tz + r });
    p.box(0.07, 0.07, 2 * r + 0.1, 'building', { x: tx - r, y: yy, z: tz });
    p.box(0.07, 0.07, 2 * r + 0.1, 'building', { x: tx + r, y: yy, z: tz });
  }
  p.cyl(0.05, 0.05, 1.6, 6, 'light', { x: tx, y: H, z: tz });
  for (const a of [0, 2.1, 4.2]) p.box(0.25, 0.9, 0.08, 'light', { x: tx + Math.sin(a) * 0.32, y: H - 1.4, z: tz + Math.cos(a) * 0.32, ry: a });
  p.tree('bush', { x: 3.1, z: 2.6 }, 0.75);

  const main = meshNode('telecom', p);

  // 窗（T2 解鎖點燈）
  const w = new Parts()
    .windows('+z', { count: 3, w: 0.8, h: 0.9, gap: 0.45, y: 1.6, offset: 2.9, along: 0.2 })
    .windows('+x', { count: 3, w: 0.8, h: 0.9, gap: 0.55, y: 1.6, offset: 2.0, along: 0.4 });
  const windows = meshNode('telecom_windows', w);

  // 藍色信號環（T1 啟動後脈動）
  const rings = group('telecom_rings', [
    meshNode('telecom_ring_a', new Parts().torus(0.75, 0.07, 'telecom', { rx: Math.PI / 2 }), { x: tx, y: H - 1.0, z: tz }),
    meshNode('telecom_ring_b', new Parts().torus(1.05, 0.06, 'telecom', { rx: Math.PI / 2 }), { x: tx, y: H - 2.1, z: tz }),
  ]);

  // T3：屋頂衛星碟
  const d = new Parts()
    .cyl(0.08, 0.1, 0.6, 6, 'dark')
    .cyl(0.75, 0.25, 0.25, 12, 'light', { y: 0.5, rx: -0.6 })
    .cyl(0.04, 0.04, 0.6, 5, 'dark', { y: 0.7, z: 0.25, rx: -0.6 });
  const dish = meshNode('unlock_telecom_dish', d, { x: 0.6, y: 4.0, z: 1.2 });

  return group('telecom', [main, windows, rings, dish]);
}

/* ───────────── 無障礙民眾中心：寬扁量體＋長斜坡＋扶手＋寬門＋導盲磚 ───────────── */
export function accessibility() {
  const p = plot(new Parts());
  const B = 'accessibility';
  p.box(7.2, 4.4, 5.2, B, { y: 0.15, z: -0.9 });
  p.box(7.5, 0.3, 5.5, 'light', { y: 4.55, z: -0.9 });
  // 斜屋頂（四坡，低矮）
  const roof = new THREE.CylinderGeometry(0.6, 4.6, 1.1, 4);
  roof.rotateY(Math.PI / 4);
  roof.scale(1.15, 1, 0.85);
  roof.translate(0, 0.55, 0);
  p.add(roof, B, { y: 4.85, z: -0.9 });
  // 入口門廊平台（高 0.45）＋寬門框
  p.box(3.0, 0.45, 1.6, 'road', { y: 0.15, z: 2.5 });
  p.box(3.0, 2.6, 0.15, 'light', { y: 0.6, z: 1.72 });
  p.box(3.6, 0.2, 1.8, 'light', { y: 3.2, z: 2.4 }); // 雨庇
  for (const x of [-1.6, 1.6]) p.box(0.14, 2.6, 0.14, 'light', { x, y: 0.6, z: 3.15 });
  // 斜坡：自左側沿 +X 上升到門廊
  p.wedge(1.3, 0.45, 2.4, 'road', { x: -2.7, y: 0.15, z: 2.65 });
  // 扶手（兩側）
  for (const z of [2.0, 3.3]) {
    p.box(2.4, 0.06, 0.06, 'light', { x: -2.7, y: 1.05, z, rz: 0.18 });
    for (const x of [-3.8, -2.7, -1.6]) p.box(0.06, 0.85 + (x + 3.8) * 0.19, 0.06, 'light', { x, y: 0.15, z });
  }
  // 窗
  p.windows('+z', { count: 1, w: 1.0, h: 1.1, gap: 0.5, y: 1.4, offset: 1.7, along: -2.7 });
  p.windows('+z', { count: 1, w: 1.0, h: 1.1, gap: 0.5, y: 1.4, offset: 1.7, along: 2.7 });
  p.windows('+z', { count: 3, w: 1.0, h: 0.9, gap: 0.9, y: 3.3, offset: 1.7, along: 0 });
  p.windows('+x', { count: 3, w: 0.9, h: 1.1, gap: 0.5, y: 1.4, offset: 3.6, along: -0.9 });
  p.windows('+x', { count: 3, w: 0.9, h: 0.9, gap: 0.5, y: 3.3, offset: 3.6, along: -0.9 });
  // 背面與另一側窗（建築大門朝向廣場，背面會朝向鏡頭）
  p.windows('-z', { count: 3, w: 1.0, h: 1.1, gap: 0.9, y: 1.4, offset: 3.5, along: 0 });
  p.windows('-z', { count: 3, w: 1.0, h: 0.9, gap: 0.9, y: 3.3, offset: 3.5, along: 0 });
  p.windows('-x', { count: 3, w: 0.9, h: 1.1, gap: 0.5, y: 1.4, offset: 3.6, along: -0.9 });
  p.windows('-x', { count: 3, w: 0.9, h: 0.9, gap: 0.5, y: 3.3, offset: 3.6, along: -0.9 });
  p.tree('bush', { x: 3.2, z: 3.2 }, 0.7);

  const main = meshNode('accessibility', p);

  // A2：寬門（左右兩片，解鎖後滑開）
  const doorL = meshNode('access_door_l', new Parts().box(1.3, 2.3, 0.1, 'dark'), { x: -0.66, y: 0.6, z: 1.8 });
  const doorR = meshNode('access_door_r', new Parts().box(1.3, 2.3, 0.1, 'dark'), { x: 0.66, y: 0.6, z: 1.8 });

  // A1：黃色導盲磚（地塊前緣 → 斜坡起點 → 門口）
  const t = new Parts()
    .box(0.4, 0.04, 2.2, 'yellow', { x: 0, y: 0.6, z: 2.4 })
    .box(0.4, 0.04, 0.5, 'yellow', { x: -3.6, y: 0.15, z: 3.5 })
    .box(3.4, 0.04, 0.4, 'yellow', { x: -1.7, y: 0.15, z: 3.75 });
  const tactile = meshNode('access_tactile', t);

  // 入口旁高對比導視牌（A3 的找尋目標；藍底白圖）
  const s = new Parts()
    .box(0.1, 1.3, 0.1, 'dark')
    .box(0.8, 0.8, 0.08, 'brand', { y: 1.3 })
    .box(0.5, 0.06, 0.03, 'light', { y: 1.55, z: 0.05 })
    .box(0.06, 0.4, 0.03, 'light', { x: -0.1, y: 1.5, z: 0.05 });
  s.add(new THREE.TorusGeometry(0.17, 0.035, 4, 12), 'light', { y: 1.52, z: 0.05 });
  const sign = meshNode('access_wayfinding', s, { x: 2.3, y: 0.15, z: 3.0 });

  return group('accessibility', [main, doorL, doorR, tactile, sign]);
}

/* ───────────── 給排水泵房：矮方塊＋高架水塔＋外露管線＋藍色水渠 ───────────── */
export function water() {
  const p = plot(new Parts());
  const B = 'water';
  p.box(4.8, 3.0, 4.4, B, { x: -1.3, y: 0.15, z: 0.1 });
  p.box(5.0, 0.25, 4.6, 'light', { x: -1.3, y: 3.15, z: 0.1 });
  p.box(1.2, 2.0, 0.12, 'dark', { x: -2.2, y: 0.15, z: 2.35 });
  p.windows('+z', { count: 1, w: 1.0, h: 0.9, gap: 0, y: 1.5, offset: 2.3, along: -0.4 });
  p.windows('-x', { count: 2, w: 0.9, h: 0.9, gap: 0.6, y: 1.5, offset: 3.7, along: 0.1 });
  // 高架水塔（右後）
  const tx = 2.4;
  const tz = -2.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(0.16, 5.0, 0.16, 'dark', { x: tx + sx * 0.8, y: 0.15, z: tz + sz * 0.8 });
  for (const y of [1.8, 3.6]) p.parapet(1.8, 1.8, 0.08, 0.08, 'dark', { x: tx, y, z: tz });
  p.cyl(1.35, 1.35, 2.3, 12, B, { x: tx, y: 5.15, z: tz });
  p.cyl(1.4, 1.4, 0.15, 12, 'light', { x: tx, y: 5.1, z: tz });
  p.cyl(0.1, 1.5, 0.9, 12, 'dark', { x: tx, y: 7.45, z: tz });
  // 外露管線（淺色管＋深色法蘭）
  p.cyl(0.14, 0.14, 4.9, 8, 'light', { x: tx - 0.55, y: 0.15, z: tz + 0.55 });
  p.cyl(0.14, 0.14, 2.2, 8, 'light', { x: 0.1, y: 1.4, z: tz + 0.55, rz: Math.PI / 2 });
  p.cyl(0.14, 0.14, 1.6, 8, 'light', { x: 1.15, y: 0.4, z: 1.2, rx: Math.PI / 2 });
  p.cyl(0.14, 0.14, 1.2, 8, 'light', { x: 1.15, y: 0.15, z: 1.95 });
  for (const y of [0.9, 2.4, 4.0]) p.cyl(0.22, 0.22, 0.12, 8, 'dark', { x: tx - 0.55, y, z: tz + 0.55 });
  p.box(1.0, 0.8, 0.9, 'building', { x: 1.3, y: 0.15, z: 0.3 }); // 泵浦
  p.cyl(0.08, 0.08, 1.0, 6, 'dark', { x: 1.5, y: 0.95, z: 0.3 }); // 通氣管（W3 冒泡處）
  // 前方藍色水渠（淺色渠緣）
  p.box(7.4, 0.2, 1.2, 'light', { y: 0.15, z: 3.15 });
  p.box(7.0, 0.22, 0.8, 'waterBlue', { y: 0.16, z: 3.15 });

  const main = meshNode('water', p);

  // W1：水塔水位計（網站端由 0 長到滿）
  const gauge = meshNode('water_tank_gauge', new Parts().box(0.35, 2.0, 0.06, 'waterBlue'), { x: tx + 0.5, y: 5.3, z: tz + 1.29, ry: 0.36 });
  // W2：水渠流水（淺色水紋，網站端沿渠移動）
  const f = new Parts();
  for (let i = 0; i < 6; i++) f.box(0.5, 0.03, 0.12, 'light', { x: -3 + i * 1.2, y: 0.39, z: 3.05 + (i % 2) * 0.22 });
  const flow = meshNode('unlock_water_flow', f);
  // W3：通氣管冒泡泡
  const bubbles = group('unlock_water_bubbles', [0, 1, 2, 3].map((i) =>
    meshNode(`water_bubble_${i}`, new Parts().blob(0.13 + (i % 2) * 0.05, 'waterBlue', {}, 0), { x: 1.5, y: 2.1 + i * 0.4, z: 0.3 })
  ));

  return group('water', [main, gauge, flow, bubbles]);
}

/* ───────────── 電氣變電所：圍籬內多個圓潤小量體＋絕緣子串＋矮圍籬 ───────────── */
export function electrical() {
  const p = plot(new Parts());
  const B = 'electrical';
  // 矮圍籬（前方留出入口）
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    for (const y of [0.45, 0.85]) p.box(0.06, 0.06, len, 'dark', { x: cx, y, z: cz, ry });
    const n = Math.max(2, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      p.box(0.1, 1.0, 0.1, 'dark', { x: x0 + (x1 - x0) * t, y: 0.15, z: z0 + (z1 - z0) * t });
    }
  };
  fence(-3.6, -3.6, 3.6, -3.6);
  fence(-3.6, -3.6, -3.6, 3.6);
  fence(3.6, -3.6, 3.6, 3.6);
  fence(-3.6, 3.6, -1.0, 3.6);
  fence(1.0, 3.6, 3.6, 3.6);
  // 主變壓器（圓潤：方塊＋圓頂＋側面散熱片）
  const mx = -1.2;
  const mz = -0.4;
  p.box(2.6, 2.0, 2.0, B, { x: mx, y: 0.15, z: mz });
  p.cyl(1.0, 1.0, 2.6, 10, B, { x: mx, y: 2.15, z: mz, rz: Math.PI / 2, sy: 1, sx: 1, sz: 0.42 });
  for (let i = 0; i < 4; i++) p.box(0.1, 1.5, 1.6, 'dark', { x: mx - 1.4 - i * 0.0, y: 0.35, z: mz - 0.6 + i * 0.4, sx: 1 });
  p.box(2.0, 0.08, 0.05, 'light', { x: mx, y: 0.6, z: mz + 1.03 });
  // 小變壓器兩座
  for (const [x, z, s] of [[1.9, -1.6, 0.8], [1.9, 1.2, 0.7]]) {
    p.box(1.6 * s + 0.4, 1.6 * s, 1.4 * s + 0.3, B, { x, y: 0.15, z });
    p.blob(0.75 * s, B, { x, y: 0.15 + 1.6 * s, z, sy: 0.5 }, 1);
  }
  // 細圓柱電桿＋橫擔
  p.cyl(0.12, 0.15, 6.0, 6, 'light', { x: -2.9, y: 0.15, z: -2.9 });
  p.box(2.2, 0.14, 0.14, 'dark', { x: -2.9, y: 5.6, z: -2.9, ry: Math.PI / 4 });
  p.tree('bush', { x: 3.0, z: 3.0 }, 0.6);

  const main = meshNode('electrical', p);

  // 友善表情（E1：眨眼）
  const eyes = group('electrical_face', [
    meshNode('electrical_eye_l', new Parts().box(0.22, 0.36, 0.06, 'dark'), { x: mx - 0.45, y: 1.35, z: mz + 1.03 }),
    meshNode('electrical_eye_r', new Parts().box(0.22, 0.36, 0.06, 'dark'), { x: mx + 0.45, y: 1.35, z: mz + 1.03 }),
    meshNode('electrical_smile', new Parts().torus(0.28, 0.04, 'dark', { rz: Math.PI }, 10), { x: mx, y: 1.05, z: mz + 1.03 }),
  ]);
  // 絕緣子串（E2：亮燈）
  const ins = new Parts();
  for (const [x, z] of [[mx - 0.8, mz], [mx, mz], [mx + 0.8, mz], [1.9, -1.6], [1.9, 1.2]]) {
    const y0 = x < 0 ? 3.15 : 1.75;
    for (let k = 0; k < 4; k++) ins.cyl(0.16, 0.16, 0.08, 8, 'light', { x, y: y0 + k * 0.17, z });
    ins.cyl(0.05, 0.05, 0.75, 6, 'light', { x, y: y0, z });
  }
  const insulators = meshNode('electrical_insulators', ins);
  // E3：充電樁（變電所旁，圍籬外前方）
  const c = new Parts()
    .box(0.6, 1.4, 0.45, 'light')
    .box(0.4, 0.4, 0.05, 'brand', { y: 0.8, z: 0.24 })
    .box(0.7, 0.1, 0.55, 'dark', { y: 1.4 })
    .cyl(0.04, 0.04, 0.8, 5, 'dark', { x: 0.36, y: 0.3, z: 0.1 });
  const charger = meshNode('unlock_ev_charger', c, { x: 0, y: 0.15, z: 3.2 });

  return group('electrical', [main, eyes, insulators, charger]);
}

export const BUILDINGS = { fire, building, telecom, accessibility, water, electrical };
