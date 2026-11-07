import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cd = JSON.parse(readFileSync(join(__dirname, '../src/data/model-stats.json'), 'utf8'));
const TOL = 0.05;

const draco = new DRACOLoader();
draco.setDecoderPath(join(__dirname, '../public/draco/'));
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

for (const row of cd) {
  const gltf = await loader.loadAsync(join(__dirname, `../public/models/${row.name}.glb`));
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const cdH = row.max[1];
  const ok = ['x', 'y', 'z'].every((k, i) => {
    const exp = [row.sizeXYZ[0], cdH, row.sizeXYZ[2]][i];
    return Math.abs(size[k] - exp) / exp <= TOL;
  });
  console.log(row.name, 'size', size.toArray().map((n) => +n.toFixed(3)), 'cdOk', ok);
}
draco.dispose();
