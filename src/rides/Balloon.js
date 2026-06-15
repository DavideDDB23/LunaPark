import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';

const BALLOON_URL = 'assets/models/rides/balloon.glb';
const TARGET_HEIGHT = 14;
const SPAWN_RADIUS = 30;
const SPAWN_Y_MIN = 35;
const SPAWN_Y_MAX = 45;

function deterministicSeed(i) {
  return i * 137 * Math.PI / 180 + 5.7;
}

async function buildOneBalloon(model, index) {
  const node = model.getObjectByName('V1_HotAirBalloon_' + index);
  if (!node) {
    console.warn('[Balloon] GLB missing sub-root V1_HotAirBalloon_' + index);
    return null;
  }

  const bbox = new THREE.Box3().setFromObject(node);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
  node.scale.setScalar(scale);

  const scaledBbox = new THREE.Box3().setFromObject(node);
  const center = new THREE.Vector3();
  scaledBbox.getCenter(center);
  node.position.x -= center.x;
  node.position.z -= center.z;
  node.position.y -= scaledBbox.min.y;

  node.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const b = new THREE.Group();
  b.name = 'balloon_' + index;

  b.add(node);
  b.userData.fpvTarget = node;

  const seed = deterministicSeed(index);
  const angle = seed;
  const dist = ((index * 7.3) % 1) * SPAWN_RADIUS;
  const baseX = Math.cos(angle) * dist;
  const baseZ = Math.sin(angle) * dist;
  const baseY = SPAWN_Y_MIN + ((index * 3.1) % 1) * (SPAWN_Y_MAX - SPAWN_Y_MIN);
  b.position.set(baseX, baseY, baseZ);
  b.userData.baseY = baseY;

  const balloonLight = new THREE.PointLight(0xff8844, 0, 25, 1.5);
  balloonLight.position.set(0, TARGET_HEIGHT * 0.5, 0);
  b.add(balloonLight);

  let driftAngle = angle;
  let nightFactor = 0;
  b.userData.driftAngle = driftAngle;

  eventBus.on('time-phase-change', (data) => {
    nightFactor = data.nightFactor;
  });

  b.userData.tick = (delta, time, windSpeed = 1) => {
    const dt = Math.min(delta, 0.05);

    driftAngle += Math.sin(time * 0.02 + index) * 0.001 * windSpeed;
    b.userData.driftAngle = driftAngle;
    const driftSpeed = windSpeed * 1.5;
    b.position.x += Math.cos(driftAngle) * driftSpeed * dt;
    b.position.z += Math.sin(driftAngle) * driftSpeed * dt;

    const distFromCenter = Math.sqrt(b.position.x ** 2 + b.position.z ** 2);
    if (distFromCenter > 70) {
      const toCenterAngle = Math.atan2(-b.position.z, -b.position.x);
      driftAngle += (toCenterAngle - driftAngle) * 0.05;
    }

    b.position.y = baseY + Math.sin(time * 0.3 + index) * 1.5;
    b.rotation.z = Math.sin(time * 0.5 + windSpeed + index) * 0.08;
    b.rotation.x = Math.sin(time * 0.4 + windSpeed * 0.7 + index) * 0.05;

    balloonLight.intensity = nightFactor * 40;
  };

  return b;
}

export async function buildBalloon() {
  const group = new THREE.Group();
  group.name = 'balloon';

  let gltf;
  try {
    gltf = await loadGLB(BALLOON_URL);
  } catch (err) {
    console.error('[Balloon] Failed to load GLB:', err);
    return { group, balloons: [] };
  }
  const model = gltf.scene;
  sanitizeMaterials(model);

  const balloons = [];
  for (let i = 1; i <= 3; i++) {
    const b = await buildOneBalloon(model, i);
    if (b) {
      group.add(b);
      balloons.push(b);
    }
  }

  if (balloons[0]) {
    balloons[0].userData.rideId = 'balloon';
    balloons[0].userData.rideName = 'Mongolfiera';
  }

  return { group, balloons };
}
