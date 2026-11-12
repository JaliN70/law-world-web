/**
 * 產生 public/models/park.glb：六棟建築＋園區道具，每個一個以名稱命名的 scene。
 *   npm run models
 * 規格（藍圖 §2）：glTF 2.0 GLB、Y 軸向上、公尺、不含相機燈光；共用 4×4 色盤；
 * 每棟 2,000–5,000 三角面以內。另做量化＋meshopt 壓縮，最後以 Khronos glTF Validator 驗證。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { weld, meshopt, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import validator from 'gltf-validator';
import { PALETTE, THREE } from './kit.mjs';
import { palettePng } from './png.mjs';
import { BUILDINGS } from './buildings.mjs';
import { PROPS } from './props.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/models/park.glb');
const STATS = path.join(ROOT, 'src/data/model-stats.json');

const doc = new Document();
const buffer = doc.createBuffer();
const texture = doc.createTexture('park_palette').setImage(palettePng(PALETTE.map(([, hex]) => hex))).setMimeType('image/png');
const material = doc.createMaterial('park_palette').setBaseColorTexture(texture).setMetallicFactor(0).setRoughnessFactor(0.88);
material.getBaseColorTextureInfo().setMagFilter(9728).setMinFilter(9728).setWrapS(33071).setWrapT(33071);

function toNode(obj) {
  const node = doc.createNode(obj.name);
  node.setTranslation(obj.position.toArray());
  const q = obj.quaternion;
  if (q.x || q.y || q.z) node.setRotation([q.x, q.y, q.z, q.w]);
  if (obj.isMesh) {
    const g = obj.geometry;
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.attributes.position.array)).setBuffer(buffer);
    const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array(g.attributes.uv.array)).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setMaterial(material);
    node.setMesh(doc.createMesh(obj.name).addPrimitive(prim));
  }
  obj.children.forEach((c) => node.addChild(toNode(c)));
  return node;
}

function triangles(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (o.isMesh) n += o.geometry.attributes.position.count / 3;
  });
  return n;
}

const stats = [];
for (const [name, make] of [...Object.entries(BUILDINGS), ...Object.entries(PROPS)]) {
  const obj = make();
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const tris = triangles(obj);
  const isBuilding = name in BUILDINGS;
  stats.push({
    name,
    kind: isBuilding ? 'building' : 'prop',
    triangles: tris,
    min: box.min.toArray().map((v) => +v.toFixed(3)),
    max: box.max.toArray().map((v) => +v.toFixed(3)),
  });
  if (isBuilding && (tris > 5000 || box.max.x - box.min.x > 8.4 || box.max.z - box.min.z > 8.4))
    throw new Error(`${name}: 超出規格（${tris} tris, ${box.min.toArray()} → ${box.max.toArray()}）`);
  doc.createScene(name).addChild(toNode(obj));
}
doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);

await MeshoptEncoder.ready;
doc.createExtension(KHRMeshQuantization);
await doc.transform(
  weld(),
  dedup(),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 14, quantizeTexcoord: 8 })
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });

const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const glb = await io.writeBinary(doc);
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, glb);
await fs.writeFile(STATS, JSON.stringify(stats, null, 2) + '\n');

const report = await validator.validateBytes(new Uint8Array(glb), { maxIssues: 30 });
console.table(stats.map(({ name, triangles, max }) => ({ name, triangles, height: max[1] })));
console.log(
  JSON.stringify({ bytes: glb.byteLength, gzip: zlib.gzipSync(glb).byteLength, errors: report.issues.numErrors, warnings: report.issues.numWarnings })
);
if (report.issues.numErrors) {
  console.error(report.issues.messages);
  process.exit(1);
}
