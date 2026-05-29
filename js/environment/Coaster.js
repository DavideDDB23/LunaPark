// Fully procedural roller-coaster animation.
//
// animated_roller_coaster.glb (Sketchfab "Animated roller coaster", assetfactory) ships WITH a
// baked 29 s keyframe animation. Project policy is that every motion is hand-written JS — we never
// instantiate an AnimationMixer and never play the imported clip. Instead we use the clip purely as
// a GEOMETRY DATA SOURCE: a cart's baked translation track traces the exact rail centre-line, so we
// sample it once at load to build a closed CatmullRom curve, then drive our own train along it.
//
// Model layout (verified by GLB traversal):
//   bumper_car_export_1.001 .. .006  → 6 baked carts (removed; we drive our own clones)
//   support_tall.010_*               → support pylons (static dressing)
//   Circle.023_build_gen_1_0         → the rail tube (static dressing)
//   panel_1.001_*                    → operator booth / sign (static dressing)
//   anim "Scene"                     → per-cart translation/rotation/scale tracks (path source only)
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
import { loadGLBWithAnimations } from '../utils/loaders.js';
import { ControlPanel } from './ControlPanel.js';

const MODEL_URL = 'assets/models/animated_roller_coaster.glb';
const TARGET_LONG = 64;      // world units — longest horizontal extent after auto-fit (kept compact
                             // so the SE footprint clears the river and the south entrance plaza)
const NUM_TRAINS = 2;        // trains running simultaneously on the circuit
const CARS_PER_TRAIN = 4;    // carriages per train (each carriage animated independently)
const NUM_CARS = NUM_TRAINS * CARS_PER_TRAIN; // 8 total
const CAR_GAP = 1.15;        // gap between carriages, in car-lengths (1 = touching)
const TRAIN_SPACING = 1.0 / NUM_TRAINS; // 0.5 — second train half a circuit ahead
const CART_SCALE = 1.6;      // visual up-scale of each cart so riders read at park scale
const G_EFF = 9.8;           // gravity for the energy model (world-units/s²)
const CURVE_SAMPLES = 320;   // control points kept for the CatmullRom
const NUM_FRAMES = 1000;     // resolution of the rotation-minimizing frame field

// Station state-machine speeds (world units/s)
const V_LAUNCH_MAX = 26.0;
const V_LAUNCH_MIN = 3.0;
const V_COAST_MIN = 14.0;
const STATION_PAUSE = 3.0;

// ── Recover the rail centre-line (model-local) from a cart's baked translation keyframes ──
function extractCenterline(model, clip) {
  const posTrack = clip.tracks.find((t) => t.name.endsWith('.position'));
  if (!posTrack) throw new Error('Coaster: no .position track to recover the rail path');
  const cartName = posTrack.name.slice(0, -'.position'.length);
  const cartNode = model.getObjectByName(cartName);
  if (!cartNode) throw new Error(`Coaster: cart node "${cartName}" not found`);

  // The keyframe translations are in the cart's PARENT (RootNode) space. Convert each to
  // model-local through the full nested transform via a throwaway probe child.
  model.updateMatrixWorld(true);
  const probe = new THREE.Object3D();
  cartNode.parent.add(probe);

  const vals = posTrack.values; // flat [x,y,z, ...]
  const nKeys = vals.length / 3;
  const w = new THREE.Vector3();
  const raw = [];
  let prev = null;
  const DEDUP_EPS2 = 8 * 8; // RootNode-local units²; merges the station-dwell duplicate keys
  for (let i = 0; i < nKeys; i++) {
    const x = vals[i * 3], y = vals[i * 3 + 1], z = vals[i * 3 + 2];
    if (prev && (x - prev[0]) ** 2 + (y - prev[1]) ** 2 + (z - prev[2]) ** 2 < DEDUP_EPS2) continue;
    prev = [x, y, z];
    probe.position.set(x, y, z);
    probe.updateMatrixWorld(true);
    w.setFromMatrixPosition(probe.matrixWorld);
    raw.push(model.worldToLocal(w.clone()));
  }
  cartNode.parent.remove(probe);

  // Down-sample to a manageable, evenly distributed control set (centripetal CatmullRom copes
  // with the remaining uneven spacing). Drop the closing point if it coincides with the start.
  const stride = Math.max(1, Math.round(raw.length / CURVE_SAMPLES));
  const pts = [];
  for (let i = 0; i < raw.length; i += stride) pts.push(raw[i]);
  if (pts.length > 4 && pts[pts.length - 1].distanceTo(pts[0]) < 1e-3) pts.pop();

  return { pts, cartNode };
}

export async function buildCoaster({ position = [45, 0, 45], camera, renderer, anisotropy = 8 } = {}) {
  const gltf = await loadGLBWithAnimations(MODEL_URL);
  const model = gltf.scene;
  const clip = gltf.animations && gltf.animations[0];
  if (!clip) throw new Error('Coaster: expected a baked animation clip to recover the rail path');

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

  // ── Build the closed track curve from the recovered centre-line ──
  const { pts: ctrlPts, cartNode: templateCartNode } = extractCenterline(model, clip);
  const curve = new THREE.CatmullRomCurve3(ctrlPts, true, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 1600;
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

  const _up = new THREE.Vector3();
  function getUpVectorAt(u, out) {
    let uc = u % 1; if (uc < 0) uc += 1;
    const f = uc * NUM_FRAMES, i0 = Math.floor(f), i1 = (i0 + 1) % (NUM_FRAMES + 1);
    return out.lerpVectors(upVectors[i0], upVectors[i1], f - i0).normalize();
  }

  const _tan = new THREE.Vector3();
  const _mtx = new THREE.Matrix4();
  const _origin = new THREE.Vector3(0, 0, 0);
  function frameQuat(u, out) {
    curve.getTangentAt(u % 1, _tan).normalize();
    getUpVectorAt(u, _up);
    _mtx.lookAt(_origin, _tan, _up);
    return out.setFromRotationMatrix(_mtx);
  }

  // Top of the track (energy model) with headroom so V_COAST_MIN actually applies on crests.
  const samples = curve.getSpacedPoints(800);
  let yTop = -Infinity;
  for (const p of samples) if (p.y > yTop) yTop = p.y;
  yTop += 0.5;

  // ── Seat the template cart on the curve, capture its on-rail local pose, remove all baked carts ──
  // The cart's authored static pose lies on the rail (it is keyframe 0 of the path), so the attach()
  // trick captures the constant offset between the cart's local axes and our frame axes.
  const cartCentroid = new THREE.Box3().setFromObject(templateCartNode).getCenter(new THREE.Vector3());
  model.worldToLocal(cartCentroid);
  let uCar = 0, best = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = samples[i].distanceToSquared(cartCentroid);
    if (d < best) { best = d; uCar = i / samples.length; }
  }

  const dolly0 = new THREE.Group();
  dolly0.name = 'coaster_t0_c0';
  model.add(dolly0);
  dolly0.position.copy(curve.getPointAt(uCar));
  frameQuat(uCar, dolly0.quaternion);
  dolly0.updateMatrixWorld(true);
  dolly0.attach(templateCartNode); // cart keeps world pose; local transform now = "sits on rail here"
  templateCartNode.scale.multiplyScalar(CART_SCALE);

  const carLocalPos = templateCartNode.position.clone();
  const carLocalQuat = templateCartNode.quaternion.clone();
  const carLocalScale = templateCartNode.scale.clone();

  // Carriage footprint along the track → spacing in normalized arc-length.
  const cartSize = new THREE.Box3().setFromObject(templateCartNode).getSize(new THREE.Vector3());
  const carLen = Math.max(cartSize.x, cartSize.z);
  const spacingU = (carLen * CAR_GAP) / trackLen;

  // Remove the other 5 baked cart nodes (we only drive our own clones).
  const leftoverCarts = [];
  model.traverse((o) => {
    if (o !== templateCartNode && /^bumper_car_export_/.test(o.name) && o.parent && o.parent !== dolly0) {
      // node groups named bumper_car_export_1.00X (the mesh children end with _rollercoastercart_0)
      if (!/_rollercoastercart_0$/.test(o.name)) leftoverCarts.push(o);
    }
  });
  leftoverCarts.forEach((o) => o.parent && o.parent.remove(o));

  // ── Build 2 trains × 4 carriages — every carriage on its own dolly, offset independently.
  //    u_carriage = ((controller.u − offset) % 1 + 1) % 1
  //    train t, carriage c → offset = −t*TRAIN_SPACING + c*spacingU
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
    model.add(dolly);
    cars.push({ dolly, offset });
  }

  // ── Top group: ride auto-fit-scaled inside; panel stays at world (human) scale ──
  const group = new THREE.Group();
  group.name = 'coaster';

  const rideScaled = new THREE.Group();
  rideScaled.name = 'coaster_rideScaled';
  rideScaled.add(model);
  group.add(rideScaled);

  group.position.set(position[0], position[1], position[2]);
  group.updateMatrixWorld(true);

  // Auto-fit: scale the whole ride so its longest horizontal extent = TARGET_LONG.
  let bbox = new THREE.Box3().setFromObject(rideScaled);
  let size = bbox.getSize(new THREE.Vector3());
  const scale = TARGET_LONG / (Math.max(size.x, size.z) || 1);
  rideScaled.scale.setScalar(scale);
  group.updateMatrixWorld(true);

  // Re-measure; centre on X/Z and rest the base on the ground (y = 0 at the lowest point).
  bbox = new THREE.Box3().setFromObject(rideScaled);
  size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  rideScaled.position.x += position[0] - center.x;
  rideScaled.position.y += position[1] - bbox.min.y;
  rideScaled.position.z += position[2] - center.z;
  group.updateMatrixWorld(true);

  const trackLenWorld = trackLen * scale;
  const footprint = Math.max(size.x, size.z);

  // ── Control panel (semaphore + lever), human-scaled, beside the ride ──
  const controlPanel = new ControlPanel({ initialRunning: true });
  controlPanel.group.position.set(footprint * 0.46, 0, footprint * 0.46);
  group.add(controlPanel.group);
  group.updateMatrixWorld(true);
  controlPanel.group.lookAt(position[0], position[1], position[2]);
  controlPanel.group.rotateY(Math.PI);

  // ── Controller / station state-machine ──
  const controller = {
    cars,
    curve,
    u: uCar,
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
    const ease = controlPanel.tick(dt);

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
      c.dolly.position.copy(curve.getPointAt(u, _pt));
      c.dolly.quaternion.copy(frameQuat(u, _q));
    }
  };

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
