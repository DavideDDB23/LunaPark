import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';

const STALL_URL = 'assets/models/stylized_carnival_booth.glb';

const PLACEMENTS = [
  // Hub area stalls — kept clear of river band (|z|<15) and NS path (|x|<5).
  ['stall_2', -14,  22,  Math.PI * 0.25], // SW quadrant
];

function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// Soft round sprite for the steam puffs, generated on a tiny canvas.
function makeSteamSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Cooking-steam particle system (THREE.Points) for one stall.
 * Each particle is a kinematic puff: spawned just above the counter with an
 * upward velocity + random lateral drift, advected sideways by the live wind
 * slider, and faded out over its lifetime before respawning at the source. */
function makeSteam({ x, y, z }) {
  const COUNT = 25;
  const LIFE_MIN = 1.6, LIFE_MAX = 3.0;
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const lifetimes = new Float32Array(COUNT);   // seconds remaining
  const durations = new Float32Array(COUNT);   // full lifetime, for the fade

  const respawn = (i) => {
    positions[i * 3] = x + (Math.random() - 0.5) * 0.7;
    positions[i * 3 + 1] = y + Math.random() * 0.2;
    positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.7;
    velocities[i * 3] = (Math.random() - 0.5) * 0.16;
    velocities[i * 3 + 1] = 0.3 + Math.random() * 0.3;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.16;
    durations[i] = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
    lifetimes[i] = durations[i];
  };
  for (let i = 0; i < COUNT; i++) {
    respawn(i);
    lifetimes[i] = Math.random() * durations[i]; // desynchronise the puffs
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Normal (alpha) blending: additive steam disappears against a bright sky;
  // a soft grey-white puff reads against both sky and night backgrounds.
  const material = new THREE.PointsMaterial({
    map: makeSteamSprite(),
    color: 0xd8dfe6,
    size: 1.05,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // tiny system; skip stale-bbox culling

  points.userData.tick = (delta, time, windSpeed = 1) => {
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] -= dt;
      if (lifetimes[i] <= 0) { respawn(i); continue; }
      positions[i * 3] += (velocities[i * 3] + windSpeed * 0.12) * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      // gentle buoyant acceleration + lateral wobble as the puff rises
      velocities[i * 3 + 1] += 0.05 * dt;
      positions[i * 3] += Math.sin(time * 2.0 + i) * 0.05 * dt;
    }
    geometry.attributes.position.needsUpdate = true;
    // whole-system breathing: thicker steam in calm air, shredded in wind
    material.opacity = 0.42 + 0.08 * Math.sin(time * 1.3) - Math.min(0.15, windSpeed * 0.04);
  };
  return points;
}

export async function buildFoodStalls() {
  const group = new THREE.Group();
  group.name = 'foodStalls';

  const gltf = await loadGLB(STALL_URL);
  const source = gltf.scene;
  sanitizeMaterials(source);

  const bbox = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const targetHeight = 6.5;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const groundOffset = -bbox.min.y * scale;

  const steamSystems = [];
  for (const [id, x, z, rotY] of PLACEMENTS) {
    const stall = source.clone(true);
    stall.name = id;
    stall.scale.setScalar(scale);
    stall.position.set(x, groundOffset, z);
    stall.rotation.y = rotY;
    enableShadows(stall);
    group.add(stall);

    // Steam rising from the roof vent of this stall (above the roofline so
    // the plume is visible from every side).
    const steam = makeSteam({ x, y: groundOffset + targetHeight * 0.95, z });
    group.add(steam);
    steamSystems.push(steam);
  }

  group.userData.tick = (delta, time, windSpeed) => {
    for (const s of steamSystems) s.userData.tick(delta, time, windSpeed);
  };

  return group;
}
