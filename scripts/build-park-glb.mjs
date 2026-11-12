/**
 * 把 assets-src/models 的原始 Draco GLB 打包成單一 public/models/park.glb。
 *
 * - 每個來源檔成為 park.glb 裡一個「以檔名命名的 scene」，網站端用 scene 名稱取模板。
 * - 全部材質共用一張 4×4 色盤（原 1024² 色盤每格純色、UV 全在格心，縮成 4×4 顏色完全相同）。
 * - 量化＋EXT_meshopt_compression（解碼器約 20 KB，取代 345 KB 的 Draco wasm）。
 * - 打包後跑 Khronos glTF Validator，有 error 即失敗。
 *
 * 用法：npm run build:models
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, unpartition, meshopt, mergeDocuments, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import validator from 'gltf-validator';
import zlib from 'node:zlib';
import { decodePng, encodePng } from './png4x4.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src/models');
const OUT = path.join(ROOT, 'public/models/park.glb');

/** 網站實際用到的模板；檔名即 scene 名稱 */
export const PARK_SOURCES = [
  'fire',
  'building',
  'telecom',
  'accessibility',
  'water',
  'electrical',
  'deco/deco_island_12m',
  'deco/deco_logo_platform',
  'deco/deco_path_stone',
  'deco/deco_path_stone_4m',
  'deco/deco_tree_cluster_a',
  'deco/deco_tree_cluster_b',
  'deco/deco_tree_cluster_c',
];

/** 4×4 色盤：由原圖每格中心取色，與 palette.png 完全一致 */
async function buildTinyPalette() {
  const { width, pixels } = decodePng(await fs.readFile(path.join(SRC, 'palette.png')));
  const cell = width / 4;
  const out = Buffer.alloc(4 * 4 * 4);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      const src = ((j * cell + cell / 2) * width + (i * cell + cell / 2)) * 4;
      pixels.copy(out, (j * 4 + i) * 4, src, src + 4);
    }
  return encodePng(4, 4, out);
}

function isFullyFlat(prim) {
  const P = prim.getAttribute('POSITION')?.getArray();
  const N = prim.getAttribute('NORMAL')?.getArray();
  const I = prim.getIndices()?.getArray();
  if (!P || !N || !I) return false;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const e1 = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]);
    const e2 = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const L = Math.hypot(...n);
    if (L < 1e-9) continue;
    n = n.map((x) => x / L);
    for (const v of [a, b, c]) if (n[0] * N[v * 3] + n[1] * N[v * 3 + 1] + n[2] * N[v * 3 + 2] < 0.995) return false;
  }
  return true;
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    });

  const target = new Document();
  target.createBuffer();
  for (const rel of PARK_SOURCES) {
    const src = await io.read(path.join(SRC, `${rel}.glb`));
    const name = path.basename(rel);
    src.getRoot().listScenes().forEach((s) => s.setName(name));
    mergeDocuments(target, src);
  }
  const root = target.getRoot();
  root.setDefaultScene(root.listScenes()[0]);

  // 單一 4×4 色盤（NEAREST、無 mipmap 需求）
  const palette = target
    .createTexture('park_palette_4x4')
    .setImage(await buildTinyPalette())
    .setMimeType('image/png');
  for (const mat of root.listMaterials()) {
    if (mat.getBaseColorTexture()) {
      mat.setBaseColorTexture(palette);
      mat.getBaseColorTextureInfo()
        .setMagFilter(9728)
        .setMinFilter(9728)
        .setWrapS(33071)
        .setWrapT(33071);
    }
    if (mat.getEmissiveTexture()) {
      mat.setEmissiveTexture(palette);
      mat.getEmissiveTextureInfo().setMagFilter(9728).setMinFilter(9728).setWrapS(33071).setWrapT(33071);
    }
    mat.setMetallicFactor(0).setRoughnessFactor(0.88);
  }
  // 確保網站端只看到一張圖、兩種材質（park_palette / park_palette_logo_inlay）
  root.listExtensionsUsed()
    .filter((e) => e.extensionName === 'KHR_draco_mesh_compression')
    .forEach((e) => e.dispose());

  // 純平面著色的 primitive（每個頂點法線都等於面法線）不需要 NORMAL：
  // 移除後頂點可依 位置＋UV 焊接，面數不變、頂點數大減；GLTFLoader 會自動改用 flatShading，外觀相同。
  const flatDropped = [];
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives())
      if (isFullyFlat(prim)) {
        prim.setAttribute('NORMAL', null);
        flatDropped.push(mesh.getName());
      }

  await target.transform(
    weld(),
    unpartition(),
    dedup({ propertyTypes: [PropertyType.TEXTURE, PropertyType.MATERIAL, PropertyType.ACCESSOR] }),
    prune({ keepLeaves: false }),
    meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 8 })
  );

  const glb = await io.writeBinary(target);
  await fs.writeFile(OUT, glb);

  const report = await validator.validateBytes(new Uint8Array(glb), { maxIssues: 50 });
  const { numErrors, numWarnings } = report.issues;
  const mats = root.listMaterials().map((m) => m.getName());
  const tris = root.listMeshes().reduce(
    (a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0),
    0
  );
  console.log(
    JSON.stringify(
      {
        out: path.relative(ROOT, OUT),
        bytes: glb.byteLength,
        gzipBytes: zlib.gzipSync(glb).byteLength,
        scenes: root.listScenes().map((s) => s.getName()),
        materials: mats,
        flatShadedMeshes: flatDropped,
        textures: root.listTextures().length,
        triangles: tris,
        validator: { errors: numErrors, warnings: numWarnings },
      },
      null,
      2
    )
  );
  if (numErrors > 0) {
    console.error(report.issues.messages.filter((m) => m.severity === 0));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
