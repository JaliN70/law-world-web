import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let sharedPaletteMaterial = null;
let dracoLoader = null;
let gltfLoader = null;

export function baseUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\//, '')}`;
}

export function getGlbLoaders() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(baseUrl('draco/'));
    dracoLoader.preload();
  }
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
  }
  return { gltfLoader, dracoLoader };
}

export function getSharedPaletteMaterial() {
  return sharedPaletteMaterial;
}

export function setSharedPaletteMaterial(mat) {
  if (mat && !sharedPaletteMaterial) sharedPaletteMaterial = mat;
}

export function extractSharedMaterial(gltf) {
  let tex = null;
  gltf.scene.traverse((o) => {
    if (o.isMesh?.material?.map && !tex) tex = o.material.map;
  });
  if (!tex) return null;
  tex.flipY = false;
  return new THREE.MeshStandardMaterial({
    map: tex,
    metalness: 0,
    roughness: 0.88,
    name: 'park_palette_shared',
  });
}

export function applySharedMaterial(root, sharedMat = sharedPaletteMaterial) {
  if (!sharedMat) return;
  root.traverse((o) => {
    if (o.isMesh && o.material) o.material = sharedMat;
  });
}

export async function loadGlbScene(url) {
  const { gltfLoader } = getGlbLoaders();
  const gltf = await gltfLoader.loadAsync(url);
  const mat = extractSharedMaterial(gltf);
  if (mat) setSharedPaletteMaterial(mat);
  if (sharedPaletteMaterial) applySharedMaterial(gltf.scene);
  return gltf.scene;
}

export function cloneDecoScene(scene) {
  const g = scene.clone(true);
  g.traverse((o) => {
    if (o.isMesh) {
      o.userData.decorOnly = true;
      o.raycast = () => {};
    }
  });
  return g;
}
