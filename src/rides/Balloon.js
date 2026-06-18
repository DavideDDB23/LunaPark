import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';
import { loadVisitorTemplates, makeRider, updateRider, getPassengerWorldHeight } from '../people/Passengers.js';

const BALLOON_URL = 'assets/models/rides/balloon.glb';
const TARGET_HEIGHT = 48;
const PASSENGER_COUNTS = [2, 3, 3];

const BALLOON_ZONES = [
  { cx: -40, cz: 40, radius: 6, baseY: 28, minY: 22 },
  { cx: 40, cz: -40, radius: 6, baseY: 20, minY: 14 },
  { cx: 0, cz: -30, radius: 6, baseY: 26, minY: 16 },
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

  let basketLight = null;
  let burnerLight = null;
  let fairyMat = null;

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
        const posAttr = child.geometry.attributes.position;
        if (!posAttr) return;

        child.updateMatrixWorld(true);
        const mw = child.matrixWorld.elements;
        const tempV = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
          tempV.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));

          // Filter out the struts/burner frames (only keep the actual basket box)
          // The basket box geometry vertices are all below -110.0 in local Y
          if (tempV.y > -110.0) continue;

          tempV.applyMatrix4(child.matrixWorld);

          // Convert world coordinates to b-local coordinates
          const lx = tempV.x - b.position.x;
          const ly = tempV.y - b.position.y;
          const lz = tempV.z - b.position.z;

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
    const basketWidthX = localMaxX - localMinX;
    const basketWidthZ = localMaxZ - localMinZ;
    b.userData.basketWidthX = basketWidthX;
    b.userData.basketWidthZ = basketWidthZ;
    b.userData.cameraLocalY = (localBottomY + getPassengerWorldHeight() * 0.16) - node.position.y;

    // ── Create warm interior basket light ──
    basketLight = new THREE.PointLight(0xffddaa, 0.0, 6.0, 1.5);
    // Position it inside the basket, slightly below the rim
    basketLight.position.set(basketCenterLocal.x, localTopY - 0.5, basketCenterLocal.z);
    basketLight.layers.set(2);
    b.add(basketLight);

    // ── Create flickering burner flame light ──
    burnerLight = new THREE.PointLight(0xff6611, 0.0, 20.0, 1.5);
    // Position it higher up where the burner flame would fire
    burnerLight.position.set(basketCenterLocal.x, localTopY + 3.5, basketCenterLocal.z);
    burnerLight.layers.set(2);
    b.add(burnerLight);

    // ── Create 4 decorative LED bars along the precise sides of the mesh ──
    fairyMat = new THREE.MeshStandardMaterial({
      color: 0xffeebb,
      emissive: 0xffeebb,
      emissiveIntensity: 0.0,
      roughness: 0.2,
      metalness: 0.8,
      toneMapped: false
    });
    
    const rimY = localTopY + 0.02; // Placed exactly on the top edge of the basket
    const barThickness = 0.06;

    const centerX = (localMaxX + localMinX) / 2;
    const centerZ = (localMaxZ + localMinZ) / 2;

    const lengthX = basketWidthX * 0.98; // Slightly shorter than full width
    const lengthZ = basketWidthZ * 0.98;

    const barGeoX = new THREE.BoxGeometry(lengthX, barThickness, barThickness);
    const barGeoZ = new THREE.BoxGeometry(barThickness, barThickness, lengthZ);

    const ledBars = [
      { geo: barGeoX, x: centerX, z: localMinZ }, // Back
      { geo: barGeoX, x: centerX, z: localMaxZ }, // Front
      { geo: barGeoZ, x: localMinX, z: centerZ }, // Left
      { geo: barGeoZ, x: localMaxX, z: centerZ }, // Right
    ];

    for (const bar of ledBars) {
      const mesh = new THREE.Mesh(bar.geo, fairyMat);
      mesh.position.set(bar.x, rimY, bar.z);
      b.add(mesh);
    }
  }

  const balloonLight = new THREE.PointLight(0xff8844, 0, 25, 1.5);
  balloonLight.position.set(0, TARGET_HEIGHT * 0.5, 0);
  b.add(balloonLight);

  let driftAngle = index * 2.094;
  let nightFactor = 0;
  b.userData.driftAngle = driftAngle;

  eventBus.on('time-phase-change', (data) => {
    nightFactor = data.nightFactor;
  });

  b.userData.tick = (delta, time, windSpeed = 1) => {
    const dt = Math.min(delta, 0.05);

    driftAngle += dt * (0.06 + 0.06 * Math.sin(time * 0.04 + index)) * windSpeed;
    b.userData.driftAngle = driftAngle;
    const driftRadius = 1 + Math.abs(Math.sin(time * 0.02 + index * 1.7)) * (zone.radius - 1);
    b.position.x = zone.cx + Math.cos(driftAngle) * driftRadius;
    b.position.z = zone.cz + Math.sin(driftAngle) * driftRadius;

    b.position.y = Math.max(zone.minY, baseY + Math.sin(time * 0.3 + index) * 1.5);
    b.rotation.z = Math.sin(time * 0.5 + windSpeed + index) * 0.08;
    b.rotation.x = Math.sin(time * 0.4 + windSpeed * 0.7 + index) * 0.05;

    balloonLight.intensity = nightFactor * 40;

    // Update new lights
    if (basketLight) {
      basketLight.intensity = nightFactor * 6.0;
    }
    if (burnerLight) {
      // Simulate hot air balloon burner firing bursts and flickering
      // Use high frequency sine combined with slower envelope to look like random bursts
      const burst = 0.5 + 0.5 * Math.sin(time * 1.5 + index * 4.0);
      const flicker = 0.8 + 0.2 * Math.sin(time * 12.0 + index);
      const isFiring = burst > 0.4 ? 1.0 : 0.15;
      burnerLight.intensity = nightFactor * isFiring * flicker * 25.0;
    }
    if (fairyMat) {
      // Gentle twinkle effect for the basket fairy lights
      fairyMat.emissiveIntensity = nightFactor * (2.5 + 1.0 * Math.sin(time * 3.5 + index * 1.7));
    }

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
