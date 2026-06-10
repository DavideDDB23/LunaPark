import * as THREE from 'three';
import { loadVisitorTemplates, makeRider } from './Passengers.js';
import { riverCenter, riverHalfWidth } from '../utils/river.js';

/* ──────────────────────────────────────────────────────────────────────────
 * NPC PARK VISITORS
 *
 * 8–12 civilians roam the WHOLE park between waypoints: pick a destination,
 * walk to it routing around every obstacle, pause 1–5 s, then choose a new one.
 *
 * Navigation = a coarse occupancy grid + A* + line-of-sight string-pulling, so
 * routes bend around the real (seeded) tree layout — visitors never clip
 * through trees, buildings, rides or the water. The single river crossing is the
 * central bridge, where they are lifted onto a pre-baked smooth deck height so
 * they walk over it without bobbing. They also push apart from one another, so
 * no two ever overlap.
 *
 * The WALK is fully procedural (no clips, no AnimationMixer) — see the gait
 * engine below: planted-foot targets + analytic two-bone leg IK + pelvis
 * rhythm + spine counter-rotation, all phase-driven so feet never slide.
 * ────────────────────────────────────────────────────────────────────────── */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
const TWO_PI = Math.PI * 2;

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/* ── Procedural gait engine ──────────────────────────────────────────────────
 * Fully synthesised walk — no clips, no mixers; hand-built like every other
 * animation in the project. The Quaternius rig keeps Foot.L/R as free bones
 * (siblings of the leg chains — the Blender IK setup, pole targets included),
 * so we drive locomotion the way game IK rigs do:
 *
 *   1. FOOT TARGETS — each foot alternates stance (planted: it slides
 *      backwards under the body at exactly walking speed, so its world
 *      velocity is zero → no foot-skate by construction) and swing (Hermite
 *      arc whose take-off/landing velocities match the stance slide, with
 *      heel-strike dorsiflexion and toe-off plantarflexion pivoting the ankle
 *      over the toe).
 *   2. TWO-BONE LEG IK — analytic, knee pole forward, calibrated from the
 *      skeleton's own geometry at spawn (works on every outfit variant).
 *   3. PELVIS RHYTHM — vertical bob at 2× step frequency, lateral weight
 *      shift onto the stance leg, yaw + list counter-phased with the legs.
 *   4. TRUNK & LIMBS — spine counter-rotation against the pelvis, forward
 *      lean with speed, speed-scaled arm swing with elbow flex, head that
 *      stabilises against the shoulders, idle breathing/weight-shift.
 *
 * Everything is phase-driven (phase advances by distance/stride), so cadence,
 * stride and ground speed always agree.
 * ────────────────────────────────────────────────────────────────────────── */

const FWD = new THREE.Vector3(0, 0, 1);       // armature space: +Z = facing
const Y_UP = new THREE.Vector3(0, 1, 0);
const X_AX = new THREE.Vector3(1, 0, 0);

const GAIT = {
  stance: 0.62,      // fraction of the cycle each foot spends on the ground
  stride: 1.22,      // stride length, × leg length
  stepH: 0.115,      // swing apex height, × leg length
  hipStand: 0.99,    // hip-joint height standing, × leg length
  hipWalk: 0.935,    // mean hip-joint height walking (soft knees), × leg length
  bob: 0.030,        // pelvis vertical bob, × leg length
  sway: 0.038,       // pelvis lateral weight shift, × leg length
  pelvYaw: 0.10, pelvRoll: 0.05,
  lean: 0.04, leanV: 0.05,   // forward trunk lean: base + per-unit-speed
  armSwing: 0.50, armLag: 0.12,
  elbow: 0.10, elbowSwing: 0.16,
  footOut: 0.07,     // out-toeing (rad)
  stepWidth: 0.88,   // foot lateral spacing, × hip-joint half-span
  heelPitch: 0.28,   // dorsiflexion at heel strike (rad)
  toePitch: 0.60,    // plantarflexion at toe-off (rad)
};

const _m4b = new THREE.Matrix4(), _bm = new THREE.Matrix4();
const _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _ds = new THREE.Vector3();
const _qPelv = new THREE.Quaternion(), _qBody = new THREE.Quaternion(), _qBodyInv = new THREE.Quaternion();
const _qT = new THREE.Quaternion(), _qS = new THREE.Quaternion(), _qSpin = new THREE.Quaternion(), _qInv = new THREE.Quaternion();
const _vHip = new THREE.Vector3(), _vV = new THREE.Vector3(), _vThigh = new THREE.Vector3();
const _vShank = new THREE.Vector3(), _vPole = new THREE.Vector3(), _vBody = new THREE.Vector3();
const _fc = { z: 0, lift: 0, pitch: 0 };

// Decompose a bone's transform relative to the armature root.
function relTo(invArm, bone, outPos, outQuat) {
  _m4b.multiplyMatrices(invArm, bone.matrixWorld);
  _m4b.decompose(outPos, outQuat, _ds);
}

// Quaternion with +Y along yDir (limb bones run +Y hip→knee→ankle) and +X
// perpendicular to the (yDir, pole) plane — the shared frame for thigh/shank.
function limbBasis(yDir, pole, out) {
  _bx.crossVectors(yDir, pole);
  if (_bx.lengthSq() < 1e-8) _bx.set(-1, 0, 0);
  _bx.normalize();
  _bz.crossVectors(_bx, yDir).normalize();
  _bm.makeBasis(_bx, yDir, _bz);
  return out.setFromRotationMatrix(_bm);
}

// Calibrate the gait rig from a cloned figure's skeleton (default pose).
function makeGaitRig(fig) {
  const raw = {};
  fig.traverse((o) => { if (o.isBone && !(o.name in raw)) raw[o.name] = o; });
  // GLTFLoader strips dots from bone names ("Foot.L" → "FootL"); accept both.
  const bones = {};
  const find = (n) => raw[n] || raw[n.replace('.', '')] || raw[n.replace('.', '_')] || null;
  for (const n of ['UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R',
                   'Abdomen', 'Torso', 'Neck', 'Head', 'UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R']) {
    bones[n] = find(n);
  }
  for (const n of ['UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R']) {
    if (!bones[n]) return null;
  }
  // The pelvis bone ("Body", deduped to "Body_1" against the mesh of the same
  // name) is simply the legs' parent.
  const body = bones['UpperLeg.L'].parent;
  if (!body || !body.isBone) return null;
  fig.updateMatrixWorld(true);
  const armBone = bones['Foot.L'].parent;          // skeleton root ("Bone")
  const invArm = new THREE.Matrix4().copy(armBone.matrixWorld).invert();
  armBone.matrixWorld.decompose(_vV, _qT, _ds);

  const rig = {
    bones, body,
    scale: _ds.y,                                  // armature units → world units
    bodyPos0: body.position.clone(),
    bodyQuat0: body.quaternion.clone(),
    legs: {}, upper: {}, legLen: 0, hipSpan: 0, ankleH: 0,
  };

  // The GLTF's *default* node pose is an arbitrary animation frame where the
  // leg chains and the free foot bones don't even agree, so all leg geometry
  // is read from the skin's bind pose (boneInverses), which is consistent.
  let skin = null;
  fig.traverse((o) => { if (!skin && o.isSkinnedMesh) skin = o; });
  if (!skin) return null;
  const skel = skin.skeleton;
  const armIdx = skel.bones.indexOf(armBone);
  const toArmBind = new THREE.Matrix4();
  if (armIdx >= 0) toArmBind.copy(skel.boneInverses[armIdx]);
  const bindOf = (bone, outPos, outQuat) => {
    const bi = skel.bones.indexOf(bone);
    if (bi < 0) return false;
    _m4b.copy(skel.boneInverses[bi]).invert().premultiply(toArmBind);
    _m4b.decompose(outPos, outQuat, _ds);
    return true;
  };

  for (const side of ['L', 'R']) {
    const up = bones[`UpperLeg.${side}`], lo = bones[`LowerLeg.${side}`], ft = bones[`Foot.${side}`];
    const hip0 = new THREE.Vector3(), knee0 = new THREE.Vector3(), ankle0 = new THREE.Vector3();
    const qUp0 = new THREE.Quaternion(), qLo0 = new THREE.Quaternion(), qFt0 = new THREE.Quaternion();
    if (!bindOf(up, hip0, qUp0) || !bindOf(lo, knee0, qLo0) || !bindOf(ft, ankle0, qFt0)) return null;
    const dir = new THREE.Vector3();
    // q_off maps the constructed limb-basis onto each bone's real local frame.
    const offUp = limbBasis(dir.subVectors(knee0, hip0).normalize(), FWD, new THREE.Quaternion()).invert().multiply(qUp0);
    const offLo = limbBasis(dir.subVectors(ankle0, knee0).normalize(), FWD, new THREE.Quaternion()).invert().multiply(qLo0);
    rig.legs[side] = {
      up, lo, ft,
      L1: hip0.distanceTo(knee0), L2: knee0.distanceTo(ankle0),
      hipOff: up.position.clone(),                 // constant, in Body space
      offUp, offLo,
      flat: qFt0,        // bind = standing flat on the ground → flat reference
      sideSign: side === 'L' ? 1 : -1,             // armature +X = character's left
    };
    rig.ankleH += ankle0.y / 2;                    // true flat-foot ankle height
  }
  rig.legLen = (rig.legs.L.L1 + rig.legs.L.L2 + rig.legs.R.L1 + rig.legs.R.L2) / 2;
  rig.hipSpan = Math.abs(rig.legs.L.hipOff.x - rig.legs.R.hipOff.x) / 2;

  // Upper-body bones: default local pose + axes mapping the armature X/Y/Z
  // into each bone's local frame, so swings compose about body axes.
  for (const name of ['Abdomen', 'Torso', 'Neck', 'Head', 'UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R']) {
    const b = bones[name];
    if (!b) continue;
    relTo(invArm, b, _vV, _qT);
    _qInv.copy(_qT).invert();
    rig.upper[name] = {
      bone: b, local0: b.quaternion.clone(),
      axX: new THREE.Vector3(1, 0, 0).applyQuaternion(_qInv).normalize(),
      axY: new THREE.Vector3(0, 1, 0).applyQuaternion(_qInv).normalize(),
      axZ: new THREE.Vector3(0, 0, 1).applyQuaternion(_qInv).normalize(),
    };
  }
  return rig;
}

// Foot trajectory for one leg at cycle position q ∈ [0,1) (q = 0 ⇒ heel
// strike). Returns fore-aft z, lift above flat-ankle height, and foot pitch
// (+ = toes up), all in armature units. Stance feet move backwards at exactly
// −stride per cycle, cancelling body motion → planted feet.
function footCurve(q, stride, legLen, out) {
  const ST = GAIT.stance, footLen = legLen * 0.30;
  let z, lift = 0, pitch = 0;
  if (q < ST) {
    z = stride * (ST / 2 - q);
    if (q < 0.07) {                                 // heel-strike roll-down
      pitch = GAIT.heelPitch * (1 - q / 0.07);
      lift = Math.sin(pitch) * footLen * 0.30;      // pivot on the heel
    } else if (q > 0.40) {                          // heel-off → toe-off
      const r = smooth01((q - 0.40) / (ST - 0.40));
      pitch = -GAIT.toePitch * r;
      lift = Math.sin(-pitch) * footLen * 0.80;     // ankle pivots over the toe
      z += (1 - Math.cos(pitch)) * footLen * 0.80;
    }
  } else {
    const u = (q - ST) / (1 - ST);
    // Hermite blend whose end slopes match the stance slide → no velocity pop
    // at take-off or landing.
    const m = -(1 - ST) / ST;
    const f = u * u * (3 - 2 * u) + m * u * (2 * u - 1) * (u - 1);
    z = stride * ST * (f - 0.5);
    lift = Math.pow(Math.sin(Math.PI * u), 1.1) * GAIT.stepH * legLen;
    pitch = lerp(-GAIT.toePitch, GAIT.heelPitch, smooth01(u / 0.55));
    if (pitch < 0) lift += Math.sin(-pitch) * footLen * 0.80 * (1 - u);
    else lift += Math.sin(pitch) * footLen * 0.30 * u;
  }
  out.z = z; out.lift = lift; out.pitch = pitch;
}

// Analytic two-bone IK: place the foot bone at the target and orient the
// thigh/shank chain to reach it (knee pole forward). _vHip must hold the hip
// joint position; _qBody/_qBodyInv the Body bone's armature-space rotation.
function solveLeg(leg, tX, tY, tZ, footPitch, footYaw) {
  _vV.set(tX - _vHip.x, tY - _vHip.y, tZ - _vHip.z);
  const L1 = leg.L1, L2 = leg.L2;
  const d = clamp(_vV.length(), Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  _vV.normalize();
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  _vPole.copy(FWD).addScaledVector(_vV, -_vV.dot(FWD));
  if (_vPole.lengthSq() < 1e-8) _vPole.set(0, 0, 1);
  _vPole.normalize();
  _vThigh.copy(_vV).multiplyScalar(Math.cos(a)).addScaledVector(_vPole, Math.sin(a));
  _vShank.set(tX, tY, tZ).sub(_vHip).addScaledVector(_vThigh, -L1).normalize();
  limbBasis(_vThigh, FWD, _qT).multiply(leg.offUp);
  leg.up.quaternion.copy(_qBodyInv).multiply(_qT);                   // local under Body
  limbBasis(_vShank, FWD, _qS).multiply(leg.offLo);
  leg.lo.quaternion.copy(_qInv.copy(_qT).invert()).multiply(_qS);    // local under thigh
  leg.ft.position.set(tX, tY, tZ);
  leg.ft.quaternion.setFromAxisAngle(Y_UP, footYaw)
    .multiply(_qSpin.setFromAxisAngle(X_AX, -footPitch))
    .multiply(leg.flat);
}

// Compose small swings about armature axes on top of a bone's default pose.
function spinBone(u, ax, ay, az) {
  if (!u) return;
  const q = u.bone.quaternion.copy(u.local0);
  if (ay) q.multiply(_qSpin.setFromAxisAngle(u.axY, ay));
  if (ax) q.multiply(_qSpin.setFromAxisAngle(u.axX, ax));
  if (az) q.multiply(_qSpin.setFromAxisAngle(u.axZ, az));
}

// Pose every bone of a visitor for the current gait state (walk ⇄ idle blend).
function applyGaitPose(w, time) {
  const rig = w.rig;
  if (!rig) return;
  const mb = smooth01(w.moveBlend);
  const L = rig.legLen, p = w.phase, seed = w.seed;
  const vNorm = clamp(w.speed / 1.5, 0.6, 1.2);
  const breathe = Math.sin(time * 1.25 + seed * 3.1);

  // ── pelvis: bob (2× step freq), weight shift, yaw, list ──
  const bob = Math.cos(4 * Math.PI * (p - 0.31)) * GAIT.bob * L * (0.6 + 0.4 * vNorm);
  const hipY = lerp(rig.ankleH + GAIT.hipStand * L + breathe * 0.004 * L,
                    rig.ankleH + GAIT.hipWalk * L + bob, mb);
  const swayX = lerp(Math.sin(time * 0.5 + seed * 5) * 0.018 * L,
                     Math.cos(TWO_PI * (p - 0.31)) * GAIT.sway * L, mb);
  const yaw = -GAIT.pelvYaw * Math.cos(TWO_PI * p) * mb * vNorm;
  const roll = GAIT.pelvRoll * Math.cos(TWO_PI * (p - 0.31)) * mb + w.lean;
  _qPelv.setFromAxisAngle(Y_UP, yaw)
    .multiply(_qSpin.setFromAxisAngle(X_AX, 0.035 * mb))
    .multiply(_qT.setFromAxisAngle(FWD, roll));
  _qBody.copy(_qPelv).multiply(rig.bodyQuat0);
  rig.body.quaternion.copy(_qBody);
  _vBody.set(rig.bodyPos0.x + swayX, hipY - rig.legs.L.hipOff.y, rig.bodyPos0.z);
  rig.body.position.copy(_vBody);
  _qBodyInv.copy(_qBody).invert();

  // ── legs: blended foot targets → IK ──
  for (let i = 0; i < 2; i++) {
    const leg = i === 0 ? rig.legs.L : rig.legs.R;
    const q = (p + (i === 0 ? 0 : 0.5)) % 1;
    footCurve(q, w.strideArm, L, _fc);
    const zT = _fc.z * mb + (i === 0 ? w.standZL : w.standZR) * (1 - mb);
    const yT = rig.ankleH + _fc.lift * mb;
    const xT = leg.sideSign * rig.hipSpan * GAIT.stepWidth * lerp(w.standW, 1, mb);
    _vHip.copy(leg.hipOff).applyQuaternion(_qBody).add(_vBody);
    solveLeg(leg, xT, yT, zT, _fc.pitch * mb, leg.sideSign * GAIT.footOut);
  }

  // ── trunk, head, arms ──
  const counter = -1.6 * yaw;                     // shoulders counter-rotate
  const lean = (GAIT.lean + GAIT.leanV * vNorm) * mb + 0.012 * breathe;
  const bounce = 0.014 * Math.cos(4 * Math.PI * p + 0.7) * mb;
  const U = rig.upper;
  spinBone(U['Abdomen'], lean * 0.45 + bounce, counter * 0.45, -roll * 0.5);
  spinBone(U['Torso'], lean * 0.55 + bounce * 0.6, counter * 0.55, -roll * 0.35);
  const headLook = (1 - mb) * 0.45 * Math.sin(time * 0.4 + seed)
                 + mb * 0.10 * Math.sin(time * 0.6 + seed * 2);
  spinBone(U['Neck'], -lean * 0.4, -counter * 0.35 + headLook * 0.35, 0);
  spinBone(U['Head'], 0.02 * Math.cos(4 * Math.PI * p + 1.2) * mb - lean * 0.3,
           -counter * 0.5 + headLook, 0);

  const swing = Math.cos(TWO_PI * p + GAIT.armLag);
  const thL = GAIT.armSwing * (0.45 + 0.55 * vNorm) * swing * mb;
  const idleArm = (1 - mb) * 0.03 * breathe;
  spinBone(U['UpperArm.L'], thL + idleArm, 0, 0);
  spinBone(U['UpperArm.R'], -thL + idleArm, 0, 0);
  const flexL = (GAIT.elbow + GAIT.elbowSwing * Math.max(0, -swing)) * mb;
  const flexR = (GAIT.elbow + GAIT.elbowSwing * Math.max(0, swing)) * mb;
  spinBone(U['LowerArm.L'], -flexL - (1 - mb) * 0.05, 0, 0);
  spinBone(U['LowerArm.R'], -flexR - (1 - mb) * 0.05, 0, 0);
}

// ── Navigation grid ────────────────────────────────────────────────────────
const HALF = 90, CELL = 2.0;
const N = Math.round((2 * HALF) / CELL) + 1;
const VIS_CLEAR = 0.9;
const BRIDGE_HALF_X = 2.4;

const idx = (ix, iz) => iz * N + ix;
const toCellX = (x) => clamp(Math.round((x + HALF) / CELL), 0, N - 1);
const toCellZ = (z) => clamp(Math.round((z + HALF) / CELL), 0, N - 1);
const cellToWorld = (i) => i * CELL - HALF;

const STATIC_CIRCLES = [
  [-50, -50, 20], [40, -40, 15], [-40, 40, 16], [-14, 22, 6.5],
  [-5, -25, 1.3], [-5, -50, 1.3], [-5, -75, 1.3], [5, -25, 1.3], [5, -50, 1.3], [5, -75, 1.3],
  [-5, 25, 1.3], [-5, 50, 1.3], [-5, 75, 1.3], [5, 25, 1.3], [5, 50, 1.3], [5, 75, 1.3],
];

const LANDMARKS = [
  [0, 86], [0, 64], [0, 44], [0, 24], [0, -22], [0, -42], [0, -60], [0, -70],
  [10, 14], [-10, 14], [10, -13], [-10, -13],
  [7, 49], [16, -19], [-15, 33], [-19, -31],
];

class NavGrid {
  constructor({ obstacles = [], coasterFootprint = null }) {
    this.blocked = new Uint8Array(N * N);
    this.cost = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = cellToWorld(ix), z = cellToWorld(iz);
        let blocked = false;
        if (Math.abs(x) > HALF - 1.5 || Math.abs(z) > HALF - 1.5) blocked = true;
        if (!blocked) {
          const dRiver = Math.abs(z - riverCenter(x)) - riverHalfWidth(x);
          if (dRiver < 1.6 && Math.abs(x) > BRIDGE_HALF_X) blocked = true;
        }
        if (!blocked && z < -73 && Math.abs(x) < 14) blocked = true;
        if (!blocked) {
          for (const [cx, cz, cr] of STATIC_CIRCLES) {
            const dx = x - cx, dz = z - cz;
            if (dx * dx + dz * dz < (cr + VIS_CLEAR) * (cr + VIS_CLEAR)) { blocked = true; break; }
          }
        }
        if (!blocked && coasterFootprint) {
          const pad = Math.min(coasterFootprint.pad, 4.0) + VIS_CLEAR, pad2 = pad * pad;
          const a = coasterFootprint.pts;
          for (let i = 0; i < a.length; i += 2) {
            const dx = x - a[i], dz = z - a[i + 1];
            if (dx * dx + dz * dz < pad2) { blocked = true; break; }
          }
        }
        if (!blocked) {
          for (const o of obstacles) {
            const dx = x - o.x, dz = z - o.z, rr = o.r + VIS_CLEAR;
            if (dx * dx + dz * dz < rr * rr) { blocked = true; break; }
          }
        }
        this.blocked[idx(ix, iz)] = blocked ? 1 : 0;

        let c = 1.7;
        const onPath = Math.abs(x) <= 3.4;
        const onRiver = Math.abs(z - riverCenter(x)) - riverHalfWidth(x) < 1.6;
        if (onPath) c = 1.0;
        else if (x * x + z * z < 14 * 14 && !onRiver) c = 1.25;
        this.cost[idx(ix, iz)] = c;
      }
    }
    const base = this.cost.slice();
    for (let iz = 1; iz < N - 1; iz++)
      for (let ix = 1; ix < N - 1; ix++) {
        if (this.blocked[idx(ix, iz)]) continue;
        let nearWall = false;
        for (let dz = -1; dz <= 1 && !nearWall; dz++)
          for (let dx = -1; dx <= 1; dx++)
            if (this.blocked[idx(ix + dx, iz + dz)]) { nearWall = true; break; }
        if (nearWall) this.cost[idx(ix, iz)] = base[idx(ix, iz)] + 1.6;
      }
  }
  isFree(ix, iz) { return ix >= 0 && ix < N && iz >= 0 && iz < N && !this.blocked[idx(ix, iz)]; }
  isFreeWorld(x, z) { return this.isFree(toCellX(x), toCellZ(z)); }
  snap(x, z) {
    let ix = toCellX(x), iz = toCellZ(z);
    if (this.isFree(ix, iz)) return [ix, iz];
    for (let r = 1; r < N; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          if (this.isFree(ix + dx, iz + dz)) return [ix + dx, iz + dz];
        }
    return [ix, iz];
  }
  lineClear(ix0, iz0, ix1, iz1) {
    let dx = Math.abs(ix1 - ix0), dz = Math.abs(iz1 - iz0);
    let sx = ix0 < ix1 ? 1 : -1, sz = iz0 < iz1 ? 1 : -1;
    let err = dx - dz, x = ix0, z = iz0;
    while (true) {
      if (!this.isFree(x, z)) return false;
      if (x === ix1 && z === iz1) return true;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x += sx; }
      if (e2 < dx) { err += dx; z += sz; }
    }
  }
}

function aStar(grid, start, goal) {
  const [sx, sz] = start, [gx, gz] = goal;
  if (!grid.isFree(sx, sz) || !grid.isFree(gx, gz)) return null;
  const sI = idx(sx, sz), gI = idx(gx, gz);
  if (sI === gI) return [[sx, sz]];
  const came = new Int32Array(N * N).fill(-1);
  const gScore = new Float32Array(N * N).fill(Infinity);
  const closed = new Uint8Array(N * N);
  gScore[sI] = 0;
  const heap = [], hScore = [];
  const push = (i, f) => {
    heap.push(i); hScore.push(f); let c = heap.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (hScore[p] <= hScore[c]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]]; [hScore[p], hScore[c]] = [hScore[c], hScore[p]]; c = p; }
  };
  const pop = () => {
    const top = heap[0]; const last = heap.pop(), lastF = hScore.pop();
    if (heap.length) { heap[0] = last; hScore[0] = lastF; let c = 0;
      while (true) { let l = 2 * c + 1, r = 2 * c + 2, s = c;
        if (l < heap.length && hScore[l] < hScore[s]) s = l;
        if (r < heap.length && hScore[r] < hScore[s]) s = r;
        if (s === c) break; [heap[s], heap[c]] = [heap[c], heap[s]]; [hScore[s], hScore[c]] = [hScore[c], hScore[s]]; c = s; } }
    return top;
  };
  const heur = (ix, iz) => { const dx = Math.abs(ix - gx), dz = Math.abs(iz - gz); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz); };
  push(sI, heur(sx, sz));
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  let guard = 0;
  while (heap.length) {
    if (++guard > N * N) break;
    const cur = pop();
    if (cur === gI) { const path = []; let c = cur; while (c !== -1) { path.push([c % N, (c / N) | 0]); c = came[c]; } return path.reverse(); }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cix = cur % N, ciz = (cur / N) | 0;
    for (const [dx, dz, mul] of DIRS) {
      const nx = cix + dx, nz = ciz + dz;
      if (!grid.isFree(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!grid.isFree(cix + dx, ciz) || !grid.isFree(cix, ciz + dz))) continue;
      const nI = idx(nx, nz);
      if (closed[nI]) continue;
      const tentative = gScore[cur] + grid.cost[nI] * mul;
      if (tentative < gScore[nI]) { gScore[nI] = tentative; came[nI] = cur; push(nI, tentative + heur(nx, nz)); }
    }
  }
  return null;
}

function smoothPath(grid, cells) {
  if (!cells || cells.length === 0) return [];
  const pts = [cells[0]]; let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    const [ax, az] = cells[anchor];
    if (!grid.lineClear(ax, az, cells[i][0], cells[i][1])) { pts.push(cells[i - 1]); anchor = i - 1; }
  }
  pts.push(cells[cells.length - 1]);
  return pts.map(([ix, iz]) => new THREE.Vector3(cellToWorld(ix), 0, cellToWorld(iz)));
}

// ── Pre-baked smooth bridge deck profile (fixes per-frame raycast bobbing) ────
// The deck arches along Z and is ~flat across its 6 m width, so we bake a 1-D
// height-by-Z profile sampled along the centre line (away from the edge
// railings), fully gap-filled by interpolation → no NaNs, no plank steps, no
// railing-top spikes. Walkers then ride a smooth arch with no bobbing.
const DECK_HALF_X = 3.0;
function buildBridgeField(bridge) {
  if (!bridge) return null;
  const Z0 = -13, Z1 = 13, STEP = 0.3;
  const nz = Math.round((Z1 - Z0) / STEP) + 1;
  const H = new Float32Array(nz).fill(NaN);
  const ray = new THREE.Raycaster(); ray.far = 60;
  const down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3();
  bridge.updateMatrixWorld(true);
  const xs = [-0.8, -0.3, 0.3, 0.8]; // centre-line lanes, clear of the railings
  for (let j = 0; j < nz; j++) {
    const z = Z0 + j * STEP;
    let best = NaN;
    for (const x of xs) {
      o.set(x, 30, z); ray.set(o, down);
      const hits = ray.intersectObject(bridge, true);
      for (const h of hits) {
        if (h.point.y < 3.5) { // ignore arch/railing tops; keep the walkable deck
          if (isNaN(best) || h.point.y > best) best = h.point.y;
          break;
        }
      }
    }
    H[j] = best;
  }
  // Ends (beyond the deck) sit at ground level; interior gaps interpolate.
  if (isNaN(H[0])) H[0] = 0;
  if (isNaN(H[nz - 1])) H[nz - 1] = 0;
  let last = 0;
  for (let j = 1; j < nz; j++) {
    if (isNaN(H[j])) continue;
    const span = j - last;
    for (let k = last + 1; k < j; k++) H[k] = H[last] + (H[j] - H[last]) * ((k - last) / span);
    last = j;
  }
  // Light 1-D smooth.
  const S = H.slice();
  for (let j = 1; j < nz - 1; j++) S[j] = (H[j - 1] + 2 * H[j] + H[j + 1]) * 0.25;
  return { Z0, STEP, nz, H: S };
}
function sampleField(f, x, z) {
  if (!f || Math.abs(x) > DECK_HALF_X) return 0;
  const fz = (z - f.Z0) / f.STEP;
  if (fz < 0 || fz > f.nz - 1) return 0;
  const j0 = Math.floor(fz), j1 = Math.min(j0 + 1, f.nz - 1), t = fz - j0;
  return Math.max(0, f.H[j0] * (1 - t) + f.H[j1] * t);
}

// ── Per-instance outfit colour variety ───────────────────────────────────────
const _hsl = { h: 0, s: 0, l: 0 };
function recolorOutfit(fig, hueShift) {
  fig.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = mats.map((m) => {
      if (!m) return m;
      const c = m.clone();
      if (m.name !== 'Skin' && c.color) {
        c.color.getHSL(_hsl);
        const newH = (_hsl.h + hueShift + 1) % 1;
        c.color.setHSL(newH, Math.min(1, _hsl.s * (0.7 + _hsl.s)), _hsl.l);
      }
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0];
  });
}

// ── Build all visitors ───────────────────────────────────────────────────────
export async function buildVisitors({
  count = 10, obstacles = [], coasterFootprint = null, bridge = null,
} = {}) {
  const group = new THREE.Group();
  group.name = 'visitors';

  const grid = new NavGrid({ obstacles, coasterFootprint });
  const bridgeField = buildBridgeField(bridge);

  // Field-wide destination scatter + curated ride/path landmarks.
  const dests = [];
  for (const [x, z] of LANDMARKS) { const [ix, iz] = grid.snap(x, z); if (grid.isFree(ix, iz)) dests.push(new THREE.Vector3(cellToWorld(ix), 0, cellToWorld(iz))); }
  for (let iz = 2; iz < N - 2; iz += 3)
    for (let ix = 2; ix < N - 2; ix += 3)
      if (grid.isFree(ix, iz)) dests.push(new THREE.Vector3(cellToWorld(ix), 0, cellToWorld(iz)));

  const templates = await loadVisitorTemplates(Math.min(8, count));
  if (!templates.length) { group.userData.tick = () => {}; return group; }

  const HEIGHT = 3.28;
  const _box = new THREE.Box3();
  const visitors = [];
  const spawnPool = dests.slice().sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const rider = makeRider(template, HEIGHT, { pool: ['standRest'], facingY: 0, phase: i * 0.7, standing: true });
    recolorOutfit(rider.fig, Math.random());

    const root = new THREE.Group();
    root.name = `visitor_${i}`;
    root.add(rider.pivot);
    rider.pivot.position.set(0, 0, 0);

    // Build the gait rig from this clone's skeleton.
    const rig = makeGaitRig(rider.fig);
    if (!rig) console.warn(`visitor_${i}: unsupported rig, figure will stand still`);

    const speed = rand(1.0, 1.65);
    const w = {
      root, rider, rig,
      state: 'waiting', wait: rand(0.4, 2.5),
      path: [], pathIdx: 0, heading: 0,
      dest: new THREE.Vector3(),
      speed, phase: Math.random(), moveBlend: 0, lean: 0,
      seed: Math.random() * 10, needsPath: false,
      // per-visitor gait flavour
      strideArm: rig ? GAIT.stride * rig.legLen * rand(0.95, 1.08) * (0.85 + 0.15 * (speed / 1.5)) : 1,
      standZL: rig ? rand(-0.06, 0.12) * rig.legLen : 0,
      standZR: rig ? rand(-0.12, 0.06) * rig.legLen : 0,
      standW: rand(0.95, 1.15),
    };

    // Ground calibration: pose the idle stance, measure the true sole level
    // (skinned verts), derive the flat-foot ankle height, then offset the
    // pivot so the soles sit exactly on y = 0.
    if (rig) {
      // Residual ground correction: pose the idle stance and measure the true
      // (skinned) sole level. Bone matrices need a manual refresh — no render
      // has happened yet. Clamped: it should be a small fix-up only.
      root.position.set(0, 0, 0);
      applyGaitPose(w, 0);
      root.updateMatrixWorld(true);
      rider.fig.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
      _box.setFromObject(rider.fig, true);
      if (isFinite(_box.min.y)) rider.pivot.position.y -= clamp(_box.min.y, -0.3, 0.3);
    }

    // Spread spawn well apart from earlier spawns.
    let spawn = spawnPool[i % spawnPool.length];
    for (const cand of spawnPool) { let ok = true; for (const v of visitors) if (cand.distanceTo(v.root.position) < 6) { ok = false; break; } if (ok) { spawn = cand; break; } }
    root.position.set(spawn.x, 0, spawn.z);
    root.rotation.y = Math.random() * Math.PI * 2;
    group.add(root);

    w.heading = root.rotation.y;
    w.dest.set(spawn.x, 0, spawn.z);
    visitors.push(w);
  }

  function groundHeight(x, z) { return sampleField(bridgeField, x, z); }

  const planQueue = [];
  function planNewDestination(w) {
    if (!dests.length) { w.state = 'waiting'; w.wait = rand(1, 5); return; }
    const start = grid.snap(w.root.position.x, w.root.position.z);
    let goalVec = null;
    for (let t = 0; t < 16; t++) {
      const cand = dests[(Math.random() * dests.length) | 0];
      if (cand.distanceTo(w.root.position) < 16) continue;
      let claimed = false;
      for (const v of visitors) { if (v === w) continue; if (cand.distanceTo(v.dest) < 4.5) { claimed = true; break; } }
      if (!claimed) { goalVec = cand; break; }
    }
    if (!goalVec) goalVec = dests[(Math.random() * dests.length) | 0];
    const pts = smoothPath(grid, aStar(grid, start, grid.snap(goalVec.x, goalVec.z)));
    if (pts.length >= 2) {
      if (pts[0].distanceTo(w.root.position) < CELL) pts.shift();
      w.path = pts; w.pathIdx = 0; w.state = 'walking'; w.dest.copy(pts[pts.length - 1]);
    } else { w.state = 'waiting'; w.wait = rand(1, 3); }
  }

  const SEP = 1.9;
  function pushApart() {
    for (let i = 0; i < visitors.length; i++) {
      const a = visitors[i].root.position;
      for (let j = i + 1; j < visitors.length; j++) {
        const b = visitors[j].root.position;
        let dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
        if (d >= SEP) continue;
        if (d < 1e-3) { dx = Math.cos(i * 2.3); dz = Math.sin(i * 2.3); d = 1; }
        const push = (SEP - d) * 0.5, nx = dx / d, nz = dz / d;
        const ax = a.x + nx * push, az = a.z + nz * push; if (grid.isFreeWorld(ax, az)) { a.x = ax; a.z = az; }
        const bx = b.x - nx * push, bz = b.z - nz * push; if (grid.isFreeWorld(bx, bz)) { b.x = bx; b.z = bz; }
      }
    }
  }

  const _dir = new THREE.Vector3();
  group.userData.tick = (delta, time) => {
    const dt = Math.min(delta, 0.05);

    for (const w of visitors) {
      // State machine + movement.
      let leanTarget = 0;
      if (w.state === 'waiting') {
        w.wait -= dt;
        if (w.wait <= 0 && !w.needsPath) { w.needsPath = true; planQueue.push(w); }
      } else {
        const tgt = w.path[w.pathIdx];
        if (!tgt) { w.state = 'waiting'; w.wait = rand(1, 5); }
        else {
          _dir.set(tgt.x - w.root.position.x, 0, tgt.z - w.root.position.z);
          const dist = _dir.length();
          if (dist < 0.4) { if (++w.pathIdx >= w.path.length) { w.state = 'waiting'; w.wait = rand(1, 5); } }
          else {
            _dir.multiplyScalar(1 / dist);
            // Ease in from a stop, ease out into the final waypoint.
            const arrive = w.pathIdx >= w.path.length - 1 ? clamp(dist / 1.4, 0.35, 1) : 1;
            const eff = w.speed * (0.3 + 0.7 * smooth01(w.moveBlend)) * arrive;
            const step = Math.min(eff * dt, dist);
            w.root.position.x += _dir.x * step;
            w.root.position.z += _dir.z * step;
            const desired = Math.atan2(_dir.x, _dir.z);
            let dY = desired - w.heading;
            while (dY > Math.PI) dY -= TWO_PI;
            while (dY < -Math.PI) dY += TWO_PI;
            const turn = clamp(dY, -7 * dt, 7 * dt);
            w.heading += turn;
            w.root.rotation.y = w.heading;
            leanTarget = clamp(-(turn / Math.max(dt, 1e-4)) * 0.012, -0.06, 0.06) * w.moveBlend;
            // Phase advances by distance/stride → cadence always matches speed.
            const strideWorld = w.rig ? w.strideArm * w.rig.scale : 2.2;
            w.phase = (w.phase + (step / strideWorld)) % 1;
          }
        }
      }

      // Animate: blend walk ⇄ idle and pose the whole skeleton analytically.
      const targetBlend = w.state === 'walking' ? 1 : 0;
      w.moveBlend += (targetBlend - w.moveBlend) * clamp(dt * 4.5, 0, 1);
      w.lean += (leanTarget - w.lean) * clamp(dt * 5, 0, 1);
      applyGaitPose(w, time);
    }

    pushApart();

    for (const w of visitors) w.root.position.y = groundHeight(w.root.position.x, w.root.position.z);

    let budget = 2;
    while (planQueue.length && budget-- > 0) { const w = planQueue.shift(); w.needsPath = false; planNewDestination(w); }
  };

  group.userData.grid = grid;
  group.userData.visitors = visitors;
  group.userData.bridgeField = bridgeField;
  return group;
}
