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
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB } from '../utils/loaders.js';

const MODEL_URL = 'assets/models/ferris_wheel-2.glb';
const HUMANS_DIR = 'assets/models/Humans/';

const TARGET_HEIGHT = 55;          // world units, top-of-wheel to base
const MAX_SPEED = 0.30;            // rad/s of the ring at full speed
const RAMP_UP = 1.5;               // s, ease-in   (TODO spec)
const RAMP_DOWN = 2.0;             // s, ease-out  (TODO spec)
const PASSENGERS_PER_GONDOLA = 2;
const SWAY_AMP = 0.05;             // rad — gentle seated body lean
const SWAY_FREQ = 0.8;             // Hz-ish
const HUMAN_TEMPLATE_COUNT = 8;   // distinct visitor models loaded, then cloned & reused

const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Park-visitor models (Quaternius) — civilian outfits only, no soldiers/zombies/etc.
const VISITOR_MODELS = [
  'Casual_Male', 'Casual_Female', 'Casual2_Male', 'Casual2_Female',
  'Casual3_Male', 'Casual3_Female', 'Casual_Bald', 'Suit_Male', 'Suit_Female',
  'Kimono_Male', 'Kimono_Female', 'Worker_Male', 'Worker_Female',
  'OldClassy_Male', 'OldClassy_Female',
];

const smoothstep = (t) => t * t * (3 - 2 * t);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Load a handful of random visitor models as reusable templates. loadGLB strips the baked
// keyframe animations, so each arrives in its bind pose (already arms-down / standing).
async function loadVisitorTemplates(count) {
  const picks = shuffle(VISITOR_MODELS).slice(0, count);
  const results = await Promise.allSettled(
    picks.map((name) => loadGLB(`${HUMANS_DIR}${name}.gltf`))
  );
  const templates = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const root = r.value.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false; // SkinnedMesh bind-pose bbox ignores deformation
      }
    });
    const h = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y || 3.3;
    templates.push({ root, height: h });
  }
  return templates;
}

// Bones we drive procedurally (Quaternius rig — dots stripped by GLTFLoader). Verified axes:
//   UpperArm{L,R}.y  → arm abduction (down→out→up); R uses +, L mirrors with −
//   UpperLeg.x +1.45 / LowerLeg.x −1.55 → seated; Head.y/Torso.y turn; *.x nod/lean
const ANIM_BONES = [
  'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'Head', 'Torso',
  'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR',
];

function collectBones(fig) {
  const map = {};
  for (const n of ANIM_BONES) {
    const b = fig.getObjectByName(n);
    if (b) map[n] = { bone: b, rest: b.rotation.clone() };
  }
  return map;
}

// Set a bone to rest-pose + delta Euler (so it works regardless of the bind rotation).
function pose(bones, name, dx = 0, dy = 0, dz = 0) {
  const e = bones[name];
  if (e) e.bone.rotation.set(e.rest.x + dx, e.rest.y + dy, e.rest.z + dz);
}

// Seated leg pose — applied every frame (legs never gesture). Upper body is driven by the
// pose state-machine below.
function applySeatedLegs(B) {
  pose(B, 'UpperLegL', 1.45, 0, 0.10);
  pose(B, 'UpperLegR', 1.45, 0, -0.10);
  pose(B, 'LowerLegL', -1.55, 0, 0);
  pose(B, 'LowerLegR', -1.55, 0, 0);
}

const lerp = (a, b, t) => a + (b - a) * t;
const UPPER_BONES = ['UpperArmR', 'UpperArmL', 'LowerArmR', 'LowerArmL', 'Head', 'Torso'];

// Resting upper body (hands toward the lap / safety bar). Every named pose below is layered
// over this, so any bone a pose doesn't mention eases back to rest.
const REST_UPPER = {
  UpperArmR: [0.55, 0, 0.10], UpperArmL: [0.55, 0, -0.10],
  LowerArmR: [0.45, 0, 0], LowerArmL: [0.45, 0, 0],
  Head: [0, 0, 0], Torso: [0, 0, 0],
};

// Static pose "shapes" (deltas from the rig's rest). Verified axes: UpperArm.y = abduction
// (R +, L −); Head/Torso.y = turn, .x = nod/lean. Dynamic flair (wag, breathing) is added
// live in updateRider so the held poses still feel alive.
const POSE_DEFS = {
  rest:   {},
  lookL:  { Head: [0.05, 0.6, 0], Torso: [0, 0.18, 0] },
  lookR:  { Head: [0.05, -0.6, 0], Torso: [0, -0.18, 0] },
  lookUp: { Head: [-0.45, 0.1, 0], Torso: [-0.08, 0, 0] },
  wave:   { UpperArmR: [0, 2.5, 0], LowerArmR: [0, 0, 0.2], Head: [0, 0.12, 0] },
  cheer:  { UpperArmR: [0, 2.45, 0], UpperArmL: [0, -2.45, 0], Head: [-0.06, 0, 0] },
  point:  { UpperArmR: [0.1, 1.45, 0], Head: [0, 0.32, 0], Torso: [0, 0.1, 0] },
  photo:  { UpperArmR: [1.0, 0.4, 0.25], UpperArmL: [1.0, -0.4, -0.25],
            LowerArmR: [0.8, 0, 0], LowerArmL: [0.8, 0, 0], Head: [-0.12, 0, 0] },
  relax:  { UpperArmR: [0.15, 1.05, 0], Head: [0.06, -0.2, 0], Torso: [0.05, -0.05, 0] },
  chatL:  { UpperArmR: [0.7, 0.35, 0], LowerArmR: [0.6, 0, 0], Head: [0, 0.5, 0], Torso: [0, 0.14, 0] },
  chatR:  { UpperArmL: [0.7, -0.35, 0], LowerArmL: [0.6, 0, 0], Head: [0, -0.5, 0], Torso: [0, -0.14, 0] },
};

// Merge every pose over REST_UPPER so all six upper bones always have a target → clean blends.
const POSES = {};
for (const k in POSE_DEFS) {
  POSES[k] = { ...REST_UPPER };
  for (const b in POSE_DEFS[k]) POSES[k][b] = POSE_DEFS[k][b];
}

const ACTIONS_GENERAL = ['rest', 'rest', 'lookL', 'lookR', 'lookUp', 'wave', 'point', 'photo', 'cheer', 'relax'];
const ACTIONS_CHAT_L = ['chatL', 'chatL', 'rest', 'lookR'];   // neighbour sits to this rider's left
const ACTIONS_CHAT_R = ['chatR', 'chatR', 'rest', 'lookL'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// One seated rider with a pose state-machine: it holds an action, then eases to the next.
function makeRider(template, height, { pool, facingY = 0, phase = 0 }) {
  const pivot = new THREE.Group();             // gentle body sway lives here
  const fig = cloneSkinned(template.root);
  fig.scale.setScalar(height / template.height);
  fig.rotation.y = facingY + (Math.random() - 0.5) * 0.25;
  pivot.add(fig);
  return {
    pivot, fig, bones: collectBones(fig), pool, phase,
    from: 'rest', to: pick(pool), tStart: 0, transDur: 0.7,
    nextSwitch: phase * 0.7 + Math.random() * 3, // stagger first switch
    restZ: pivot.rotation.z,
  };
}

// Advance the rider's state-machine and pose its bones for absolute time t.
function updateRider(r, t) {
  if (t >= r.nextSwitch) {
    r.from = r.to;
    r.to = pick(r.pool);
    r.tStart = t;
    r.nextSwitch = t + r.transDur + 2.5 + Math.random() * 4; // hold 2.5–6.5 s
  }
  const k = smoothstep(Math.min((t - r.tStart) / r.transDur, 1)); // eased blend
  const B = r.bones;
  applySeatedLegs(B);

  const A = POSES[r.from], C = POSES[r.to];
  for (const bn of UPPER_BONES) {
    const a = A[bn], c = C[bn];
    let dx = lerp(a[0], c[0], k), dy = lerp(a[1], c[1], k), dz = lerp(a[2], c[2], k);
    if (bn === 'Torso') dx += Math.sin(t * 1.1 + r.phase) * 0.02;  // breathing
    if (bn === 'Head') dy += Math.sin(t * 0.5 + r.phase) * 0.04;   // idle micro-glance
    pose(B, bn, dx, dy, dz);
  }

  // Live flair on the active action (eased in by k so it doesn't pop on transition).
  if (r.to === 'wave') {
    pose(B, 'UpperArmR', 0, 2.5 + Math.sin(t * 7) * 0.12 * k, (0.2 + Math.sin(t * 7) * 0.3) * k);
  } else if (r.to === 'cheer') {
    const bob = Math.sin(t * 4) * 0.16 * k;
    pose(B, 'UpperArmR', 0, 2.45 + bob, 0);
    pose(B, 'UpperArmL', 0, -(2.45 + bob), 0);
  } else if (r.to === 'chatL') {
    pose(B, 'LowerArmR', 0.6 + Math.sin(t * 2.6 + r.phase) * 0.3 * k, 0, 0);
  } else if (r.to === 'chatR') {
    pose(B, 'LowerArmL', 0.6 + Math.sin(t * 2.6 + r.phase) * 0.3 * k, 0, 0);
  }
}

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
  const passH = cabinSizeY * 0.5;
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

    // Seat riders at the cabin centre (in the gondola's own frame), dropped onto the floor.
    // Roughly a third of the gondolas are "chatting pairs": the two riders turn to each other
    // and gesture; the rest each run the general action set facing outward.
    const seatLocal = gNode.worldToLocal(cabinCenters[i].clone());
    const chatting = Math.random() < 0.34;
    const passengers = [];
    for (let p = 0; p < PASSENGERS_PER_GONDOLA && visitors.length > 0; p++) {
      const tmpl = visitors[Math.floor(Math.random() * visitors.length)];
      const pool = chatting ? (p === 0 ? ACTIONS_CHAT_L : ACTIONS_CHAT_R) : ACTIONS_GENERAL;
      const rider = makeRider(tmpl, passH, { pool, facingY: 0, phase: i * 1.7 + p * 2.3 });
      rider.pivot.position.copy(seatLocal);
      rider.pivot.position.x += (p - (PASSENGERS_PER_GONDOLA - 1) / 2) * cabinSizeY * 0.28;
      rider.pivot.position.y -= cabinSizeY * 0.5; // drop feet onto the gondola floor
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
