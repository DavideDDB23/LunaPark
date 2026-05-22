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

const MODEL_URL = 'assets/models/ferris_wheel-2.glb';

const TARGET_HEIGHT = 55;          // world units, top-of-wheel to base
const MAX_SPEED = 0.30;            // rad/s of the ring at full speed
const RAMP_UP = 1.5;               // s, ease-in   (TODO spec)
const RAMP_DOWN = 2.0;             // s, ease-out  (TODO spec)
const PASSENGERS_PER_GONDOLA = 2;
const SWAY_AMP = 0.10;             // rad
const SWAY_FREQ = 1.1;             // Hz-ish

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const PASSENGER_COLORS = [0xd94f4f, 0x4f7fd9, 0x4fd97a, 0xd9b54f, 0x9b4fd9, 0xd97f4f];

const smoothstep = (t) => t * t * (3 - 2 * t);

// ── A tiny seated human: torso, head, two arms. Sways about its own base. ───────────
function makePassenger(height, colorHex) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe7b59a, roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85 });

  const torsoH = height * 0.55;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(height * 0.18, torsoH * 0.6, 4, 8), cloth);
  torso.position.y = torsoH * 0.5;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(height * 0.16, 12, 10), skin);
  head.position.y = torsoH + height * 0.16;
  head.castShadow = true;
  g.add(head);

  const armGeo = new THREE.CapsuleGeometry(height * 0.06, torsoH * 0.5, 3, 6);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, cloth);
    arm.position.set(s * height * 0.22, torsoH * 0.55, 0);
    arm.rotation.z = s * 0.25;
    arm.castShadow = true;
    g.add(arm);
  }
  return g;
}

export async function buildFerrisWheel({ position = [-50, 0, -50], camera, renderer } = {}) {
  const gltf = await loadGLB(MODEL_URL); // animations already stripped here
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

  // ── Measure the hub (centre of the gondola circle) and the axle (plane normal). ──
  const worldOf = (o) => o.getWorldPosition(new THREE.Vector3());
  const hub = new THREE.Vector3();
  gondolaNodes.forEach((g) => hub.add(worldOf(g)));
  hub.divideScalar(gondolaNodes.length);

  // Axle = normal of the plane the gondolas lie in. Cross two distinct radial vectors.
  const r0 = worldOf(gondolaNodes[0]).sub(hub);
  let axis = null;
  for (let i = 1; i < gondolaNodes.length && !axis; i++) {
    const ri = worldOf(gondolaNodes[i]).sub(hub);
    const n = new THREE.Vector3().crossVectors(r0, ri);
    if (n.lengthSq() > 1e-6) axis = n.normalize();
  }
  axis = axis || new THREE.Vector3(0, 0, 1);

  // ── Build the spin rig. spinHub orients local Z onto the axle (static); wheelSpin
  //    rotates about its local Z (the axle). attach() preserves world poses. ──
  const spinHub = new THREE.Group();
  spinHub.name = 'ferris_spinHub';
  spinHub.position.copy(hub);
  spinHub.quaternion.setFromUnitVectors(Z_AXIS, axis);
  model.add(spinHub);
  spinHub.updateMatrixWorld(true);

  const wheelSpin = new THREE.Group();
  wheelSpin.name = 'ferris_wheelSpin';
  spinHub.add(wheelSpin);
  wheelSpin.updateMatrixWorld(true);

  wheelSpin.attach(wheelNode); // the visual ring now spins with us

  // ── Gondolas: one orbiting mount each, gondola counter-rotated to stay upright. ──
  const gondolaMounts = [];
  for (let i = 0; i < gondolaNodes.length; i++) {
    const gNode = gondolaNodes[i];

    const mount = new THREE.Group();
    mount.name = `gondola_mount_${i}`;
    wheelSpin.add(mount);
    mount.position.copy(wheelSpin.worldToLocal(worldOf(gNode)));
    mount.updateMatrixWorld(true);

    mount.attach(gNode); // gondola keeps world pose, now a child of its mount
    const baseQuat = gNode.quaternion.clone(); // upright bind orientation at α = 0

    // Seat the passengers at the gondola's own centre (measured in its local frame).
    const box = new THREE.Box3().setFromObject(gNode);
    const seatWorld = box.getCenter(new THREE.Vector3());
    const seatLocal = gNode.worldToLocal(seatWorld.clone());
    const gh = box.getSize(new THREE.Vector3()).y; // gondola height in world units
    const passH = gh * 0.42;

    const passengers = [];
    for (let p = 0; p < PASSENGERS_PER_GONDOLA; p++) {
      const fig = makePassenger(passH, PASSENGER_COLORS[(i + p) % PASSENGER_COLORS.length]);
      fig.position.copy(seatLocal);
      fig.position.x += (p - (PASSENGERS_PER_GONDOLA - 1) / 2) * gh * 0.28;
      fig.position.y -= gh * 0.18; // drop onto the seat
      gNode.add(fig);
      passengers.push({ fig, phase: i * 1.7 + p * 2.3, rest: fig.rotation.z });
    }

    gondolaMounts.push({ mount, gondolaMesh: gNode, baseQuat, passengers });
  }

  // ── Top group: ride is auto-fit-scaled inside; panel stays at world (human) scale. ──
  const group = new THREE.Group();
  group.name = 'ferrisWheel';

  const rideScaled = new THREE.Group();
  rideScaled.name = 'ferris_rideScaled';
  rideScaled.add(model);
  group.add(rideScaled);

  // Auto-fit: scale to TARGET_HEIGHT, drop base to y=0, centre horizontally on the group.
  let bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  const scale = TARGET_HEIGHT / size.y;
  rideScaled.scale.setScalar(scale);
  rideScaled.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(rideScaled);
  const center = bbox.getCenter(new THREE.Vector3());
  rideScaled.position.set(-center.x, -bbox.min.y, -center.z);

  const radiusFinal = (Math.max(size.x, size.y) * scale) / 2;

  group.position.set(position[0], position[1], position[2]);

  // ── Control panel (semaphore + lever), human-scaled, in front of the ride. ──
  const panel = buildControlPanel();
  panel.position.set(radiusFinal * 0.55, 0, radiusFinal * 0.95);
  panel.lookAt(0, panel.position.y + 1.4, 0); // face the wheel centre
  group.add(panel);

  // ── Controller / state machine ──
  const controller = {
    gondolaMounts,
    wheelSpin,
    spinHub,
    panel,
    running: false,        // starts paused
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

    // Counter-rotate every gondola by -angle so its world orientation is frozen upright.
    counterQuat.setFromAxisAngle(Z_AXIS, -controller.angle);
    for (const gm of gondolaMounts) {
      gm.gondolaMesh.quaternion.copy(counterQuat).multiply(gm.baseQuat);
      for (const p of gm.passengers) {
        p.fig.rotation.z = p.rest + Math.sin(time * SWAY_FREQ * Math.PI * 2 + p.phase) * SWAY_AMP;
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
