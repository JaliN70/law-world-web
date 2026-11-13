import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * park.glb：六棟建築＋園區道具，每個一個 scene（scripts/models/build.mjs 產生）。
 * 全場一張 4×4 色盤；材質在這裡統一建立（Lambert＋平面著色，手機上比 PBR 省）。
 */
export async function loadPark(url, onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // 內嵌模式：頁面預先放了 base64 的 park.glb（給不能放 .glb 檔的預覽環境用）
  const embedded = typeof window !== 'undefined' && window.__PARK_GLB_B64;
  const gltf = embedded
    ? await loader.parseAsync(Uint8Array.from(atob(embedded), (c) => c.charCodeAt(0)).buffer, '')
    : await loader.loadAsync(url, (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      });
  let map = null;
  const templates = {};
  for (const s of gltf.scenes) {
    s.updateMatrixWorld(true);
    s.traverse((o) => {
      if (o.isMesh && !map) map = o.material.map;
    });
    templates[s.name] = s;
  }
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.colorSpace = THREE.SRGBColorSpace;
  return { templates, palette: createPalette(map) };
}

/** 共用材質＋按需建立的變體（每棟建築一份可降飽和的材質、發光零件各一份） */
function createPalette(map) {
  const base = new THREE.MeshLambertMaterial({ map, flatShading: true, name: 'park_palette' });

  /** 可降飽和：藍圖 S4「其他建築降低飽和度 40%」 */
  // 夜間窗光：所有建築材質共用同一個 uniform，窗玻璃色（glass）的面會發暖黃光
  const nightU = { value: 0 };
  const glassLinear = new THREE.Color('#3B4A63');
  const glassVec = new THREE.Vector3(glassLinear.r, glassLinear.g, glassLinear.b);
  const saturatable = (name) => {
    const m = base.clone();
    m.name = name;
    m.userData.uSat = { value: 1 };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSat = m.userData.uSat;
      shader.uniforms.uNight = nightU;
      shader.uniforms.uGlass = { value: glassVec };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uSat;\nuniform float uNight;\nuniform vec3 uGlass;\nvoid main() {')
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n\tfloat isGlass = 1.0 - step(0.03, distance(diffuseColor.rgb, uGlass));\n\tdiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, uSat);'
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += isGlass * uNight * uSat * vec3(1.0, 0.72, 0.3) * 0.9;');
    };
    m.customProgramCacheKey = () => 'park_sat_night';
    return m;
  };

  /** 發光：emissiveMap＝色盤 → 依零件自己的顏色亮起，不另外染色 */
  const glowing = (name, satUniform) => {
    const m = saturatable(name);
    if (satUniform) m.userData.uSat = satUniform;
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = map;
    m.emissiveIntensity = 0;
    return m;
  };

  return { map, base, saturatable, glowing, nightU };
}
