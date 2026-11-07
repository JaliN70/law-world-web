import * as THREE from 'three';

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
      if (o.userData.clickable && o.name) return o.name;
      o = o.parent;
    }
  }
  return null;
}
