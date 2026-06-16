import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';
import { loadVisitorTemplates, makeRider, updateRider, getPassengerWorldHeight } from '../people/Passengers.js';

const BALLOON_URL = 'assets/models/rides/balloon.glb';
const TARGET_HEIGHT = 48;
const PASSENGER_COUNTS = [2, 3, 3];

const BALLOON_ZONES = [
  { cx: -40, cz: 40, hw: 8, hd: 6, baseY: 38, minY: 32 },
  { cx: 40, cz: -40, hw: 6, hd: 8, baseY: 30, minY: 24 },
  { cx: 0, cz: -30, hw: 8, hd: 6, baseY: 36, minY: 30 },
];

function buildOneBalloon(model, index) {
  const srcNode = model.getObjectByName('V1_HotAirBalloon_' + index);
  if (!srcNode) {
    console.warn('[Balloon] GLB missing sub-root V1_HotAirBalloon_' + index);
    return null;
  }

  const node = srcNode.clone(true);
  node.position.set(0, 0, 0);
  node.scale.setScalar(1);

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

  const basketNode = node.getObjectByName('V1_HotAirBalloon_Basket_' + index);
  if (basketNode) {
    basketNode.scale.y = 30 / TARGET_HEIGHT;
  }

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

  const zone = BALLOON_ZONES[index - 1];
  const baseY = zone.baseY;
  b.position.set(zone.cx, baseY, zone.cz);

  const basket = node.getObjectByName('V1_HotAirBalloon_Basket_' + index);
  if (basket) {
    const basketWorldPos = new THREE.Vector3();
    basket.getWorldPosition(basketWorldPos);
    const basketCenterLocal = new THREE.Vector3().copy(basketWorldPos);
    b.worldToLocal(basketCenterLocal);

    basket.updateWorldMatrix(true, true);
    let localTopY = -Infinity, localBottomY = Infinity;
    let localMinX = Infinity, localMaxX = -Infinity;
    let localMinZ = Infinity, localMaxZ = -Infinity;
    basket.traverse(child => {
      if (child.isMesh && child.geometry) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const bb = child.geometry.boundingBox;
        const mw = child.matrixWorld.elements;
        const corners = [
          [bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.min.y, bb.min.z],
          [bb.min.x, bb.max.y, bb.min.z], [bb.max.x, bb.max.y, bb.min.z],
          [bb.min.x, bb.min.y, bb.max.z], [bb.max.x, bb.min.y, bb.max.z],
          [bb.min.x, bb.max.y, bb.max.z], [bb.max.x, bb.max.y, bb.max.z],
        ];
        for (const c of corners) {
          const wx = mw[0]*c[0] + mw[4]*c[1] + mw[8]*c[2] + mw[12];
          const wy = mw[1]*c[0] + mw[5]*c[1] + mw[9]*c[2] + mw[13];
          const wz = mw[2]*c[0] + mw[6]*c[1] + mw[10]*c[2] + mw[14];
          const lx = wx - b.position.x;
          const ly = wy - b.position.y;
          const lz = wz - b.position.z;
          if (ly > localTopY) localTopY = ly;
          if (ly < localBottomY) localBottomY = ly;
          if (lx < localMinX) localMinX = lx;
          if (lx > localMaxX) localMaxX = lx;
          if (lz < localMinZ) localMinZ = lz;
          if (lz > localMaxZ) localMaxZ = lz;
        }
      }
    });
    b.userData.basketCenterLocal = basketCenterLocal;
    b.userData.basketTopLocal = localTopY;
    b.userData.basketFloorLocal = localBottomY;
    b.userData.basketWidthX = localMaxX - localMinX;
    b.userData.basketWidthZ = localMaxZ - localMinZ;
    b.userData.cameraLocalY = (localBottomY + getPassengerWorldHeight() * 0.16) - node.position.y;
  }

  const balloonLight = new THREE.PointLight(0xff8844, 0, 25, 1.5);
  balloonLight.position.set(0, TARGET_HEIGHT * 0.5, 0);
  b.add(balloonLight);

  let nightFactor = 0;

  eventBus.on('time-phase-change', (data) => {
    nightFactor = data.nightFactor;
  });

  b.userData.tick = (delta, time, windSpeed = 1) => {
    const ws = windSpeed;
    const tx = time * 0.03 * ws + index * 1.7;
    const tz = time * 0.025 * ws + index * 2.1;
    const ax = 1 + Math.abs(Math.sin(time * 0.015 * ws + index * 3.1)) * (zone.hw - 1);
    const az = 1 + Math.abs(Math.sin(time * 0.018 * ws + index * 2.7)) * (zone.hd - 1);
    b.position.x = zone.cx + Math.sin(tx) * ax;
    b.position.z = zone.cz + Math.cos(tz) * az;

    b.position.y = Math.max(zone.minY, baseY + Math.sin(time * 0.3 + index) * 1.5);
    b.rotation.z = Math.sin(time * 0.5 + windSpeed + index) * 0.08;
    b.rotation.x = Math.sin(time * 0.4 + windSpeed * 0.7 + index) * 0.05;

    balloonLight.intensity = nightFactor * 40;

    const riders = b.userData.riders;
    if (riders) {
      for (let r = 0; r < riders.length; r++) {
        updateRider(riders[r], time);
      }
    }
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

  const totalPassengers = PASSENGER_COUNTS.reduce((a, c) => a + c, 0);
  const templates = await loadVisitorTemplates(totalPassengers);

  const RIDER_OFFSETS = {
    1: [
      { x: 0, z: 1.2 },       // south side
      { x: 0, z: -1.2 },      // north side
    ],
    2: [
      { x: 1.2, z: 0 },       // east side
      { x: 0, z: 1.2 },       // south side
      { x: -1.2, z: 0 },      // west side
    ],
    3: [
      { x: 0, z: -1.2 },      // north side
      { x: 1.2, z: 0 },       // east side
      { x: 0, z: 1.2 },       // south side
    ],
  };

  let templateIdx = 0;
  const balloons = [];
  for (let i = 1; i <= 3; i++) {
    const b = buildOneBalloon(model, i);
    if (b) {
      group.add(b);
      balloons.push(b);

      const count = PASSENGER_COUNTS[i - 1];
      const bcl = b.userData.basketCenterLocal;
      const bfl = b.userData.basketFloorLocal;
      if (!bcl || bfl == null) continue;

      const offsets = RIDER_OFFSETS[i];
      const riders = [];
      for (let j = 0; j < count; j++) {
        const tmpl = templates[templateIdx++];
        if (!tmpl) continue;
        const rider = makeRider(tmpl, getPassengerWorldHeight(), {
          pool: ['standRest', 'standWave', 'standCheer', 'standPoint', 'standLook'],
          standing: true,
          phase: Math.random() * Math.PI * 2,
        });
        const o = offsets[j];
        rider.pivot.position.set(
          bcl.x + o.x,
          bfl + 0.5,
          bcl.z + o.z
        );
        rider.fig.rotation.y = Math.atan2(o.x, o.z);
        b.add(rider.pivot);
        riders.push(rider);
      }
      b.userData.riders = riders;
    }
  }

  if (balloons[0]) {
    balloons[0].userData.rideId = 'balloon';
    balloons[0].userData.rideName = 'Mongolfiera';
  }

  return { group, balloons };
}
