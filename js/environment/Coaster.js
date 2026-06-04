// Fully procedural roller-coaster animation.
//
// animated_roller_coaster.glb (Sketchfab "Animated roller coaster", assetfactory) ships with a
// baked keyframe animation, but project policy is that EVERY motion is hand-written JS — exactly
// like the Ferris wheel, carousel and tagada, whose motion is derived from the model's GEOMETRY,
// never from an imported clip. So we ignore the animation entirely (loadGLB strips it) and recover
// the rail centre-line straight from the rail-tube mesh: the tube is a circle swept along the track,
// 24 vertices per ring, rings stored sequentially, so each ring's centroid is a centre-line point.
// We build a closed CatmullRom from those centroids and drive our own train along it.
//
// Model layout (verified by GLB traversal):
//   bumper_car_export_1.001 .. .006  → 6 static carts (we keep one as a clone template, drop the rest)
//   support_tall.010_*               → support pylons (static dressing)
//   Circle.023_build_gen_1_0         → the rail tube  ← centre-line source (24 verts/ring × 395 rings)
//   panel_1.001_*                    → operator booth / sign (static dressing)
//
// Mechanics, every frame:
//   1. Two trains of four carriages each (8 total). Every carriage is positioned & oriented
//      INDEPENDENTLY at its own arc-length parameter u_i = controller.u - offset_i — there is no
//      shared rigid block; each carriage samples curve.getPointAt(u_i) so it hugs the rail exactly.
//   2. Train 2 runs half a circuit ahead of train 1.
//   3. Orientation uses a precomputed rotation-minimizing frame field (no Frenet flips/twist on
//      straights), so carts bank smoothly through the whole layout.
//   4. A station state-machine (STOP → LAUNCH → COAST → BRAKE) gives a believable speed profile;
//      coasting speed follows gravity (slow on crests, fast in dips). Gated by the ControlPanel ease.

import * as THREE from 'three';
import { loadGLB } from '../utils/loaders.js';
import { ControlPanel } from './ControlPanel.js';
import { loadVisitorTemplates, makeRider, updateRider, getPassengerWorldHeight } from './Passengers.js';

const MODEL_URL = 'assets/models/animated_roller_coaster.glb';
const TARGET_LONG = 94;      // world units — longest horizontal extent after auto-fit. Enlarged so
                             // the ride reads in proportion to the (fixed-size) riders; the elevated
                             // track is allowed to pass OVER the central path, only the footprint of
                             // the supports must stay inside the fence.
const RIDE_LIFT = 0.0;       // the support structure must rest on the ground (no float), so no lift.
const Y_STRETCH = 2.1;       // vertical exaggeration of the track. Taller loops raise the inverted
                             // low sections so upside-down riders clear the ground WITHOUT lifting the
                             // grounded supports (footprint/horizontal scale unchanged → still fits).
const NUM_TRAINS = 2;        // trains running simultaneously on the circuit
const CARS_PER_TRAIN = 4;    // carriages per train (each carriage animated independently)
const NUM_CARS = NUM_TRAINS * CARS_PER_TRAIN; // 8 total
const CAR_GAP = 1.02;        // gap between carriages, in car-lengths (1 = touching)
const TRAIN_SPACING = 1.0 / NUM_TRAINS; // 0.5 — second train half a circuit ahead
const CART_SCALE = 3.8;      // visual up-scale of each cart so riders read at park scale

// Passenger seating, in DOLLY-LOCAL space (the dolly is unit-scaled; +Z = travel direction,
// +Y = up). Riders are seated exactly like the Tagada: upright, facing forward, hip-centred.
const SEAT_HALF_SEP = 0.5;   // lateral half-separation between the two seats (local X)
const SEAT_SURFACE_Y = 0.75; // seat-cushion height relative to the rail centre (local Y); the
                             // cart's seat sits ABOVE the rail, so hips land here, not below
const SEAT_FWD_Z = -0.05;    // fore/aft offset of the hips from the rail centre (local Z)
const SEAT_FACING_Y = 0;     // rider yaw — riders face the seat's open side (like the Tagada)
const G_EFF = 9.8;           // gravity for the energy model (world-units/s²)
const CURVE_SAMPLES = 80;    // control points kept for the CatmullRom
const NUM_FRAMES = 4000;     // resolution of the rotation-minimizing frame field

// Station state-machine speeds (world units/s)
const V_LAUNCH_MAX = 26.0;
const V_LAUNCH_MIN = 3.0;
const V_COAST_MIN = 14.0;
const STATION_PAUSE = 3.0;

// Passenger animation action pools
const COASTER_REST_POOL = ['rest', 'relax', 'lookL', 'lookR'];
const COASTER_RIDE_POOL = ['cheer', 'wave', 'cheer', 'wave', 'lookUp'];
const COASTER_BRAKE_POOL = ['rest', 'relax'];

const RAIL_MESH_NAME = 'Circle023_build_gen_1_0'; // GLTFLoader strips the dot from "Circle.023"
const RAIL_RING = 24; // verts per ring of the swept-circle rail tube (9480 verts = 395 rings × 24)

// ── Recover the rail centre-line (model-local) from the rail-tube GEOMETRY ──
// The tube is a circle swept along the track; its vertices are stored as sequential rings of 24.
// Each ring's centroid is a point on the rail centre-line. (Verified offline: ring size 24 yields a
// smooth, closed, gap-free path; other ring sizes give chaotic ~90° average turns.)
function extractCenterline(model) {
  const railMesh = model.getObjectByName(RAIL_MESH_NAME);
  if (!railMesh) throw new Error(`Coaster: rail mesh "${RAIL_MESH_NAME}" not found`);
  model.updateMatrixWorld(true);

  const pos = railMesh.geometry.attributes.position;
  const nRings = Math.floor(pos.count / RAIL_RING);
  const cen = new THREE.Vector3();
  const raw = [];
  for (let r = 0; r < nRings; r++) {
    cen.set(0, 0, 0);
    for (let j = 0; j < RAIL_RING; j++) {
      const idx = r * RAIL_RING + j;
      cen.x += pos.getX(idx); cen.y += pos.getY(idx); cen.z += pos.getZ(idx);
    }
    cen.multiplyScalar(1 / RAIL_RING);
    railMesh.localToWorld(cen);           // ring centroid → world
    raw.push(model.worldToLocal(cen.clone())); // → model-local (curve space)
  }

  // Low-pass filter the raw centroids to remove high-frequency mesh vertex noise
  const n = raw.length;
  let current = raw.map(p => p.clone());
  const iterations = 8;
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n];
      const curr = current[i];
      const succ = current[(i + 1) % n];
      next.push(new THREE.Vector3(
        (prev.x + curr.x * 2 + succ.x) / 4,
        (prev.y + curr.y * 2 + succ.y) / 4,
        (prev.z + curr.z * 2 + succ.z) / 4
      ));
    }
    current = next;
  }

  // Down-sample to a manageable control set; drop the closing point if it coincides with the start.
  const stride = Math.max(1, Math.round(current.length / CURVE_SAMPLES));
  const pts = [];
  for (let i = 0; i < current.length; i += stride) pts.push(current[i]);
  if (pts.length > 4 && pts[pts.length - 1].distanceTo(pts[0]) < 1e-3) pts.pop();

  return pts;
}

export async function buildCoaster({ position = [45, 0, 45], camera, renderer, anisotropy = 8 } = {}) {
  const templates = await loadVisitorTemplates(8);
  const gltf = await loadGLB(MODEL_URL); // loadGLB strips the imported animation — we never use it
  const model = gltf.scene;

  // Shadows on; drop imported lights / ground plane so they don't fight the park.
  const toRemove = [];
  model.traverse((o) => {
    if (o.isLight) toRemove.push(o);
    if (o.name === 'plane') toRemove.push(o);
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.map) m.map.anisotropy = anisotropy;
    }
  });
  toRemove.forEach((o) => o.parent && o.parent.remove(o));
  model.updateMatrixWorld(true);

  // ── Build the closed track curve from the rail geometry ──
  const ctrlPts = extractCenterline(model);
  const templateCartNode = model.getObjectByName('bumper_car_export_1001'); // dot stripped by loader
  if (!templateCartNode) throw new Error('Coaster: cart node "bumper_car_export_1001" not found');
  const curve = new THREE.CatmullRomCurve3(ctrlPts, true, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 20000;
  const trackLen = curve.getLength();

  // ── Precompute a rotation-minimizing (parallel-transport) frame field along the curve ──
  const tangents = [];
  for (let i = 0; i <= NUM_FRAMES; i++) tangents.push(curve.getTangentAt(i / NUM_FRAMES).normalize());

  const normals = [];
  let ref = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tangents[0].dot(ref)) > 0.9) ref.set(1, 0, 0);
  normals.push(new THREE.Vector3().crossVectors(tangents[0], ref).normalize());

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= NUM_FRAMES; i++) {
    const tPrev = tangents[i - 1], tCurr = tangents[i];
    const nCurr = new THREE.Vector3();
    axis.crossVectors(tPrev, tCurr);
    if (axis.lengthSq() < 1e-9) {
      nCurr.copy(normals[i - 1]).projectOnPlane(tCurr).normalize();
    } else {
      axis.normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(tPrev.dot(tCurr), -1, 1));
      q.setFromAxisAngle(axis, angle);
      nCurr.copy(normals[i - 1]).applyQuaternion(q).normalize();
    }
    normals.push(nCurr);
  }

  // Distribute the loop-closure mismatch (holonomy) evenly so the frame is seamless across the seam.
  const n0 = normals[0], nN = normals[NUM_FRAMES], t0 = tangents[0];
  const cosPhi = THREE.MathUtils.clamp(n0.dot(nN), -1, 1);
  const sinPhi = new THREE.Vector3().crossVectors(n0, nN).dot(t0);
  const phi = Math.atan2(sinPhi, cosPhi);
  const binormals = [];
  for (let i = 0; i <= NUM_FRAMES; i++) {
    q.setFromAxisAngle(tangents[i], -phi * (i / NUM_FRAMES));
    normals[i].applyQuaternion(q).normalize();
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], normals[i]).normalize());
  }

  // Pick whichever frame vector is "most up" as the carriage up-axis, oriented to +Y.
  let upVectors = binormals;
  if (Math.abs(normals[0].y) > Math.abs(binormals[0].y)) upVectors = normals;
  let upDot = 0;
  for (const v of upVectors) upDot += v.y;
  if (upDot < 0) for (const v of upVectors) v.negate();

  const upVectorsArray = upVectors;
  function getUpVectorAt(u, out) {
    let uc = u % 1; if (uc < 0) uc += 1;
    const f = uc * NUM_FRAMES, i0 = Math.floor(f), i1 = (i0 + 1) % (NUM_FRAMES + 1);
    return out.lerpVectors(upVectorsArray[i0], upVectorsArray[i1], f - i0).normalize();
  }

  const _tan = new THREE.Vector3();
  const _mtx = new THREE.Matrix4();
  const _origin = new THREE.Vector3(0, 0, 0);
  const _up = new THREE.Vector3();
  function frameQuat(u, out) {
    curve.getTangentAt(u % 1, _tan).normalize();
    getUpVectorAt(u, _up);
    _tan.negate();
    _mtx.lookAt(_origin, _tan, _up);
    return out.setFromRotationMatrix(_mtx);
  }

  // Top of the track (energy model) with headroom so V_COAST_MIN actually applies on crests.
  const samples = curve.getSpacedPoints(800);
  let yTop = -Infinity;
  for (const p of samples) if (p.y > yTop) yTop = p.y;
  yTop += 0.5;

  // ── Top group: ride auto-fit-scaled inside; panel stays at world (human) scale ──
  const group = new THREE.Group();
  group.name = 'coaster';

  const rideScaled = new THREE.Group();
  rideScaled.name = 'coaster_rideScaled';
  rideScaled.add(model);
  group.add(rideScaled);

  // Rotate the coaster by 270 degrees around Y axis
  rideScaled.rotation.y = Math.PI * 1.5;
  group.updateMatrixWorld(true);

  group.position.set(position[0], position[1], position[2]);
  group.updateMatrixWorld(true);

  // Auto-fit: scale the whole ride so its longest horizontal extent = TARGET_LONG.
  let bbox = new THREE.Box3().setFromObject(rideScaled);
  let size = bbox.getSize(new THREE.Vector3());
  const scale = TARGET_LONG / (Math.max(size.x, size.z) || 1);
  // Stretch height vertically by Y_STRETCH (taller loops → inverted riders clear the ground).
  rideScaled.scale.set(scale, scale * Y_STRETCH, scale);
  group.updateMatrixWorld(true);

  // Re-measure and position Y so the lowest point of the static structure rests exactly on the ground
  bbox = new THREE.Box3().setFromObject(rideScaled);
  size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  rideScaled.position.x += position[0] - center.x;
  rideScaled.position.y += position[1] - bbox.min.y;
  rideScaled.position.z += position[2] - center.z;
  // Raise the track/structure (carts + riders ride on it via rideScaled.matrix) by RIDE_LIFT so the
  // loop's low inverted section clears the ground. The control panel is parented to `group`, not
  // `rideScaled`, so it stays on the ground.
  rideScaled.position.y += RIDE_LIFT;
  group.updateMatrixWorld(true);

  // ── Seat the template cart on the curve, capture its on-rail local pose, remove all baked carts ──
  const cartCentroid = new THREE.Box3().setFromObject(templateCartNode).getCenter(new THREE.Vector3());
  model.worldToLocal(cartCentroid);
  let uCar = 0, best = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = samples[i].distanceToSquared(cartCentroid);
    if (d < best) { best = d; uCar = i / samples.length; }
  }

  const dolly0 = new THREE.Group();
  dolly0.name = 'coaster_t0_c0';
  group.add(dolly0); // Add directly to group to avoid scale inheritance from rideScaled

  // Position and orient dolly0 in group space:
  const _pt0 = curve.getPointAt(uCar);
  _pt0.applyMatrix4(model.matrix).applyMatrix4(rideScaled.matrix);
  dolly0.position.copy(_pt0);

  const _q0 = new THREE.Quaternion();
  frameQuat(uCar, _q0);
  dolly0.quaternion.copy(rideScaled.quaternion).multiply(_q0);
  dolly0.updateMatrixWorld(true);

  // Attach cart template
  dolly0.attach(templateCartNode);
  
  // Rotate the cart template by 180 degrees (Math.PI) around its local Z axis (vertical dolly Y)
  // so that the carriages and the passengers face forward in the direction of movement.
  templateCartNode.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI);
  
  // Force uniform scale based on horizontal scale * CART_SCALE to prevent non-uniform scale skewing on carriages and riders
  const baseScale = templateCartNode.scale.x * CART_SCALE;
  templateCartNode.scale.set(baseScale, baseScale, baseScale);

  const carLocalPos = templateCartNode.position.clone();
  const carLocalQuat = templateCartNode.quaternion.clone();
  const carLocalScale = templateCartNode.scale.clone();

  // Carriage footprint along the track → spacing in normalized arc-length.
  // carLen is measured in WORLD units (the cart is unit-scaled under `group`), so the spacing
  // must divide by the WORLD track length, not the model-space length — otherwise the gap is
  // shrunk by the auto-fit scale (~0.29) and the carriages overlap nose-to-tail.
  const trackLenWorld = trackLen * scale;
  const cartSize = new THREE.Box3().setFromObject(templateCartNode).getSize(new THREE.Vector3());
  const carLen = Math.max(cartSize.x, cartSize.z);
  const spacingU = (carLen * CAR_GAP) / trackLenWorld;

  // Remove the other 5 baked cart nodes (we only drive our own clones).
  const leftoverCarts = [];
  model.traverse((o) => {
    if (o !== templateCartNode && /^bumper_car_export_/.test(o.name) && o.parent && o.parent !== dolly0) {
      if (!/_rollercoastercart_0$/.test(o.name)) leftoverCarts.push(o);
    }
  });
  leftoverCarts.forEach((o) => o.parent && o.parent.remove(o));

  // ── Build 2 trains × 4 carriages — every carriage on its own dolly, offset independently.
  const cars = [{ dolly: dolly0, offset: 0 }]; // train 0, carriage 0
  for (let i = 1; i < NUM_CARS; i++) {
    const t = Math.floor(i / CARS_PER_TRAIN);
    const c = i % CARS_PER_TRAIN;
    const offset = -t * TRAIN_SPACING + c * spacingU;

    const dolly = new THREE.Group();
    dolly.name = `coaster_t${t}_c${c}`;
    const clone = templateCartNode.clone(true);
    clone.position.copy(carLocalPos);
    clone.quaternion.copy(carLocalQuat);
    clone.scale.copy(carLocalScale);
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    dolly.add(clone);
    group.add(dolly); // Add directly to group to avoid scale inheritance
    cars.push({ dolly, offset });
  }

  // ── Seat passengers in the carriages ──────────────────────────────────────────────────────
  // Seating mirrors the Tagada exactly: riders are parented to the UNIT-SCALE dolly (whose frame
  // is +Z = travel direction, +Y = up), sit upright, face forward, and are dropped by the hip-bone
  // offset so the hips land precisely on the seat point. The dolly rolls/inverts with the track,
  // so the riders bank and go upside-down through the loop rigidly attached to their carriage.
  const riders = [];
  const riderHeight = getPassengerWorldHeight() * 0.88; // same rider size as the Tagada / Carousel

  cars.forEach((car, carIdx) => {
    [0, 1].forEach((seatIdx) => {
      const template = templates[(carIdx * 2 + seatIdx) % templates.length];
      if (!template) return;

      const rider = makeRider(template, riderHeight, {
        pool: ['rest'],
        facingY: SEAT_FACING_Y, // face the +Z direction of travel
        phase: carIdx * 1.7 + seatIdx * 0.9,
      });

      // Hip-bone centring (identical method to the Tagada): drop the figure so the hip bone lands
      // exactly on the seat surface, centred laterally on its own seat.
      rider.fig.updateMatrixWorld(true);
      const hipBone = rider.fig.getObjectByName('Hips');
      const sx = seatIdx === 0 ? -SEAT_HALF_SEP : SEAT_HALF_SEP;
      if (hipBone) {
        const hp = hipBone.getWorldPosition(new THREE.Vector3());
        rider.fig.worldToLocal(hp);
        hp.multiplyScalar(rider.scale);
        rider.pivot.position.set(sx - hp.x, SEAT_SURFACE_Y - hp.y, SEAT_FWD_Z - hp.z);
      } else {
        rider.pivot.position.set(sx, SEAT_SURFACE_Y - riderHeight * 0.28, SEAT_FWD_Z);
      }

      rider.restX = rider.pivot.position.x;
      rider.restY = rider.pivot.position.y;
      rider.restZ = rider.pivot.position.z;

      car.dolly.add(rider.pivot); // child of the unit-scale dolly — no cart-scale counteraction
      riders.push(rider);
    });
  });

  // ── Control panel (semaphore + lever), human-scaled, at the OUTSIDE corner of the footprint ──
  // Smooth start/stop acceleration (rampUp: 1.0s, rampDown: 1.5s)
  const controlPanel = new ControlPanel({ initialRunning: true, rampUp: 1.0, rampDown: 1.5 });
  group.add(controlPanel.group);
  group.updateMatrixWorld(true);

  // Place the panel near the central path (West side) facing South (+Z) towards the entrance
  controlPanel.group.position.set(7.5 - position[0], 0, 33.0 - position[2]);
  controlPanel.group.rotation.set(0, 0, 0);
  group.updateMatrixWorld(true);

  // ── Footprint for vegetation keep-out ──
  model.updateMatrixWorld(true);
  const FOOT_SAMPLES = 260;
  const footPts = [];
  const _fp = new THREE.Vector3();
  for (let i = 0; i < FOOT_SAMPLES; i++) {
    curve.getPointAt(i / FOOT_SAMPLES, _fp);
    // Transform track curve points to world space
    _fp.applyMatrix4(model.matrix).applyMatrix4(rideScaled.matrix);
    group.localToWorld(_fp);
    footPts.push(_fp.x, _fp.z);
  }
  const panelWorld = new THREE.Vector3();
  controlPanel.group.getWorldPosition(panelWorld);
  footPts.push(panelWorld.x, panelWorld.z);
  group.userData.footprint = { pts: footPts, pad: 7.0 };

  // ── Controller / station state-machine ──
  const controller = {
    cars,
    curve,
    u: uCar,
    riders,
    panel: controlPanel.group,
    get running() { return controlPanel.running; },
    set running(v) { controlPanel.running = v; },
    speedScale: 1.0,
    state: 'STATION_STOP',
    stopTimer: STATION_PAUSE,
    lastSpeed: 0.0,
    vBrakeStart: 0.0,
    toggle() { controlPanel.toggle(); },
    start() { controlPanel.running = true; },
    stop() { controlPanel.running = false; },
    setSpeed(v) { this.speedScale = Math.max(0, v); },
  };

  const _pt = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  group.userData.tick = (delta, _time) => {
    const dt = Math.min(0.1, delta);
    const ease = controlPanel.tick(delta);
    controller.ease = ease;

    if (ease > 0.0001) {
      let lap = (controller.u - uCar) % 1;
      if (lap < 0) lap += 1;

      // 1. State transitions
      if (controller.state === 'STATION_STOP') {
        controller.u = uCar; lap = 0;
        controller.stopTimer -= dt * ease;
        if (controller.stopTimer <= 0) controller.state = 'LAUNCH';
      } else if (controller.state === 'LAUNCH') {
        if (lap >= 0.15) controller.state = 'COASTING';
      } else if (controller.state === 'COASTING') {
        if (lap >= 0.85) { controller.state = 'BRAKING'; controller.vBrakeStart = controller.lastSpeed || 20.0; }
      } else if (controller.state === 'BRAKING') {
        if (lap < 0.85) { controller.u = uCar; controller.state = 'STATION_STOP'; controller.stopTimer = STATION_PAUSE; lap = 0; }
      }

      // 2. State-based speed
      let v = 0.0;
      if (controller.state === 'LAUNCH') {
        v = V_LAUNCH_MIN + (V_LAUNCH_MAX - V_LAUNCH_MIN) * (lap / 0.15);
      } else if (controller.state === 'COASTING') {
        const yLead = curve.getPointAt(controller.u % 1, _pt).y;
        const vGrav = Math.sqrt(V_COAST_MIN * V_COAST_MIN + 2 * G_EFF * Math.max(0, yTop - yLead) * scale);
        if (lap < 0.30) {
          const b = (lap - 0.15) / 0.15;
          v = (1 - b) * V_LAUNCH_MAX + b * vGrav;
        } else v = vGrav;
      } else if (controller.state === 'BRAKING') {
        const t = (lap - 0.85) / 0.15;
        v = Math.max(1.5, controller.vBrakeStart * (1 - t) * (1 - t));
      }

      controller.lastSpeed = v;
      if (controller.state !== 'STATION_STOP') {
        const du = (v * ease * controller.speedScale / trackLenWorld) * dt;
        controller.u = (controller.u + du) % 1;
      }
    }

    // 3. Place every carriage independently on the rail.
    for (const c of cars) {
      let u = (controller.u - c.offset) % 1;
      if (u < 0) u += 1;
      
      // Get position on curve in model space
      _pt.copy(curve.getPointAt(u));
      // Transform from model space -> rideScaled space -> group space
      _pt.applyMatrix4(model.matrix);
      _pt.applyMatrix4(rideScaled.matrix);
      c.dolly.position.copy(_pt);
      
      // Get orientation, apply rideScaled rotation
      frameQuat(u, _q);
      c.dolly.quaternion.copy(rideScaled.quaternion).multiply(_q);
    }

    // 4. Update riders dynamically (keeps idle breathing and head-turning active when stopped)
    const timeVal = _time;

    let activePool = COASTER_REST_POOL;
    if (controller.state === 'LAUNCH' || controller.state === 'COASTING') {
      activePool = COASTER_RIDE_POOL;
    } else if (controller.state === 'BRAKING') {
      activePool = COASTER_BRAKE_POOL;
    }

    for (const r of controller.riders) {
      // If coaster state changed, set the new action pool and force immediate pose switch
      if (r.pool !== activePool) {
        r.pool = activePool;
        r.from = r.to;
        r.to = activePool[Math.floor(Math.random() * activePool.length)];
        r.tStart = timeVal;
        r.nextSwitch = timeVal + r.transDur + 2.5 + Math.random() * 4;
      }
      updateRider(r, timeVal);

      // Add dynamic sway to torso and head based on ride state (inertia simulation)
      const B = r.bones;
      if (controller.state === 'LAUNCH' || controller.state === 'COASTING') {
        const swayAmp = controller.state === 'LAUNCH' ? 0.12 : 0.06;
        if (B.Torso) {
          B.Torso.bone.rotation.x += swayAmp * Math.sin(timeVal * 5.0 + r.phase);
          B.Torso.bone.rotation.z += 0.04 * Math.cos(timeVal * 3.0 + r.phase);
        }
        if (B.Head) {
          B.Head.bone.rotation.x += 0.08 * Math.sin(timeVal * 6.0 + r.phase);
        }
      }
    }
  };

  // ── Hide the GLB's built-in operator-booth sign ──
  // The ride's name marquee is now a shared, free-standing RideSign (see js/environment/RideSign.js,
  // placed in main.js). Keeping it out of `model` avoids the coaster's non-uniform Y_STRETCH that
  // would otherwise distort it. Here we just hide the model's default panel art.
  const oldSign = model.getObjectByName('panel_1001');
  if (oldSign) {
    oldSign.children.forEach((child) => {
      child.visible = false;
    });
  }

  // ── Click-to-toggle via raycasting on the panel ──
  if (camera && renderer) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dom = renderer.domElement;
    const pick = (ev) => {
      const r = dom.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(controlPanel.group, true).length > 0;
    };
    dom.addEventListener('pointerdown', (ev) => { if (pick(ev)) controller.toggle(); });
    dom.addEventListener('pointermove', (ev) => {
      if (pick(ev)) dom.style.cursor = 'pointer';
      else if (dom.style.cursor === 'pointer') dom.style.cursor = '';
    });
  }

  group.userData.controller = controller;
  return group;
}
