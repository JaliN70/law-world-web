import { loadGlbScene, getGlbLoaders, extractSharedMaterial, setSharedPaletteMaterial } from './glbLoader.js';
import { ISLAND_ORDER } from './layouts.js';
import { attachIslandExtras } from './islandTerrain.js';

function decoUrl(name) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}models/deco/${name}.glb`;
}

function prepareIslandClone(islandScene, islandId) {
  const g = islandScene.clone(true);
  g.name = 'deco_island_12m';
  let pick = null;
  g.traverse((o) => {
    if (o.isMesh) {
      if (o.name === 'island_grass') {
        o.userData.islandPick = islandId;
        pick = o;
      } else {
        o.userData.decorOnly = true;
        o.raycast = () => {};
      }
    }
  });
  return { mesh: g, pick };
}

export async function installArchipelagoGlb({ islands, islandPickables, scene, onReport }) {
  const report = { ok: [], failed: [] };

  try {
    const islandTpl = await loadGlbScene(decoUrl('deco_island_12m'));
    report.ok.push('deco_island_12m.glb');

    islandPickables.length = 0;
    ISLAND_ORDER.forEach((id) => {
      const host = islands[id];
      if (!host) return;
      host.children
        .filter((c) => c.name === 'deco_island_12m' || String(c.name).startsWith('island_extras_'))
        .forEach((c) => host.remove(c));

      const { mesh, pick } = prepareIslandClone(islandTpl, id);
      const extras = attachIslandExtras(id);
      const placement = host.children.find((c) => String(c.name).endsWith('_placement'));
      host.add(mesh);
      host.add(extras);
      if (placement) {
        host.remove(placement);
        host.add(placement);
      }
      if (pick) islandPickables.push(pick);
    });
  } catch (e) {
    report.failed.push({ file: 'deco_island_12m.glb', error: String(e?.message || e) });
    console.warn('[law-world] island GLB failed', e);
  }

  try {
    const { gltfLoader } = getGlbLoaders();
    const gltf = await gltfLoader.loadAsync(decoUrl('deco_logo_platform'));
    const mat = extractSharedMaterial(gltf.scene);
    if (mat) setSharedPaletteMaterial(mat);
    gltf.scene.traverse((o) => {
      if (o.isMesh && o.name !== 'logo_inlay' && mat) o.material = mat;
      if (o.name === 'logo_inlay') {
        o.userData.decorOnly = true;
        o.raycast = () => {};
        if (!o.userData.baseMat) o.userData.baseMat = o.material;
      }
      if (o.name === 'logo_platform') {
        o.userData.decorOnly = true;
        o.raycast = () => {};
      }
    });
    const prev = scene.getObjectByName('logo_platform_root');
    if (prev) scene.remove(prev);
    gltf.scene.name = 'logo_platform_root';
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.userData.nonInteractive = true;
    gltf.scene.traverse((o) => {
      if (o.isMesh) o.renderOrder = 1;
    });
    scene.add(gltf.scene);
    report.ok.push('deco_logo_platform.glb');
  } catch (e) {
    report.failed.push({ file: 'deco_logo_platform.glb', error: String(e?.message || e) });
    console.warn('[law-world] logo platform GLB failed', e);
  }

  onReport?.(report);
  return report;
}
