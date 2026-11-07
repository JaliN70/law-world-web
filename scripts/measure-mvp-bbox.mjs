import * as THREE from 'three';
import { readFileSync } from 'fs';
import {
  createFire,
  createBuilding,
  createTelecom,
  createAccessibility,
  createWater,
  createElectrical,
} from '../src/scene/buildings.js';

const factories = {
  fire: createFire,
  building: createBuilding,
  telecom: createTelecom,
  accessibility: createAccessibility,
  water: createWater,
  electrical: createElectrical,
};

const cd = JSON.parse(readFileSync('/workspace/law-miniverse-extract/models/model-stats.json', 'utf8'));
const TOL = 0.05;
const report = [];

for (const { name, sizeXYZ, max } of cd) {
  const g = factories[name]();
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const cdH = max[1];
  const dims = { x: size.x, y: size.y, z: size.z };
  const cdDims = { x: sizeXYZ[0], y: cdH, z: sizeXYZ[2] };
  const within = ['x', 'y', 'z'].every((k) => Math.abs(dims[k] - cdDims[k]) / cdDims[k] <= TOL);
  report.push({
    name,
    mvpBBox: {
      min: box.min.toArray().map((n) => +n.toFixed(3)),
      max: box.max.toArray().map((n) => +n.toFixed(3)),
      size: [dims.x, dims.y, dims.z].map((n) => +n.toFixed(3)),
    },
    cdEnvelope: { size: cdDims },
    withinFivePercent: within,
    swapRecommended: within,
  });
}

console.log(JSON.stringify(report, null, 2));
