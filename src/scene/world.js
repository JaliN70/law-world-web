import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { buildAllBuildings } from './buildings.js';
import {
  ISLAND_ORDER,
  ISLAND_POSITIONS,
  islandYawTowardCenter,
  pickLayout,
  computeArchipelagoBounds,
} from './layouts.js';
import { createWaterSurface } from './waterSurface.js';
import { applyLogoInlayGlow } from './logoPlatform.js';

export function createWorldScene({ isMobile, reducedMotion }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8e6fa);
  scene.fog = new THREE.Fog(0xb8e6fa, 120, 220);

  const ambient = new THREE.AmbientLight(0xffffff, 0.78);
  const sun = new THREE.DirectionalLight(0xfff6e6, 0.88);
  sun.position.set(30, 50, 20);
  scene.add(ambient, sun);

  const water = createWaterSurface({ reducedMotion });
  scene.add(water);

  const archipelago = new THREE.Group();
  archipelago.name = 'archipelago';

  const islands = {};
  const islandPickables = [];
  const layout = pickLayout();
  const { root, map } = buildAllBuildings(layout);

  ISLAND_ORDER.forEach((id) => {
    const islandGroup = new THREE.Group();
    const [wx, , wz] = ISLAND_POSITIONS[id];
    islandGroup.position.set(wx, 0, wz);
    islandGroup.rotation.y = islandYawTowardCenter(id);

    const placement = map[id];
    if (placement) {
      root.remove(placement);
      islandGroup.add(placement);
    }

    islandGroup.name = `island_host_${id}`;
    islands[id] = islandGroup;
    archipelago.add(islandGroup);
  });

  scene.add(archipelago);

  const buildings = map;
  const clickable = Object.values(map);
  const worldBounds = computeArchipelagoBounds({ pad: isMobile ? 16 : 12 });

  return {
    scene,
    archipelago,
    islands,
    islandPickables,
    buildings,
    clickable,
    pulseMeshes: [],
    worldBounds,
    layout,
    isMobile,
    water,
  };
}

export function setBuildingSaturation(buildings, focusId) {
  Object.entries(buildings).forEach(([id, group]) => {
    const dim = focusId && id !== focusId;
    group.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      if (obj.material.color) {
        if (!obj.userData.baseColor) obj.userData.baseColor = obj.material.color.clone();
        const c = obj.userData.baseColor;
        const hsl = { h: 0, s: 0, l: 0 };
        c.getHSL(hsl);
        obj.material.color.setHSL(hsl.h, hsl.s * (dim ? 0.6 : 1), hsl.l);
      } else if (obj.material.map) {
        if (obj.userData.baseOpacity === undefined) obj.userData.baseOpacity = obj.material.opacity ?? 1;
        obj.material.transparent = true;
        obj.material.opacity = dim ? 0.45 : obj.userData.baseOpacity;
      }
    });
  });
}

const UNLOCK_DECO_HIGHLIGHT = {
  unlock_fire_hydrant: {
    names: ['deco_fire_hydrant', 'fire_hydrant'],
    emissive: PALETTE.logoRed,
    intensity: 0.18,
  },
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

function applyDecoHighlight(mesh, { emissive, intensity }) {
  if (!mesh.isMesh || !mesh.material) return;
  mesh.material = mesh.material.clone();
  mesh.material.emissive = new THREE.Color(emissive);
  mesh.material.emissiveIntensity = intensity;
}

export function applyUnlocks(scene, unlocks) {
  scene.traverse((o) => {
    Object.entries(UNLOCK_DECO_HIGHLIGHT).forEach(([key, spec]) => {
      if (unlocks[key] && spec.names.includes(o.name)) {
        o.visible = true;
        applyDecoHighlight(o, spec);
      }
    });

    if (o.name?.startsWith('unlock_flag_') && unlocks[o.name]) {
      o.visible = true;
      applyDecoHighlight(o, { emissive: PALETTE.logoRed, intensity: 0.15 });
    }

    if (o.name === 'logo_inlay' && unlocks.deco_logo_inlay) applyLogoInlayGlow(o, true);
  });

  if (unlocks.night_mode) {
    scene.traverse((o) => {
      if (o.name === 'lamp_dock' || o.name === 'lamp_window') {
        o.visible = true;
        if (o.isMesh) applyDecoHighlight(o, { emissive: 0xffe8a8, intensity: 0.35 });
      }
    });
  }
}
