import * as THREE from 'three';
import { loadObjMtl } from '../utils/loaders.js';
import { riverCenter, riverHalfWidth } from '../utils/river.js';

const TREE_MODELS = [
  'BirchTree_1', 'BirchTree_2', 'BirchTree_4',
  'CommonTree_1', 'CommonTree_2', 'CommonTree_4',
  'PineTree_1', 'PineTree_3', 'PineTree_5',
  'Willow_1', 'Willow_3',
];
const BUSH_MODELS = ['Bush_1', 'Bush_2', 'BushBerries_1'];
const DECOR_MODELS = [
  'WoodLog', 'WoodLog_Moss', 'TreeStump',
  'Flowers', 'Grass', 'Grass_2', 'Grass_Short',
  'Plant_1', 'Plant_2', 'Plant_3', 'Plant_4', 'Plant_5',
];

const BASE_URL = 'assets/models/Environment/';

const BOOTH_RADIUS = 11; // booths are larger now → wider tree-free skirt around them
const LAMP_RADIUS = 2.5;
const BOOTHS = [[14, -22], [-14, 22]];
const LAMPS = [
  [-4, -25], [-4, -50], [-4, -75], [4, 25], [4, 50], [4, 75],
  [25, -4], [50, -4], [75, -4], [-25, 4], [-50, 4], [-75, 4],
];

function modelHeight(name) {
  if (name.includes('Pine')) return 12.0;
  if (name.includes('Birch') || name.includes('CommonTree') || name.includes('Willow')) return 10.0;
  if (name.includes('Bush')) return 1.5;
  if (name.includes('Berries')) return 1.2;
  if (name.includes('Stump')) return 0.7;
  if (name.includes('Log')) return 0.6;
  if (name.includes('Plant')) return 0.9;
  if (name.includes('Grass')) return 0.5;
  if (name.includes('Flower')) return 0.4;
  return 4.0;
}

async function loadAll(names) {
  const out = [];
  await Promise.all(
    names.map((name) =>
      loadObjMtl(`${BASE_URL}${name}.obj`, `${BASE_URL}${name}.mtl`)
        .then((m) => {
          m.name = name;
          const bbox = new THREE.Box3().setFromObject(m);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const scale = size.y > 0 ? modelHeight(name) / size.y : 1;
          m.scale.setScalar(scale);
          bbox.setFromObject(m);
          m.userData = { yOffset: -bbox.min.y };
          out.push(m);
        })
        .catch((err) => console.warn(`Vegetation: ${name} skipped: ${err.message}`))
    )
  );
  return out;
}

function inExclusionZone(x, z, blockLamps) {
  if (Math.abs(x) < 5) return true;
  const dz = z - riverCenter(x);
  if (Math.abs(dz) < riverHalfWidth(x) + 3) return true;
  if (x * x + z * z < 15 * 15) return true;
  if (Math.abs(x) < 15 && z < -65) return true;
  if (Math.hypot(Math.abs(x) - 50, Math.abs(z) - 50) < 30) return true;
  for (const [bx, bz] of BOOTHS) {
    if (Math.hypot(x - bx, z - bz) < BOOTH_RADIUS) return true;
  }
  if (blockLamps) {
    for (const [lx, lz] of LAMPS) {
      if (Math.hypot(x - lx, z - lz) < LAMP_RADIUS) return true;
    }
  }
  return false;
}

export async function buildVegetation() {
  const group = new THREE.Group();
  group.name = 'vegetation';

  const [trees, bushes, decor] = await Promise.all([
    loadAll(TREE_MODELS),
    loadAll(BUSH_MODELS),
    loadAll(DECOR_MODELS),
  ]);

  // Trees swayed by wind; bushes/decor stay still.
  const swayables = [];
  // Track XZ positions of trees so we can enforce spacing — prevents collisions when wind sways them.
  const treePositions = [];

  function tooCloseToTree(x, z, minDist) {
    for (const [tx, tz] of treePositions) {
      const dx = x - tx, dz = z - tz;
      if (dx * dx + dz * dz < minDist * minDist) return true;
    }
    return false;
  }

  function placeFrom(list, count, opts = {}) {
    const blockLamps = opts.blockLamps !== false;
    const sway = !!opts.sway;
    const minSpacing = opts.minSpacing || 0;
    let attempts = 0;
    let placed = 0;
    while (placed < count && attempts < count * 12) {
      attempts++;
      const x = (Math.random() - 0.5) * 190;
      const z = (Math.random() - 0.5) * 190;
      if (inExclusionZone(x, z, blockLamps)) continue;
      if (minSpacing > 0 && tooCloseToTree(x, z, minSpacing)) continue;
      const source = list[Math.floor(Math.random() * list.length)];
      if (!source) continue;

      const instance = source.clone(true);
      const yaw = Math.random() * Math.PI * 2;
      instance.rotation.y = yaw;
      const scaleVar = 0.8 + Math.random() * 0.4;
      instance.scale.multiplyScalar(scaleVar);
      instance.position.set(x, source.userData.yOffset * scaleVar, z);
      group.add(instance);
      placed++;

      if (sway) {
        instance.userData.sway = {
          yaw,
          phase: Math.random() * Math.PI * 2,
          amp: 0.018 + Math.random() * 0.018,
        };
        swayables.push(instance);
        treePositions.push([x, z]);
      }
    }
  }

  // Trees need spacing so wind sway doesn't make them collide.
  placeFrom(trees, 90, { blockLamps: true, sway: true, minSpacing: 6 });
  placeFrom(bushes, 35, { blockLamps: true });
  placeFrom(decor, 90,  { blockLamps: false });

  // Wind animation tick. Sway amplitude saturates with wind so neighbours can't collide.
  group.userData.tick = (delta, time, windSpeed) => {
    if (!windSpeed) {
      for (const t of swayables) t.rotation.set(0, t.userData.sway.yaw, 0);
      return;
    }
    // Saturating curve: even at max windSpeed=3, effective sway factor ≤ 1.3.
    const intensity = 1.0 - Math.exp(-windSpeed * 0.6);
    for (const t of swayables) {
      const s = t.userData.sway;
      const phaseTime = time * (0.6 + windSpeed * 0.4);
      const rx = Math.sin(phaseTime * 1.7 + s.phase) * s.amp * intensity * 1.6;
      const rz = Math.cos(phaseTime * 1.3 + s.phase * 1.4) * s.amp * intensity * 1.6;
      t.rotation.set(rx, s.yaw, rz);
    }
  };

  return group;
}
