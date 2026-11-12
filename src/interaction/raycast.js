import * as THREE from 'three';
import { BUILDING_NAMES } from '../scene/layouts.js';

export function pickIsland(camera, islandMeshes, clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera({ x, y }, camera);
  const hits = ray.intersectObjects(islandMeshes, false);
  for (const h of hits) {
    const fromPoint = h.object.userData?.islandFromPoint;
    const id = fromPoint ? fromPoint(h.point) : h.object.userData?.islandPick;
    if (id) return id;
  }
  return null;
}

export function pickBuilding(camera, clickable, clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera({ x, y }, camera);
  const hits = ray.intersectObjects(clickable, true);
  for (const h of hits) {
    let o = h.object;
    while (o) {
      if (o.userData?.areaId) return o.userData.areaId;
      if (BUILDING_NAMES.includes(o.name)) return o.name;
      if (o.userData?.clickable && o.userData?.areaId) return o.userData.areaId;
      o = o.parent;
    }
  }
  return null;
}
