import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';

const BALLOON_URL = 'assets/models/rides/balloon.glb';

export async function buildBalloon() {
  const group = new THREE.Group();
  group.name = 'balloon';

  const gltf = await loadGLB(BALLOON_URL);
  const model = gltf.scene;
  sanitizeMaterials(model);

  // Auto-fit: scale to ~14m total height
  const bbox = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const targetHeight = 14;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  model.scale.setScalar(scale);

  // Center horizontally
  const scaledBbox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaledBbox.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;

  // Lift so bottom is at y=0
  const scaledBbox2 = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBbox2.min.y;

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  group.add(model);

  // Random initial position within r=30 from center, height 35-45
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * 30;
  const baseX = Math.cos(angle) * dist;
  const baseZ = Math.sin(angle) * dist;
  const baseY = 35 + Math.random() * 10;

  group.position.set(baseX, baseY, baseZ);



  // Night light inside balloon
  const balloonLight = new THREE.PointLight(0xff8844, 0, 25, 1.5);
  balloonLight.position.set(0, targetHeight * 0.5, 0);
  group.add(balloonLight);

  // State
  let driftAngle = Math.random() * Math.PI * 2;
  let nightFactor = 0;
  let isNight = false;

  eventBus.on('time-phase-change', (data) => {
    isNight = data.isNight;
    nightFactor = data.nightFactor;
  });

  group.userData.tick = (delta, time, windSpeed = 1) => {
    const dt = Math.min(delta, 0.05);

    // Drift
    driftAngle += Math.sin(time * 0.02) * 0.001 * windSpeed;
    const driftSpeed = windSpeed * 1.5;
    group.position.x += Math.cos(driftAngle) * driftSpeed * dt;
    group.position.z += Math.sin(driftAngle) * driftSpeed * dt;

    // Boundary: soft return if beyond r=70
    const distFromCenter = Math.sqrt(group.position.x ** 2 + group.position.z ** 2);
    if (distFromCenter > 70) {
      // Steer back toward center
      const toCenterAngle = Math.atan2(-group.position.z, -group.position.x);
      driftAngle += (toCenterAngle - driftAngle) * 0.05;
    }

    // Sway
    group.position.y = baseY + Math.sin(time * 0.3) * 1.5;
    group.rotation.z = Math.sin(time * 0.5 + windSpeed) * 0.08;
    group.rotation.x = Math.sin(time * 0.4 + windSpeed * 0.7) * 0.05;



    // Night light
    balloonLight.intensity = nightFactor * 40;
  };

  return group;
}
