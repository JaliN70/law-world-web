import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { buildAllBuildings } from './buildings.js';
import { ISLAND_ORDER, ISLAND_POSITIONS, islandYawTowardCenter, setLayoutPreset } from './layouts.js';
import { createWaterSurface } from './waterSurface.js';
import { CAM_DIST } from './camera.js';

export { setBuildingSaturation } from './parkAssets.js';

/**
 * 建立場景骨架：燈光、水面、六個島嶼 host 與 MVP 色塊建築（模型載入前／失敗時的備援）。
 * 地形與正式建築由 parkAssets.installPark() 之後裝入。
 */
export function createWorldScene({ isMobile, reducedMotion }) {
  setLayoutPreset(isMobile ? 'grid' : 'ring');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8e6fa);
  // 霧距離跟著固定相機距離走，只淡化遠方海面邊緣
  scene.fog = new THREE.Fog(0xb8e6fa, CAM_DIST + 60, CAM_DIST + 200);

  const ambient = new THREE.AmbientLight(0xffffff, 0.78);
  const sun = new THREE.DirectionalLight(0xfff6e6, 0.88);
  sun.position.set(30, 50, 20);
  scene.add(ambient, sun);

  const water = createWaterSurface({ reducedMotion });
  scene.add(water);

  const archipelago = new THREE.Group();
  archipelago.name = 'archipelago';
  const islands = {};
  const layout = Object.fromEntries(ISLAND_ORDER.map((id) => [id, [0, 0, 0]]));
  const { map } = buildAllBuildings(layout);

  ISLAND_ORDER.forEach((id) => {
    const host = new THREE.Group();
    const [wx, , wz] = ISLAND_POSITIONS[id];
    host.position.set(wx, 0, wz);
    host.rotation.y = islandYawTowardCenter(id);
    host.name = `island_host_${id}`;
    if (map[id]) host.add(map[id]);
    islands[id] = host;
    archipelago.add(host);
  });
  scene.add(archipelago);

  return {
    scene,
    archipelago,
    islands,
    islandPickables: [],
    buildings: map,
    clickable: Object.values(map),
    water,
    materials: null,
  };
}

const UNLOCK_DECO_HIGHLIGHT = {
  unlock_fire_hydrant: { names: ['deco_fire_hydrant'], emissive: PALETTE.logoRed, intensity: 0.18 },
  unlock_building_compass: { names: ['deco_building_compass'], emissive: PALETTE.brand, intensity: 0.12 },
  unlock_access_tactile: { names: ['deco_access_tactile'], emissive: PALETTE.tactileYellow, intensity: 0.22 },
  unlock_water_tower: { names: ['deco_water_tank'], emissive: PALETTE.waterBar, intensity: 0.2 },
  unlock_electrical_glow: {
    names: ['deco_electrical_insulator', 'deco_electrical_charger'],
    emissive: PALETTE.electrical,
    intensity: 0.14,
  },
  unlock_telecom_ring: { names: ['deco_telecom_ring1'], emissive: PALETTE.telecom, intensity: 0.1 },
  lamp_dock: { names: ['lamp_dock'], emissive: PALETTE.brand, intensity: 0.25 },
};

/** 只在第一次解鎖時 clone 一次材質（舊版每次呼叫都 clone，材質會越積越多） */
function applyDecoHighlight(mesh, { emissive, intensity }) {
  if (!mesh.isMesh || !mesh.material || mesh.userData.highlighted) return;
  mesh.material = mesh.material.clone();
  mesh.material.emissive = new THREE.Color(emissive);
  mesh.material.emissiveIntensity = intensity;
  mesh.userData.highlighted = true;
}

export function applyUnlocks(scene, unlocks) {
  scene.traverse((o) => {
    for (const [key, spec] of Object.entries(UNLOCK_DECO_HIGHLIGHT)) {
      if (unlocks[key] && spec.names.includes(o.name)) {
        o.visible = true;
        applyDecoHighlight(o, spec);
      }
    }
    if (o.name?.startsWith('unlock_flag_') && unlocks[o.name]) {
      o.visible = true;
      applyDecoHighlight(o, { emissive: PALETTE.logoRed, intensity: 0.15 });
    }
    if (unlocks.night_mode && (o.name === 'lamp_dock' || o.name === 'lamp_window')) {
      o.visible = true;
      if (o.isMesh) applyDecoHighlight(o, { emissive: 0xffe8a8, intensity: 0.35 });
    }
  });
}

/** 版面切換時釋放舊場景自建的幾何與材質（park.glb 模板與共用材質保留重用） */
export function disposeWorld(world) {
  const keep = new Set(world.materials ? Object.values(world.materials) : []);
  world.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.userData.parkTemplate) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (m && !keep.has(m)) m.dispose();
    });
  });
}
