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
import TWEEN from '@tweenjs/tween.js';
import { loadGLB } from '../utils/loaders.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { eventBus } from '../utils/EventBus.js';
import { Easings } from '../utils/Easings.js';
import { isNightNow } from '../lighting/DayNightCycle.js';
import { loadVisitorTemplates, makeRider, updateRider, getPassengerWorldHeight } from '../people/Passengers.js';

const MODEL_URL = 'assets/models/rides/coaster_track.glb';
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
const CAR_GAP = 1.0;         // centre-to-centre spacing in car-lengths (1 = nose-to-tail touching)
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
  const rawPts = [];
  const ringVerts = [];

  // ── Phase 1: collect centroids and all ring-vertex directions in model-local space ──
  for (let r = 0; r < nRings; r++) {
    const cenLoc = new THREE.Vector3();
    for (let j = 0; j < RAIL_RING; j++) {
      const idx = r * RAIL_RING + j;
      cenLoc.x += pos.getX(idx); cenLoc.y += pos.getY(idx); cenLoc.z += pos.getZ(idx);
    }
    cenLoc.multiplyScalar(1 / RAIL_RING);

    railMesh.localToWorld(cenLoc);
    const cenMod = model.worldToLocal(cenLoc.clone());
    rawPts.push(cenMod);

    const dirs = [];
    for (let j = 0; j < RAIL_RING; j++) {
      const idx = r * RAIL_RING + j;
      const vLoc = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
      railMesh.localToWorld(vLoc);
      const vMod = model.worldToLocal(vLoc);
      dirs.push(vMod.sub(cenMod).normalize());
    }
    ringVerts.push(dirs);
  }

  // ── Phase 2: Parallel Transport to extract up vectors without parasitic twist ──
  const n = rawPts.length;
  const rawUps = [];

  // Ring 0: pick the spoke closest to world-up for a stable initial frame
  {
    let bestU = null;
    let bestDot = -Infinity;
    const worldUp = new THREE.Vector3(0, 1, 0);
    for (const uDir of ringVerts[0]) {
      const uWorld = uDir.clone().applyMatrix4(model.matrixWorld).sub(
        rawPts[0].clone().applyMatrix4(model.matrixWorld)
      ).normalize();
      const dot = uWorld.dot(worldUp);
      if (dot > bestDot) { bestDot = dot; bestU = uDir; }
    }
    rawUps.push(bestU);
  }

  // Rings 1..n-1: parallel-transport previous up, then pick closest spoke
  for (let r = 1; r < n; r++) {
    const prevT = rawPts[r].clone().sub(rawPts[r - 2 < 0 ? n + (r - 2) : r - 2]).normalize();
    const currT = rawPts[(r + 1) % n].clone().sub(rawPts[r - 1]).normalize();
    const qTrans = new THREE.Quaternion().setFromUnitVectors(prevT, currT);
    const projectedPrevU = rawUps[r - 1].clone().applyQuaternion(qTrans);

    let bestU = null;
    let bestDot = -Infinity;
    for (const uDir of ringVerts[r]) {
      const dot = uDir.dot(projectedPrevU);
      if (dot > bestDot) { bestDot = dot; bestU = uDir; }
    }
    rawUps.push(bestU);
  }

  // Low-pass filter the points AND the ups to remove high-frequency mesh vertex noise
  let curPts = rawPts.map(p => p.clone());
  let curUps = rawUps.map(p => p.clone());
  
  const iterations = 3;
  for (let iter = 0; iter < iterations; iter++) {
    const nxtPts = [], nxtUps = [];
    for (let i = 0; i < n; i++) {
      const prevP = curPts[(i - 1 + n) % n], currP = curPts[i], succP = curPts[(i + 1) % n];
      nxtPts.push(new THREE.Vector3(
        (prevP.x + currP.x * 2 + succP.x) / 4,
        (prevP.y + currP.y * 2 + succP.y) / 4,
        (prevP.z + currP.z * 2 + succP.z) / 4
      ));
      
      const prevU = curUps[(i - 1 + n) % n], currU = curUps[i], succU = curUps[(i + 1) % n];
      nxtUps.push(new THREE.Vector3(
        (prevU.x + currU.x * 2 + succU.x) / 4,
        (prevU.y + currU.y * 2 + succU.y) / 4,
        (prevU.z + currU.z * 2 + succU.z) / 4
      ).normalize());
    }
    curPts = nxtPts;
    curUps = nxtUps;
  }

  // Down-sample to a manageable control set; drop the closing point if it coincides with the start.
  const stride = Math.max(1, Math.round(curPts.length / CURVE_SAMPLES));
  const pts = [], ups = [];
  for (let i = 0; i < curPts.length; i += stride) {
    pts.push(curPts[i]);
    ups.push(curUps[i]);
  }
  
  if (pts.length > 4 && pts[pts.length - 1].distanceTo(pts[0]) < 1e-3) {
    pts.pop();
    ups.pop();
  }

  return { pts, ups };
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

  // ── Build the closed track curve and twist curve from the rail geometry ──
  const { pts: ctrlPts, ups: ctrlUps } = extractCenterline(model);
  const templateCartNode = model.getObjectByName('bumper_car_export_1001'); // dot stripped by loader
  if (!templateCartNode) throw new Error('Coaster: cart node "bumper_car_export_1001" not found');
  const curve = new THREE.CatmullRomCurve3(ctrlPts, true, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 20000;
  const trackLen = curve.getLength();
  
  const upCurve = new THREE.CatmullRomCurve3(ctrlUps, true, 'catmullrom', 0.5);

  // ── Precompute the frame field capturing the physical banking of the mesh ──
  // Use the filtered up vectors from the geometry directly; the rail artist already modelled
  // the correct banking. No twist offset is applied — that would inject parasitic roll because
  // the correction axis (the tangent) changes direction along the track.
  const upVectors = [];
  for (let i = 0; i <= NUM_FRAMES; i++) {
    const u = i / NUM_FRAMES;
    const M = upCurve.getPointAt(u).normalize();
    upVectors.push(M);
  }

  // Ensure consistent orientation direction globally
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

  // Orientation for a carriage spanning two coupling points (front & back, in CURVE space), so the
  // cars of a train articulate and stay attached at their shared couplings. Like frameQuat, but the
  // "tangent" is the chord direction between the couplings; up is the frame up at the car midpoint.
  function chordQuat(pFront, pBack, muUp, out) {
    _tan.subVectors(pFront, pBack).normalize();
    getUpVectorAt(muUp, _up);
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

  // Precompute direction matrix: model-local → group-local (rotation + non-uniform scale, no
  // translation).  This captures Y_STRETCH so that carriage orientations follow the actual
  // (vertically stretched) track rather than the original (unstretched) curve geometry.
  const _dirMat = new THREE.Matrix3().setFromMatrix4(
    new THREE.Matrix4().multiplyMatrices(rideScaled.matrix, model.matrix)
  );

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
  // Carriage length ALONG TRAVEL = the cart's extent on the dolly's local Z (the tangent/travel axis),
  // measured in dolly-local (world-scale) space. Using the true nose-to-tail length — NOT the widest
  // horizontal extent (which is the car's WIDTH and is much larger) — makes the inter-car spacing match
  // the car, so the 4 cars of a train sit attached nose-to-tail instead of leaving a big gap.
  dolly0.updateMatrixWorld(true);
  const _dInv = new THREE.Matrix4().copy(dolly0.matrixWorld).invert();
  const _cartBox = new THREE.Box3();
  const _cv = new THREE.Vector3();
  templateCartNode.updateMatrixWorld(true);
  templateCartNode.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (const xx of [bb.min.x, bb.max.x]) for (const yy of [bb.min.y, bb.max.y]) for (const zz of [bb.min.z, bb.max.z]) {
      _cv.set(xx, yy, zz).applyMatrix4(o.matrixWorld).applyMatrix4(_dInv);
      _cartBox.expandByPoint(_cv);
    }
  });
  const carLen = _cartBox.max.z - _cartBox.min.z; // nose-to-tail length along the travel (dolly Z) axis
  const carSpacing = carLen * CAR_GAP;            // world distance between consecutive couplings

  // ── World-arc-length table ───────────────────────────────────────────────────────────────────
  // The track is stretched vertically (Y_STRETCH), so equal steps in the curve's NORMALISED arc-length
  // are NOT equal WORLD distances — on loops the gap between cars balloons. We build a table of
  // cumulative world distance (group space) along the track and space couplings by real world length,
  // so the 4 cars of a train stay attached everywhere (straights and loops alike).
  const ARC_SAMPLES = 2400;
  const worldArc = new Float32Array(ARC_SAMPLES + 1);
  const _wpA = new THREE.Vector3(), _wpB = new THREE.Vector3();
  _wpA.copy(curve.getPointAt(0)).applyMatrix4(model.matrix).applyMatrix4(rideScaled.matrix);
  worldArc[0] = 0;
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    _wpB.copy(curve.getPointAt(i / ARC_SAMPLES)).applyMatrix4(model.matrix).applyMatrix4(rideScaled.matrix);
    worldArc[i] = worldArc[i - 1] + _wpB.distanceTo(_wpA);
    _wpA.copy(_wpB);
  }
  const totalWorldArc = worldArc[ARC_SAMPLES];
  const uToWorldArc = (u) => {
    let uu = u % 1; if (uu < 0) uu += 1;
    const f = uu * ARC_SAMPLES, i = Math.floor(f);
    return worldArc[i] + (worldArc[i + 1] - worldArc[i]) * (f - i);
  };
  const worldArcToU = (s) => {
    let ss = s % totalWorldArc; if (ss < 0) ss += totalWorldArc;
    let lo = 0, hi = ARC_SAMPLES;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (worldArc[mid] < ss) lo = mid + 1; else hi = mid; }
    const i = Math.max(1, lo);
    const seg = worldArc[i] - worldArc[i - 1];
    return (i - 1 + (seg > 1e-6 ? (ss - worldArc[i - 1]) / seg : 0)) / ARC_SAMPLES;
  };

  // Remove the other 5 baked cart nodes (we only drive our own clones).
  const leftoverCarts = [];
  model.traverse((o) => {
    if (o !== templateCartNode && /^bumper_car_export_/.test(o.name) && o.parent && o.parent !== dolly0) {
      if (!/_rollercoastercart_0$/.test(o.name)) leftoverCarts.push(o);
    }
  });
  leftoverCarts.forEach((o) => o.parent && o.parent.remove(o));

  // ── Build 2 trains × 4 carriages — each carriage on its own dolly, spaced by WORLD arc-length so the
  //    cars of a train stay coupled. arcOffset = world distance behind the lead reference (controller.u).
  const cars = [{ dolly: dolly0, arcOffset: 0 }]; // train 0, carriage 0 (the lead)
  for (let i = 1; i < NUM_CARS; i++) {
    const t = Math.floor(i / CARS_PER_TRAIN);
    const c = i % CARS_PER_TRAIN;
    const arcOffset = t * (totalWorldArc * TRAIN_SPACING) + c * carSpacing;

    const dolly = new THREE.Group();
    dolly.name = `coaster_t${t}_c${c}`;
    const clone = templateCartNode.clone(true);
    clone.position.copy(carLocalPos);
    clone.quaternion.copy(carLocalQuat);
    clone.scale.copy(carLocalScale);
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    dolly.add(clone);
    group.add(dolly); // Add directly to group to avoid scale inheritance
    cars.push({ dolly, arcOffset });
  }

  // ── Seat passengers in the carriages ──────────────────────────────────────────────────────
  // Seating mirrors the Tagada exactly: riders are parented to the UNIT-SCALE dolly (whose frame
  // is +Z = travel direction, +Y = up), sit upright, face forward, and are dropped by the hip-bone
  // offset so the hips land precisely on the seat point. The dolly rolls/inverts with the track,
  // so the riders bank and go upside-down through the loop rigidly attached to their carriage.
  const riders = [];
  const riderHeight = getPassengerWorldHeight() * 0.88; // same rider size as the Tagada / Carousel

  const _dynP = new THREE.Vector3(), _dynV = new THREE.Vector3(), _dynA = new THREE.Vector3();
  const _dynQI = new THREE.Quaternion();

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

      // Riders appear upside-down in the dolly frame: the GLB model's root has an intrinsic
      // rotation that puts the head toward -Y of the dolly. Flip 180° around the dolly Z axis:
      //   • Z-rotation π  →  Y flips (head↔feet) ✓  and  X flips (left↔right, cosmetically fine)
      //   • Z direction unchanged  →  forward/backward facing is preserved ✓
      const _flipZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
      rider.fig.quaternion.premultiply(_flipZ);

      car.dolly.add(rider.pivot); // child of the unit-scale dolly — no cart-scale counteraction
      riders.push(rider);
    });
  });

  // ── Sophisticated carriage lighting ───────────────────────────────────────────────────────────
  // The glow ADHERES to the carriage model itself: we make the cart's own materials emissive (via their
  // texture as emissiveMap) so the real body lights up — no floating ring. Plus warm headlights / red
  // tail-lights on the model's front & back, a warm interior lamp that lights the riders, and a soft
  // coloured UNDER-LIGHT that pools a glow on the ground beneath each car. Body glow + under-light
  // recolour with the rails (picker); all ramp up at night. Cart body is dark/normal by day.
  const cartGlows = [];        // emissive accent dots (head/tail lights)
  const cartBodyMats = [];     // the carriage's OWN materials, made emissive (recoloured with rails)
  const cartLights = [];       // warm interior lamps (light the riders)
  const cartUnderLights = [];  // coloured under-glow pooled on the ground (recoloured with rails)
  const emiss = (col) => new THREE.MeshStandardMaterial({ color: 0x080808, emissive: col, emissiveIntensity: 0, roughness: 0.3, metalness: 0.2, toneMapped: false });
  const CX = 0.17, CZ = 0.36;                 // cart footprint centre (dolly-local)
  const dotGeo = new THREE.SphereGeometry(0.14, 12, 10);
  const bodyMatMap = new Map();               // share one emissive clone per original cart material
  for (const car of cars) {
    const d = car.dolly;
    const cartNode = d.children[0];           // the cart body (added before riders / lights)
    // Make the carriage body emissive — the glow sits ON the real model.
    cartNode.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      const orig = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!orig) return;
      if (!bodyMatMap.has(orig)) {
        const c = orig.clone();
        if (c.map) c.emissiveMap = c.map;     // glow follows the body's own paint/detail
        c.emissive = new THREE.Color(0xffffff); // white × emissiveMap ⇒ the body glows in its OWN colours
        c.emissiveIntensity = 0.0;            // dark by day, ramps up at night
        bodyMatMap.set(orig, c);
        cartBodyMats.push(c);
      }
      o.material = bodyMatMap.get(orig);
    });

    // warm interior lamp (riders)
    const light = new THREE.PointLight(0xffd9a0, 0.0, 6.5, 2.0);
    light.position.set(CX, 1.15, CZ);
    light.layers.set(2);
    d.add(light); cartLights.push(light);

    // soft coloured under-light → pools a glow on the ground below each car
    const under = new THREE.PointLight(0x3dd2ff, 0.0, 9.0, 2.0);
    under.position.set(CX, -0.3, CZ);
    under.layers.set(2);
    d.add(under); cartUnderLights.push(under);

    // headlights (front, warm white) + tail-lights (back, red), sitting on the model
    const hlMat = emiss(0xfff2d0), tlMat = emiss(0xff2630);
    for (const sx of [-0.55, 0.55]) {
      const hl = new THREE.Mesh(dotGeo, hlMat); hl.position.set(CX + sx, 0.72, CZ + 1.5); d.add(hl); cartGlows.push(hl);
      const tl = new THREE.Mesh(dotGeo, tlMat); tl.position.set(CX + sx, 0.72, CZ - 1.4); d.add(tl); cartGlows.push(tl);
    }
  }

  // ── Control panel (semaphore + lever), human-scaled, at the OUTSIDE corner of the footprint ──
  // Smooth start/stop acceleration (rampUp: 1.0s, rampDown: 1.5s)
  const controlPanel = new ControlPanel({ initialRunning: true });
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

  // ── Night light: the RAIL ITSELF lights up ─────────────────────────────────────────────────────
  // The two real rails live in ONE mesh together with the support pylons (support_tall010_build_gen_1_0).
  // Geometry is untouched — we just split that mesh into two material groups by each triangle's distance
  // to the track centre-line: triangles ON the track (the two rails + ties) get an emissive material;
  // the pylons keep the original dark material. So the real rails glow as continuous neon lines while the
  // supports stay dark. `toneMapped = false` keeps the glow bright through ACES. Recoloured by the picker.
  const railGlowMats = [];
  const trackMesh = model.getObjectByName('support_tall010_build_gen_1_0');
  if (trackMesh) {
    trackMesh.updateMatrixWorld(true);
    const curveW = [];
    for (let i = 0; i <= 800; i++) curveW.push(curve.getPointAt(i / 800).applyMatrix4(model.matrixWorld));
    // nearest centre-line sample → [squared 3D distance, that sample's Y]
    const nearest = (p) => { let m = Infinity, cy = 0; for (const c of curveW) { const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z; const d = dx*dx + dy*dy + dz*dz; if (d < m) { m = d; cy = c.y; } } return [m, cy]; };

    const geo = trackMesh.geometry;
    const pos = geo.attributes.position;
    let idx = geo.index ? geo.index.array : null;
    if (!idx) { idx = new Uint32Array(pos.count); for (let i = 0; i < pos.count; i++) idx[i] = i; }
    const mw = trackMesh.matrixWorld;
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), cen = new THREE.Vector3();
    // A triangle is part of the rails/ties only if it is BOTH close to the track line AND at the track's
    // height there. Pylons drop well below the line they hang from, so the Y test removes them — even the
    // short pylons in low sections and the pylon tops that touch the rail.
    const THRESH2 = 1.5 * 1.5;
    const rail = [], sup = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      vA.fromBufferAttribute(pos, a).applyMatrix4(mw);
      vB.fromBufferAttribute(pos, b).applyMatrix4(mw);
      vC.fromBufferAttribute(pos, c).applyMatrix4(mw);
      cen.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
      const [d2, cy] = nearest(cen);
      if (d2 < THRESH2 && cen.y > cy - 0.9) { rail.push(a, b, c); } else { sup.push(a, b, c); }
    }
    const newIdx = new Uint32Array(rail.length + sup.length);
    newIdx.set(rail, 0); newIdx.set(sup, rail.length);
    geo.setIndex(new THREE.BufferAttribute(newIdx, 1));
    geo.clearGroups();
    geo.addGroup(0, rail.length, 0);          // group 0 → emissive rail material
    geo.addGroup(rail.length, sup.length, 1); // group 1 → original support material
    const orig = Array.isArray(trackMesh.material) ? trackMesh.material[0] : trackMesh.material;
    const railMat = orig.clone();
    railMat.emissive = new THREE.Color(0x3dd2ff);
    railMat.emissiveIntensity = 0.0;
    railMat.toneMapped = false;
    railGlowMats.push(railMat);
    trackMesh.material = [railMat, orig];
  }
  const coasterColor = new THREE.Color(0x3dd2ff);
  eventBus.on('color-change', (hex) => {
    const target = new THREE.Color(hex);
    new TWEEN.Tween(coasterColor)
      .to(target, 500)
      .easing(Easings.COLOR)
      .onUpdate(() => {
        for (const m of railGlowMats) m.emissive.copy(coasterColor);
        for (const l of cartUnderLights) l.color.copy(coasterColor);
      })
      .start();
  });

  // ── Controller / station state-machine ──
  const controller = {
    cars,
    curve,
    u: uCar,
    riders,
    panel: controlPanel.group,
    nightMix: 0,
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
  const _ptF = new THREE.Vector3();
  const _ptB = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  group.userData.tick = (delta, _time) => {
    const dt = Math.min(0.1, delta);
    const ease = controlPanel.tick(delta, controller.speedScale);
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

    // 3. Place every carriage as a SEGMENT spanning its two coupling points, spaced by uniform WORLD
    //    distance (carSpacing) so cars in a train stay coupled even where Y_STRETCH balloons the loops.
    //    Adjacent cars share a coupling, so they meet and articulate through curves instead of gapping.
    //    Both POSITION and ORIENTATION are computed in GROUP space (after the non-uniform Y_STRETCH)
    //    so the carriages follow the actual stretched rail rotation exactly.
    const sLead = uToWorldArc(controller.u);
    for (const c of cars) {
      const frontArc = sLead - c.arcOffset;     // front coupling, world arc-length
      const backArc = frontArc - carSpacing;    // back coupling (one car behind)
      const uf = worldArcToU(frontArc);
      const ub = worldArcToU(backArc);

      // Transform coupling points to GROUP space (includes non-uniform Y_STRETCH).
      _ptF.copy(curve.getPointAt(uf)).applyMatrix4(model.matrix).applyMatrix4(rideScaled.matrix);
      _ptB.copy(curve.getPointAt(ub)).applyMatrix4(model.matrix).applyMatrix4(rideScaled.matrix);

      // Position = midpoint of the two couplings in group space.
      _pt.copy(_ptF).add(_ptB).multiplyScalar(0.5);
      c.dolly.position.copy(_pt);

      // Orientation in GROUP space: chord direction and up vector both account for Y_STRETCH,
      // so the carriages follow the actual stretched rail rotation point-by-point.
      const muUp = worldArcToU(frontArc - carSpacing * 0.5);
      getUpVectorAt(muUp, _up);
      _up.applyMatrix3(_dirMat).normalize();
      _tan.subVectors(_ptF, _ptB).normalize();
      _tan.negate();
      // Ensure up is perpendicular to tangent (non-uniform Y_STRETCH may have skewed it).
      // This produces a clean lookAt frame so passengers stay upright relative to the car.
      const upDotTan = _up.dot(_tan);
      _up.addScaledVector(_tan, -upDotTan).normalize();
      _mtx.lookAt(_origin, _tan, _up);
      c.dolly.quaternion.setFromRotationMatrix(_mtx);
    }

    // 4. Update riders dynamically (keeps idle breathing and head-turning active when stopped)
    const timeVal = _time;

    let activePool = COASTER_REST_POOL;
    if (controller.state === 'LAUNCH' || controller.state === 'COASTING') {
      activePool = COASTER_RIDE_POOL;
    } else if (controller.state === 'BRAKING') {
      activePool = COASTER_BRAKE_POOL;
    }

    // Per-car kinematics: world acceleration measured from the dolly, smoothed
    // and expressed in the car frame (+z = travel, x = lateral, y = vertical).
    const dtc = Math.max(dt, 1e-3);
    for (const car of cars) {
      if (!car.dyn) car.dyn = { p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), q: new THREE.Quaternion(), init: false };
      const D = car.dyn;
      car.dolly.getWorldPosition(_dynP);
      car.dolly.getWorldQuaternion(D.q);
      if (!D.init) { D.p.copy(_dynP); D.init = true; }
      _dynV.copy(_dynP).sub(D.p).divideScalar(dtc);
      D.p.copy(_dynP);
      _dynA.copy(_dynV).sub(D.v).divideScalar(dtc);
      D.v.copy(_dynV);
      _dynA.applyQuaternion(_dynQI.copy(D.q).invert());
      if (_dynA.length() > 80) _dynA.setLength(80);
      D.a.lerp(_dynA, Math.min(1, dtc * 8));
    }

    controller.riders.forEach((r, idx) => {
      // If coaster state changed, set the new action pool and force immediate pose switch
      if (r.pool !== activePool) {
        r.pool = activePool;
        r.from = r.to;
        r.to = activePool[Math.floor(Math.random() * activePool.length)];
        r.tStart = timeVal;
        r.nextSwitch = timeVal + r.transDur + 2.5 + Math.random() * 4;
      }
      updateRider(r, timeVal);

      // Physics-based inertia: bodies respond to the REAL car acceleration —
      // pressed back on launch, thrown forward on the brakes, leaning out of
      // curves — plus a small speed-proportional rattle.
      const B = r.bones;
      const car = cars[(idx / 2) | 0];
      const a = car && car.dyn ? car.dyn.a : null;
      if (a && ease > 0.0001) {
        const lim = (v, l) => Math.max(-l, Math.min(l, v));
        const pitch = lim(-a.z * 0.010, 0.22);          // accel → pressed back
        const roll = lim(a.x * 0.008, 0.16);            // curve → lean out
        const squash = lim(-a.y * 0.004, 0.10);         // drops → lift, valleys → squash
        const rattle = 0.018 * Math.min(1, (controller.lastSpeed || 0) / 18);
        if (B.Torso) {
          B.Torso.bone.rotation.x += pitch + squash + rattle * Math.sin(timeVal * 9.0 + r.phase);
          B.Torso.bone.rotation.z += roll + rattle * 0.5 * Math.cos(timeVal * 7.3 + r.phase);
        }
        if (B.Head) {
          B.Head.bone.rotation.x += pitch * 0.6 + rattle * Math.sin(timeVal * 11.0 + r.phase + 1);
          B.Head.bone.rotation.z += roll * 0.5;
        }
      }
    });

    // 5. ── Night light show: the rail itself glows + gently breathes ──
    const isNight = isNightNow(group);
    controller.nightMix += ((isNight ? 1 : 0) - controller.nightMix) * (1 - Math.exp(-2.2 * dt));
    const nf = controller.nightMix;
    const breathe = 0.5 + 0.5 * Math.sin(timeVal * 1.6);
    // With toneMapped = false, push the thin real rail bright so it reads clearly; breathe 1.5→2.0.
    for (let i = 0; i < railGlowMats.length; i++) {
      railGlowMats[i].emissiveIntensity = nf * (1.5 + breathe * 0.5);
    }
    // Carriage lighting: body glows on the model, head/tail accents, warm interior, ground under-glow.
    for (let i = 0; i < cartBodyMats.length; i++) {
      cartBodyMats[i].emissiveIntensity = nf * 1.7;
    }
    for (let i = 0; i < cartGlows.length; i++) {
      cartGlows[i].material.emissiveIntensity = nf * (1.4 + 0.2 * Math.sin(timeVal * 2.0 + i));
    }
    for (let i = 0; i < cartLights.length; i++) {
      cartLights[i].intensity = nf * 6.0;
    }
    for (let i = 0; i < cartUnderLights.length; i++) {
      cartUnderLights[i].intensity = nf * 5.5;
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

  // Click-to-toggle is handled centrally by the InteractionManager (main.js
  // registers this ride's controlPanel like the other three rides). The old
  // private raycaster here double-raycasted every mousemove, fought over the
  // cursor style, and let panel clicks ALSO trigger the camera click-to-fly.
  void camera; void renderer;

  group.traverse((o) => {
    if (o.isMesh) {
      let isPanel = false;
      let curr = o;
      while (curr) {
        if (curr === controlPanel.group) {
          isPanel = true;
          break;
        }
        curr = curr.parent;
      }
      if (!isPanel) {
        o.layers.enable(2);
      }
    }
  });

  group.userData.controller = controller;
  return group;
}
