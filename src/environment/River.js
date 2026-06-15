// Composite river module — wraps Water (animated shader), Rocks (banks + in-river),
// Fish (swim + jump) plus a static dark bed. Returns a group named "river" with
// userData.update(delta, time) that drives all animations.

import * as THREE from 'three';
import { buildWater } from './Water.js';
import { buildRocks } from './Rocks.js';
import { buildFish } from './Fish.js';

export const RIVER_X_MIN = -100;
export const RIVER_X_MAX = 100;

export function riverCenter(x) {
  return 14 * Math.sin(x * 0.04) + 3 * Math.sin(x * 0.11);
}

export function riverHalfWidth(x) {
  return 6 + 2 * Math.sin(x * 0.07 + 0.3);
}

export function distanceFromRiver(x, z) {
  return Math.abs(z - riverCenter(x)) - riverHalfWidth(x);
}

function buildRiverBed() {
  const segments = 200;
  const positions = [];
  const indices = [];
  const uvs = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = RIVER_X_MIN + t * (RIVER_X_MAX - RIVER_X_MIN);
    const cz = riverCenter(x);
    const hw = riverHalfWidth(x);
    positions.push(x, 0, cz - hw);
    positions.push(x, 0, cz + hw);
    uvs.push(t, 0); uvs.push(t, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.95, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.05;
  mesh.receiveShadow = true;
  mesh.name = 'river_bed';
  return mesh;
}

export async function buildRiver() {
  const group = new THREE.Group();
  group.name = 'river';

  group.add(buildRiverBed());

  const water = buildWater();
  const [rocks, fish] = await Promise.all([buildRocks(), buildFish(water)]);

  group.add(water);
  group.add(rocks);
  group.add(fish);

  const ticks = [];
  if (water.userData.tick) ticks.push(water.userData.tick);
  if (fish.userData.tick) ticks.push(fish.userData.tick);

  group.userData.update = (delta, time) => {
    for (const t of ticks) t(delta, time);
  };
  return group;
}
