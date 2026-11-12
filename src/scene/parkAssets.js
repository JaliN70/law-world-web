import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ISLAND_ORDER, BUILDING_HALF, islandAtPoint } from './layouts.js';
import { attachUnlockMesh, attachSceneEffects } from './buildings.js';
import { attachIslandExtras } from './islandTerrain.js';
import { WATER_BASE_Y, WATER_WAVE_AMP } from './waterSurface.js';

/**
 * park.glb：所有模型打包成一個檔（scripts/build-park-glb.mjs 產生）。
 * 每個來源 GLB 是一個以檔名命名的 scene；全場共用一張 4×4 色盤。
 */
export function parkUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}models/park.glb`;
}

let parkPromise = null;

/** 只下載／解碼一次；版面切換重建場景時直接重用 */
export function loadPark() {
  if (!parkPromise) {
    parkPromise = (async () => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(parkUrl());
      const templates = {};
      gltf.scenes.forEach((s) => {
        s.updateMatrixWorld(true);
        s.traverse((o) => {
          if (o.isMesh) o.geometry.userData.parkTemplate = true; // 版面切換時不可釋放
        });
        templates[s.name] = s;
      });
      let texture = null;
      gltf.scenes.forEach((s) =>
        s.traverse((o) => {
          if (!texture && o.isMesh && o.material?.map) texture = o.material.map;
        })
      );
      if (!texture) throw new Error('park.glb: palette texture missing');
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return { templates, materials: createMaterials(texture) };
    })().catch((e) => {
      parkPromise = null;
      throw e;
    });
  }
  return parkPromise;
}

function createMaterials(texture) {
  const base = new THREE.MeshStandardMaterial({
    name: 'park_palette',
    map: texture,
    metalness: 0,
    roughness: 0.88,
  });
  const flat = base.clone();
  flat.name = 'park_palette_flat';
  flat.flatShading = true;
  // 法規通：logo_inlay 以「自身色盤顏色」柔和發光（emissiveMap＝同一張色盤），不染紅
  const inlay = base.clone();
  inlay.name = 'park_palette_logo_inlay';
  inlay.emissive = new THREE.Color(0xffffff);
  inlay.emissiveMap = texture;
  inlay.emissiveIntensity = 0;
  // 岸壁另用一份材質，法規通完成時只調這份的 emissive
  const cliff = base.clone();
  cliff.name = 'park_palette_cliff';
  return { texture, base, flat, inlay, cliff };
}

/* ───────────────────────── 建築 ───────────────────────── */

/** 每棟一份材質（共用貼圖與 shader program），以 uniform 控制「其他建築降飽和 40%」 */
function createBuildingMaterial(flat) {
  const m = flat.clone();
  m.userData.uSat = { value: 1 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSat = m.userData.uSat;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uSat;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, uSat);'
      );
  };
  m.customProgramCacheKey = () => 'park_building_sat';
  return m;
}

export function setBuildingSaturation(buildings, focusId) {
  Object.entries(buildings).forEach(([id, group]) => {
    const sat = focusId && id !== focusId ? 0.6 : 1;
    group.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.material.userData?.uSat) {
        o.material.userData.uSat.value = sat;
      } else if (o.material.color) {
        // MVP 色塊版（無貼圖）
        if (!o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
        const hsl = { h: 0, s: 0, l: 0 };
        o.userData.baseColor.getHSL(hsl);
        o.material.color.setHSL(hsl.h, hsl.s * sat, hsl.l);
      }
    });
  });
}

function installBuildings(buildings, park, report) {
  for (const id of ISLAND_ORDER) {
    const placement = buildings[id];
    const tpl = park.templates[id];
    if (!placement || !tpl) {
      report.failed.push(id);
      continue;
    }
    const model = tpl.clone(true);
    const mat = createBuildingMaterial(park.materials.flat);
    let main = null;
    model.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.userData.clickable = true;
        // GLTFLoader 會把與 scene 同名的節點改成 fire_1 之類；以第一個 mesh 為主體並還原名稱
        if (!main) {
          main = o;
          o.name = id;
        }
      }
    });
    if (!main) {
      report.failed.push(id);
      continue;
    }
    [...placement.children].forEach((c) => placement.remove(c));
    placement.add(model);
    attachUnlockMesh(placement, id);
    attachSceneEffects(placement, id, { isGlb: true });
    report.ok.push(id);
  }
}

/* ─────────────────────── 島嶼靜態合併 ─────────────────────── */

/** 量化（Int16 normalized）屬性 → Float32，只留 position / normal / uv，並轉為非索引 */
function toFloatGeometry(src) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = src.getAttribute(name);
    if (!a) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) g.setIndex(src.index.clone());
  return g.index ? g.toNonIndexed() : g;
}

/** 收集 root 底下所有 mesh，套上 matrix 後轉成世界座標幾何 */
function bakeInto(list, root, matrix, filter = () => true) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((o) => {
    if (!o.isMesh || !filter(o)) return;
    const g = toFloatGeometry(o.geometry);
    const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrix, local));
    if (!g.getAttribute('normal')) g.computeVertexNormals(); // 非索引 → 面法線（平面著色）
    list.push(g);
  });
}

/** 碼頭本地 +Z 10.8–13.8；石徑從建築前緣鋪到碼頭內緣 */
const PATH_START_Z = BUILDING_HALF + 0.5;
const PATH_END_Z = 10.0;

function pathPieces(park) {
  const t4 = park.templates.deco_path_stone_4m;
  const t1 = park.templates.deco_path_stone;
  const out = [];
  if (!t4 || !t1) return out;
  let s = PATH_START_Z;
  while (s < PATH_END_Z - 0.02) {
    const remain = PATH_END_Z - s;
    const use4 = remain >= 4;
    const len = use4 ? 4 : Math.min(1, remain);
    const m = new THREE.Matrix4().makeTranslation(0, 0, s + len / 2);
    if (!use4 && len < 1) m.multiply(new THREE.Matrix4().makeScale(1, 1, len));
    out.push({ tpl: use4 ? t4 : t1, m });
    s += len;
  }
  return out;
}

function treePieces(park) {
  const r = 9.2;
  const ang = [0.9, 2.4, 4.0, 5.5];
  const types = ['a', 'b', 'c', 'a'];
  return ang
    .map((a, i) => {
      const tpl = park.templates[`deco_tree_cluster_${types[i]}`];
      if (!tpl) return null;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.sin(a) * r, 0, -Math.abs(Math.cos(a) * r)),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.3) % (Math.PI * 2)),
        new THREE.Vector3().setScalar(0.9 + (i % 3) * 0.06)
      );
      return { tpl, m };
    })
    .filter(Boolean);
}

/** 中央平台下方六角石座（UV 指到色盤 #D1D5DB 格心，與平台同一材質、可一起合併） */
function pedestalGeometry() {
  const bottomY = WATER_BASE_Y - WATER_WAVE_AMP - 0.02;
  const h = -bottomY;
  const g = new THREE.CylinderGeometry(4, 4, h, 6, 1, true);
  g.rotateY(Math.PI / 6); // 圓柱預設頂點朝 +Z；平台頂點朝 ±X
  g.translate(0, bottomY + h / 2, 0);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.125, 0.625); // 格 (0,2) = #D1D5DB
  return toFloatGeometry(g);
}

function decorOnly(mesh) {
  mesh.userData.decorOnly = true;
  mesh.raycast = () => {};
  return mesh;
}

function installTerrain({ scene, islands, islandPickables }, park, report) {
  ['park_terrain', 'park_cliffs', 'logo_inlay'].forEach((n) => {
    const prev = scene.getObjectByName(n);
    if (prev) {
      prev.geometry?.dispose();
      prev.parent.remove(prev);
    }
  });

  const terrain = [];
  const cliffs = [];
  const islandTpl = park.templates.deco_island_12m;
  const paths = pathPieces(park);
  const trees = treePieces(park);

  for (const id of ISLAND_ORDER) {
    const host = islands[id];
    if (!host || !islandTpl) continue;
    host.updateMatrixWorld(true);
    const hm = host.matrixWorld;
    bakeInto(terrain, islandTpl, hm, (o) => o.name !== 'island_cliff');
    bakeInto(cliffs, islandTpl, hm, (o) => o.name === 'island_cliff');
    for (const p of [...paths, ...trees]) bakeInto(terrain, p.tpl, new THREE.Matrix4().multiplyMatrices(hm, p.m));

    host.children.filter((c) => String(c.name).startsWith('island_extras_')).forEach((c) => host.remove(c));
    host.add(attachIslandExtras(id));
  }

  // 中央 Logo 平台：石臺＋石座併入地形；logo_inlay 獨立（發光用）
  const platform = park.templates.deco_logo_platform;
  let inlay = null;
  if (platform) {
    bakeInto(terrain, platform, new THREE.Matrix4(), (o) => o.name !== 'logo_inlay');
    terrain.push(pedestalGeometry());
    const geoms = [];
    bakeInto(geoms, platform, new THREE.Matrix4(), (o) => o.name === 'logo_inlay');
    if (geoms.length) {
      inlay = decorOnly(new THREE.Mesh(geoms[0], park.materials.inlay));
      inlay.name = 'logo_inlay';
      scene.add(inlay);
    }
  }

  if (terrain.length) {
    const mesh = new THREE.Mesh(mergeGeometries(terrain), park.materials.base);
    mesh.name = 'park_terrain';
    mesh.userData.islandFromPoint = (p) => islandAtPoint(p.x, p.z);
    mesh.geometry.computeBoundingSphere();
    scene.add(mesh);
    islandPickables.length = 0;
    islandPickables.push(mesh);
  }
  if (cliffs.length) {
    const mesh = decorOnly(new THREE.Mesh(mergeGeometries(cliffs), park.materials.cliff));
    mesh.name = 'park_cliffs';
    scene.add(mesh);
  }
  terrain.forEach((g) => g.dispose());
  cliffs.forEach((g) => g.dispose());
  report.ok.push('terrain');
}

/** 下載 park.glb 並把建築、六島、平台裝進目前的場景 */
export async function installPark(world) {
  const report = { ok: [], failed: [] };
  const park = await loadPark();
  installBuildings(world.buildings, park, report);
  installTerrain(world, park, report);
  world.materials = park.materials;
  return report;
}
