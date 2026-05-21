import * as THREE from 'three';
import { loadObjMtl } from '../utils/loaders.js';
import { riverCenter, riverHalfWidth, RIVER_X_MIN, RIVER_X_MAX } from '../utils/river.js';

const ROCK_MODELS = ['Rock_1', 'Rock_3', 'Rock_5', 'Rock_6', 'Rock_Moss_1', 'Rock_Moss_3'];
const BASE_URL = 'assets/models/Environment/';
const BRIDGE_CLEAR = 5;

function rand(min, max) { return min + Math.random() * (max - min); }

export async function buildRocks() {
  const group = new THREE.Group();
  group.name = 'rocks';

  const sources = [];
  await Promise.all(
    ROCK_MODELS.map((name) =>
      loadObjMtl(`${BASE_URL}${name}.obj`, `${BASE_URL}${name}.mtl`)
        .then((m) => {
          const bbox = new THREE.Box3().setFromObject(m);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const baseHeight = 0.8;
          const scale = size.y > 0 ? baseHeight / size.y : 1;
          m.scale.setScalar(scale);
          m.userData.yOffset = -bbox.min.y * scale;
          sources.push(m);
        })
        .catch((err) => console.warn(`Rock ${name} skipped:`, err.message))
    )
  );

  if (!sources.length) return group;

  function placeRock(x, z, scaleMul = 1, sink = 0) {
    const src = sources[Math.floor(Math.random() * sources.length)];
    const rock = src.clone(true);
    rock.scale.multiplyScalar(scaleMul);
    rock.rotation.y = Math.random() * Math.PI * 2;
    rock.rotation.x = (Math.random() - 0.5) * 0.2;
    rock.position.set(x, src.userData.yOffset * scaleMul - sink, z);
    rock.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    group.add(rock);
  }

  // Dense rocks along both banks — acts as delimiter between water and land.
  const STEP = 3.0;
  for (let x = RIVER_X_MIN + 1; x <= RIVER_X_MAX - 1; x += STEP) {
    if (Math.abs(x) < BRIDGE_CLEAR) continue;
    const cz = riverCenter(x);
    const hw = riverHalfWidth(x);
    const jitter = rand(-0.6, 0.6);
    placeRock(x + jitter, cz - hw - rand(0.0, 0.5), rand(0.55, 1.2), 0);
    placeRock(x + jitter, cz + hw + rand(0.0, 0.5), rand(0.55, 1.2), 0);
  }

  // Sparse rocks INSIDE the river (partially submerged).
  for (let i = 0; i < 12; i++) {
    let x;
    do { x = rand(-95, 95); } while (Math.abs(x) < BRIDGE_CLEAR + 1);
    const cz = riverCenter(x);
    const hw = riverHalfWidth(x);
    const t = rand(-0.65, 0.65);
    placeRock(x, cz + t * hw, rand(0.45, 0.9), rand(0.1, 0.25));
  }

  return group;
}
