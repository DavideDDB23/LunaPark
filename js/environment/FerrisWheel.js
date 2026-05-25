// Fully procedural Ferris wheel animation.
//
// The ferris_wheel-2.glb ships with one baked keyframe animation; loadGLB() strips it
// before we get here (project policy: every motion is hand-written JS math), and we never
// instantiate an AnimationMixer. Everything below is driven by our own update() loop.
//
// Model hierarchy (verified by traversal of ferris_wheel-2.glb):
//   RootNode
//     ├─ mount          → the static A-frame support (does NOT spin)
//     ├─ wheel          → the rotating ring + spokes
//     ├─ cabin          → 10 SEPARATE gondola nodes (polySurfaceXXX), each its own mesh
//     ├─ block/stairs/fence/trash → static ride dressing
//     ├─ plane          → an imported ground plane (removed — the park has its own grass)
//     └─ directional/ambient light → imported lights (removed — day/night owns lighting)
//
// The model is authored Z-up with a -90°X orientation matrix on the root and a large
// world scale (wheel radius ~26 units), so we never trust the raw numbers: the hub centre,
// the spin axis, and the display scale are all measured from world matrices at load time.
//
// Mechanics, evaluated every frame:
//   1. Ring spin — wheelSpin rotates continuously about the measured axle. A smoothstep
//      ramp eases the speed IN over RAMP_UP s when starting, OUT over RAMP_DOWN s when
//      stopping. The ride starts paused.
//   2. Gondola counter-rotation — THE key feature. Each gondola is a child of a "mount"
//      that orbits with the ring; the gondola itself is rotated by exactly -α about the
//      axle so its WORLD orientation is frozen at its upright bind pose. It stays level no
//      matter where it is on the wheel. (See gondolaMounts[i].gondolaMesh in the console.)
//   3. Passenger sway — 2 figures per gondola, each leaning on a phase-offset sine.

import * as THREE from 'three';
import { loadGLB } from '../utils/loaders.js';
import {
  loadVisitorTemplates,
  makeRider,
  updateRider,
  ACTIONS_SEATED_GENERAL,
  ACTIONS_SEATED_CHAT_L,
  ACTIONS_SEATED_CHAT_R,
  ACTIONS_STANDING,
  setPassengerWorldHeight
} from './Passengers.js';

const MODEL_URL = 'assets/models/ferris_wheel-2.glb';

const TARGET_HEIGHT = 55;          // world units, top-of-wheel to base
const MAX_SPEED = 0.30;            // rad/s of the ring at full speed
const RAMP_UP = 1.5;               // s, ease-in   (TODO spec)
const RAMP_DOWN = 2.0;             // s, ease-out  (TODO spec)
const PASSENGERS_PER_GONDOLA = 2;
const SWAY_AMP = 0.05;             // rad — gentle seated body lean
const SWAY_FREQ = 0.8;             // Hz-ish
const HUMAN_TEMPLATE_COUNT = 8;   // distinct visitor models loaded, then cloned & reused

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const smoothstep = (t) => t * t * (3 - 2 * t);

export async function buildFerrisWheel({ position = [-50, 0, -50], camera, renderer } = {}) {
  // Wheel + visitor templates load in parallel; loadGLB strips animations from both.
  const [gltf, visitors] = await Promise.all([
    loadGLB(MODEL_URL),
    loadVisitorTemplates(HUMAN_TEMPLATE_COUNT),
  ]);
  const model = gltf.scene;

  // Shadows on, and drop the imported ground plane + imported lights so they don't
  // fight the park's own grass and day/night cycle.
  const toRemove = [];
  model.traverse((o) => {
    if (o.isLight) toRemove.push(o);
    if (o.name === 'plane') toRemove.push(o);
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  toRemove.forEach((o) => o.parent && o.parent.remove(o));

  model.updateMatrixWorld(true);

  const wheelNode = model.getObjectByName('wheel');
  const cabin = model.getObjectByName('cabin');
  const gondolaNodes = cabin ? [...cabin.children] : [];
  if (!wheelNode || gondolaNodes.length === 0) {
    throw new Error('FerrisWheel: expected "wheel" node and "cabin" gondolas in the GLB');
  }

  const gondolaBboxes  = gondolaNodes.map((g) => new THREE.Box3().setFromObject(g));
  const cabinCenters   = gondolaBboxes.map((b) => b.getCenter(new THREE.Vector3()));
  const cabinSizeY = gondolaBboxes[0].getSize(new THREE.Vector3()).y;

  // ── Hub = center of the wheel axle (from the model's wheel node) ──
  const hub = new THREE.Vector3();
  wheelNode.getWorldPosition(hub);

  // ── Axis = normal of the wheel rotation plane (from local Z axis of wheel node) ──
  const axis = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(wheelNode.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();

  // ── Compute hanger points concentric with the hub ──
  // Average of the cabin centers gives the center of the cabin circle
  const cabinCircleCenter = new THREE.Vector3();
  cabinCenters.forEach((c) => cabinCircleCenter.add(c));
  cabinCircleCenter.divideScalar(cabinCenters.length);

  // The Y-offset from the cabin circle center to the wheel axle (hub)
  const yOffset = hub.y - cabinCircleCenter.y;

  // Hanger points are directly above each cabin center by yOffset
  const hangerPoints = cabinCenters.map((c) => {
    return new THREE.Vector3(c.x, c.y + yOffset, c.z);
  });


  // ── Build the spin rig. spinHub orients local Z onto the axle (static); wheelSpin
  //    rotates about its local Z (the axle). attach() preserves world poses. ──
  // hub and axis are in world space; spinHub is a child of model (which has a baked
  // root rotation), so both must be converted to model-local space before use.
  const modelInvQ = model.quaternion.clone().conjugate();
  const spinHub = new THREE.Group();
  spinHub.name = 'ferris_spinHub';
  spinHub.position.copy(model.worldToLocal(hub.clone()));
  spinHub.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().applyQuaternion(modelInvQ));
  model.add(spinHub);
  spinHub.updateMatrixWorld(true);

  const wheelSpin = new THREE.Group();
  wheelSpin.name = 'ferris_wheelSpin';
  spinHub.add(wheelSpin);
  wheelSpin.updateMatrixWorld(true);

  wheelSpin.attach(wheelNode); // the visual ring now spins with us

  // ── Gondolas: a mount at each cabin hanger orbits with the wheel; a pivot at that same
  //    point is counter-rotated so the cabin stays level AND stays put (rotates in place). ──
  const gondolaMounts = [];
  const passH = cabinSizeY * 0.5; // Restore original human size scale
  for (let i = 0; i < gondolaNodes.length; i++) {
    const gNode = gondolaNodes[i];

    const mount = new THREE.Group();
    mount.name = `gondola_mount_${i}`;
    wheelSpin.add(mount);
    mount.position.copy(wheelSpin.worldToLocal(hangerPoints[i].clone()));
    mount.updateMatrixWorld(true);

    const pivot = new THREE.Group(); // counter-rotated; sits exactly at the hanger point
    mount.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(gNode); // cabin keeps world pose; its hanger now coincides with the pivot
    const baseQuat = pivot.quaternion.clone();

    // Seat/stand riders at the cabin centre (in the gondola's own frame), dropped onto the floor.
    // Roughly a third of the gondolas are "chatting pairs": the two riders turn to each other
    // and gesture; the rest can either sit or stand up, facing outward to wave.
    const seatLocal = gNode.worldToLocal(cabinCenters[i].clone());
    const chatting = Math.random() < 0.34;
    const passengers = [];
    for (let p = 0; p < PASSENGERS_PER_GONDOLA && visitors.length > 0; p++) {
      const tmpl = visitors[Math.floor(Math.random() * visitors.length)];
      
      let standing = false;
      let pool = [];
      let facingY = 0;
      let zSign = 0;

      if (chatting) {
        standing = false;
        pool = p === 0 ? ACTIONS_SEATED_CHAT_L : ACTIONS_SEATED_CHAT_R;
        facingY = p === 0 ? Math.PI / 2 - 0.2 : -Math.PI / 2 + 0.2;
      } else {
        standing = Math.random() < 0.35; // 35% chance to stand
        pool = standing ? ACTIONS_STANDING : ACTIONS_SEATED_GENERAL;
        if (standing) {
          zSign = Math.random() > 0.5 ? 1 : -1;
          facingY = (zSign > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.15;
        } else {
          facingY = (Math.random() - 0.5) * 0.2;
        }
      }

      const rider = makeRider(tmpl, passH, { pool, facingY, phase: i * 1.7 + p * 2.3, standing });
      rider.pivot.position.copy(seatLocal);
      rider.pivot.position.x += (p - (PASSENGERS_PER_GONDOLA - 1) / 2) * cabinSizeY * 0.22; // Proportional X separation
      rider.pivot.position.y -= cabinSizeY * 0.28; // Raise pivot to align feet/hips with the actual cabin floor/seats
      
      if (standing) {
        // Shift standing riders closer to the handrail/fence but stay safely within Z bounds
        rider.pivot.position.z += zSign * cabinSizeY * 0.10;
      }

      gNode.add(rider.pivot);
      passengers.push(rider);
    }

    gondolaMounts.push({ mount, pivot, gondolaMesh: gNode, baseQuat, passengers });
  }

  // ── Top group: ride is auto-fit-scaled inside; panel stays at world (human) scale. ──
  const group = new THREE.Group();
  group.name = 'ferrisWheel';

  const rideScaled = new THREE.Group();
  rideScaled.name = 'ferris_rideScaled';
  rideScaled.add(model);
  group.add(rideScaled);

  // Place the group at its world spot first, then measure in world space. Each measurement
  // is preceded by a forced matrix flush so the re-parented gondolas report true bounds
  // (otherwise the lowest gondolas end up buried below the ground).
  group.position.set(position[0], position[1], position[2]);
  group.updateMatrixWorld(true);

  // Auto-fit: scale the whole ride to TARGET_HEIGHT.
  let bbox = new THREE.Box3().setFromObject(rideScaled);
  const scale = TARGET_HEIGHT / (bbox.getSize(new THREE.Vector3()).y || 1);
  rideScaled.scale.setScalar(scale);
  group.updateMatrixWorld(true);

  // Set the dynamic passenger height for sharing
  setPassengerWorldHeight(passH * scale);

  // Re-measure, then shift so the ride is centred on X/Z and its base rests on the ground.
  bbox = new THREE.Box3().setFromObject(rideScaled);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  rideScaled.position.x += position[0] - center.x;
  rideScaled.position.y += position[1] - bbox.min.y;
  rideScaled.position.z += position[2] - center.z;
  group.updateMatrixWorld(true);

  const radiusFinal = Math.max(size.x, size.y) / 2;

  // ── Control panel (semaphore + lever), human-scaled, beside the ride. ──
  const panel = buildControlPanel();
  panel.position.set(radiusFinal * 0.55, 0, radiusFinal * 0.95);
  group.add(panel);
  group.updateMatrixWorld(true);
  panel.lookAt(position[0], position[1] + 8, position[2]); // face the wheel centre

  // ── Controller / state machine ──
  const controller = {
    gondolaMounts,
    wheelSpin,
    spinHub,
    panel,
    running: true,         // auto-start so the ride is visibly turning on load (panel toggles)
    angle: 0,
    phase: 0,              // 0 = stopped, 1 = full speed (eased)
    maxSpeed: MAX_SPEED,
    toggle() { this.running = !this.running; },
    start() { this.running = true; },
    stop() { this.running = false; },
    setSpeed(v) { this.maxSpeed = Math.max(0, v); },
  };

  const counterQuat = new THREE.Quaternion();

  group.userData.tick = (delta, time) => {
    // Ease the speed factor toward the target (1 running / 0 stopped); smoothstep gives
    // ease-in on start and ease-out on stop, with different ramp durations.
    const dur = controller.running ? RAMP_UP : RAMP_DOWN;
    controller.phase = THREE.MathUtils.clamp(
      controller.phase + (controller.running ? 1 : -1) * (delta / dur), 0, 1
    );
    const ease = smoothstep(controller.phase);

    controller.angle += controller.maxSpeed * ease * delta;
    wheelSpin.rotation.z = controller.angle;

    // Counter-rotate every gondola by -angle (about its cabin centre) so its world
    // orientation is frozen upright while it rides around the wheel.
    counterQuat.setFromAxisAngle(Z_AXIS, -controller.angle);
    for (const gm of gondolaMounts) {
      gm.pivot.quaternion.copy(counterQuat).multiply(gm.baseQuat);
      for (const r of gm.passengers) {
        updateRider(r, time + r.phase);      // state-machine: blends between varied actions
        r.pivot.rotation.z = r.restZ + Math.sin(time * SWAY_FREQ * Math.PI * 2 + r.phase) * SWAY_AMP;
      }
    }

    // Panel feedback: lever tips forward and the semaphore goes red→green with the ramp.
    panel.userData.setState(ease);
  };

  // ── Click-to-toggle via raycasting on the panel. ──
  if (camera && renderer) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dom = renderer.domElement;
    const pick = (ev) => {
      const r = dom.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(panel, true).length > 0;
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

// ── 3D control kiosk: post, angled console, two-light semaphore, tilting lever. ──
function buildControlPanel() {
  const g = new THREE.Group();
  g.name = 'ferris_controlPanel';

  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.5, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.7, metalness: 0.3 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 12), metal);
  post.position.y = 0.55;
  post.castShadow = true;
  g.add(post);

  const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.18), dark);
  console_.position.y = 1.35;
  console_.rotation.x = -0.5;
  console_.castShadow = true;
  g.add(console_);

  // Semaphore housing + red (top) / green (bottom) lamps.
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, 0.2), dark);
  housing.position.set(0.0, 2.0, -0.05);
  housing.castShadow = true;
  g.add(housing);

  const redMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff2222, emissiveIntensity: 1.0 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x003a00, emissive: 0x22ff44, emissiveIntensity: 0.0 });
  const lampGeo = new THREE.SphereGeometry(0.12, 14, 12);
  const red = new THREE.Mesh(lampGeo, redMat);
  red.position.set(0, 2.18, 0.06);
  g.add(red);
  const green = new THREE.Mesh(lampGeo, greenMat);
  green.position.set(0, 1.86, 0.06);
  g.add(green);

  // Lever: pivot at the console top, tips forward when the ride runs.
  const lever = new THREE.Group();
  lever.position.set(0.0, 1.5, 0.12);
  g.add(lever);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8), metal);
  stick.position.y = 0.27;
  stick.castShadow = true;
  lever.add(stick);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 }));
  knob.position.y = 0.55;
  lever.add(knob);

  const LEVER_REST = -0.5;   // pulled back (off)
  const LEVER_ON = 0.6;      // tipped forward (on)
  lever.rotation.x = LEVER_REST;

  g.userData.setState = (ease) => {
    redMat.emissiveIntensity = 1.0 - ease;
    greenMat.emissiveIntensity = ease;
    lever.rotation.x = THREE.MathUtils.lerp(LEVER_REST, LEVER_ON, ease);
  };

  return g;
}
