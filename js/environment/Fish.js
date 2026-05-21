// Fully procedural fish animation.
// The clown_fish GLB ships with baked keyframe animation; loadGLB() strips it before
// we get here, and we never instantiate an AnimationMixer. Everything below is hand-
// driven sine math layered on the bind-pose skeleton.
//
// Skeleton (verified by traversal):
//   bone_root_00 → bone_spine_front_01 → bone_spine_back_05 → bone_tailfin_06
//                                       ↳ bone_fin_l_02 (left pectoral)
//                                       ↳ bone_fin_r_03 (right pectoral)
//                                       ↳ bone_mouth_04
//
// Animation layers, evaluated every frame on every fish:
//   1. Traveling tail wave — tail leads, spine_back trails by phase, spine_front trails more.
//      This is what reads as "swimming under its own power" instead of being drifted.
//   2. Counter-yaw on the head/root  — opposite phase to the tail, very small amplitude.
//      Real fish "wag" their heads slightly as a reaction to tail thrust.
//   3. Cyclic propulsion — forward speed pulses with each tail beat (faster on the kick).
//   4. Pectoral fin idle — left/right fins paddle gently out of phase.
//   5. Jump arc — sine height arc + tangent pitch + spine curl + amplified wag (escape thrash).

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB } from '../utils/loaders.js';
import { riverCenter, riverHalfWidth, RIVER_X_MIN, RIVER_X_MAX } from '../utils/river.js';

const WATER_LEVEL = 0.25;
const FISH_URL = 'assets/models/clown_fish_low_poly_animated.glb';
const FISH_COUNT = 8;
const TARGET_FISH_LENGTH = 1.0;

const BONE_NAMES = {
  root:       'bone_root_00',
  spineFront: 'bone_spine_front_01',
  spineBack:  'bone_spine_back_05',
  tail:       'bone_tailfin_06',
  finL:       'bone_fin_l_02',
  finR:       'bone_fin_r_03',
};

async function loadFishTemplate() {
  const gltf = await loadGLB(FISH_URL); // loadGLB already strips gltf.animations
  const source = gltf.scene;

  source.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      if (o.material) {
        o.material.side = THREE.DoubleSide;
        if (o.material.color && o.material.color.getHex() === 0xffffff) {
          o.material.color.setHex(0xff6a1a);
        }
        if ('emissive' in o.material) {
          o.material.emissive = new THREE.Color(0xff3300);
          o.material.emissiveIntensity = 0.3;
        }
        o.material.toneMapped = true;
      }
      // SkinnedMesh bounding box ignores skinned deformation — leave culling off.
      o.frustumCulled = false;
    }
  });

  const bbox = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  const scale = longest > 0 ? TARGET_FISH_LENGTH / longest : 1;
  const forwardAxis = size.x >= size.z ? 'x' : 'z';

  return { source, scale, forwardAxis };
}

function findBones(root) {
  const found = {};
  root.traverse((o) => {
    if (!o.isBone) return;
    for (const k of Object.keys(BONE_NAMES)) {
      if (o.name === BONE_NAMES[k]) found[k] = o;
    }
  });
  // Cache bind-pose rotations so we can add wag deltas on top.
  const rest = {};
  for (const k of Object.keys(found)) rest[k] = new THREE.Euler().copy(found[k].rotation);
  return { ...found, rest };
}

export async function buildFish() {
  const group = new THREE.Group();
  group.name = 'fish';

  let tmpl;
  try {
    tmpl = await loadFishTemplate();
  } catch (err) {
    console.warn('Fish GLB failed:', err.message);
    return group;
  }

  const fishes = [];

  for (let i = 0; i < FISH_COUNT; i++) {
    const inst = cloneSkinned(tmpl.source);
    inst.scale.setScalar(tmpl.scale);

    const root = new THREE.Group();
    root.add(inst);
    group.add(root);

    const bones = findBones(inst);
    const seedX = THREE.MathUtils.lerp(RIVER_X_MIN + 10, RIVER_X_MAX - 10, (i + 0.5) / FISH_COUNT);

    fishes.push({
      root,
      inst,
      bones,
      forwardAxis: tmpl.forwardAxis,
      x: seedX,
      baseSpeed: 1.6 + Math.random() * 1.0,
      dir: Math.random() < 0.5 ? -1 : 1,
      lateralPhase: Math.random() * Math.PI * 2,
      bobPhase:     Math.random() * Math.PI * 2,
      wagPhase:     Math.random() * Math.PI * 2,
      finPhase:     Math.random() * Math.PI * 2,
      // Each fish has its own swim cadence (Hz) so they don't beat in sync.
      swimFreq:     3.6 + Math.random() * 1.2,
      nextJump:     1.5 + Math.random() * 4,
      jumpT:        -1,
      jumpDur:      1.2 + Math.random() * 0.4,
      jumpRoll:     0,
      jumpHeight:   0.7 + Math.random() * 0.5,
      depthVariant: -0.10 - Math.random() * 0.05,
    });
  }

  group.userData.tick = (delta, time, _windSpeed) => {
    for (const f of fishes) {
      const b = f.bones;

      // ── Swim cycle phase (used by tail wag, head counter-yaw, propulsion pulse) ────
      const swimFreqHz = f.jumpT >= 0 ? f.swimFreq * 2.2 : f.swimFreq;
      const swimAmp    = f.jumpT >= 0 ? 0.55 : 0.40;
      const phase = time * swimFreqHz * 2 * Math.PI + f.wagPhase;
      const tailPhase = Math.sin(phase);

      // ── Cyclic propulsion: speed pulses with each tail kick (~+25%/-15%). ──────────
      const propulse = 0.85 + 0.25 * Math.max(0, Math.cos(phase));
      const speedMul = (f.jumpT >= 0 ? 1.5 : 1.0) * propulse;
      f.x += f.baseSpeed * speedMul * f.dir * delta;
      if (f.x > RIVER_X_MAX - 8) { f.dir = -1; f.x = RIVER_X_MAX - 8; }
      if (f.x < RIVER_X_MIN + 8) { f.dir =  1; f.x = RIVER_X_MIN + 8; }

      const cz = riverCenter(f.x);
      const hw = riverHalfWidth(f.x);
      const lateral = Math.sin(time * 0.7 + f.lateralPhase) * (hw * 0.55);
      const z = cz + lateral;
      const lateralVel = Math.cos(time * 0.7 + f.lateralPhase) * (hw * 0.55) * 0.7;

      // ── Depth (underwater swim) ────────────────────────────────────────────────────
      const bob = Math.sin(time * 1.8 + f.bobPhase) * 0.02;
      let y = WATER_LEVEL + f.depthVariant + bob;

      // Cruising pose: very subtle pitch from bob, gentle roll into lateral turn.
      let pitch = Math.cos(time * 1.8 + f.bobPhase) * 0.04;
      let roll  = lateralVel * 0.18 * f.dir;
      let curlBack  = 0;
      let curlFront = 0;

      // ── Jump trigger ──────────────────────────────────────────────────────────────
      if (f.jumpT < 0 && time >= f.nextJump) {
        f.jumpT = 0;
        f.jumpRoll = (Math.random() - 0.5) * 0.6;
      }

      if (f.jumpT >= 0) {
        f.jumpT += delta / f.jumpDur;
        if (f.jumpT >= 1) {
          f.jumpT = -1;
          f.nextJump = time + 5 + Math.random() * 8;
        } else {
          const t = f.jumpT;
          const arc = Math.sin(t * Math.PI);
          y = THREE.MathUtils.lerp(WATER_LEVEL + f.depthVariant, WATER_LEVEL + f.jumpHeight, arc);
          // Pitch = arc tangent (cosine) — nose up climbing → level at apex → nose down on descent.
          pitch = Math.cos(t * Math.PI) * 0.95;
          // Optional barrel-roll mid-air.
          roll = arc * f.jumpRoll;
          // Body curl: the whole spine bends into the jump direction.
          curlBack  = -Math.cos(t * Math.PI) * 0.30;
          curlFront = -Math.cos(t * Math.PI) * 0.12;
        }
      }

      // ── Root transform (world position + heading) ─────────────────────────────────
      f.root.position.set(f.x, y, z);
      const baseYaw = f.dir > 0 ? 0 : Math.PI;
      const extraYaw = f.forwardAxis === 'z' ? Math.PI / 2 : 0;
      f.root.rotation.set(0, baseYaw + extraYaw, 0);

      const signedPitch = f.dir > 0 ? pitch : -pitch;
      if (f.forwardAxis === 'x') {
        f.root.rotation.z = signedPitch;
        f.root.rotation.x = roll;
      } else {
        f.root.rotation.x = signedPitch;
        f.root.rotation.z = roll;
      }

      // ── Bone-driven swim ──────────────────────────────────────────────────────────
      // Travelling sine wave along the spine: tail leads, spine_back trails 0.35 rad,
      // spine_front trails 0.70 rad, root counter-yaws in opposite phase.
      if (b.tail) {
        const r = b.rest.tail;
        b.tail.rotation.set(r.x, r.y, r.z + tailPhase * swimAmp);
      }
      if (b.spineBack) {
        const r = b.rest.spineBack;
        b.spineBack.rotation.set(
          r.x + curlBack,
          r.y,
          r.z + Math.sin(phase - 0.35) * swimAmp * 0.55
        );
      }
      if (b.spineFront) {
        const r = b.rest.spineFront;
        b.spineFront.rotation.set(
          r.x + curlFront,
          r.y,
          r.z + Math.sin(phase - 0.70) * swimAmp * 0.22
        );
      }
      // Counter-yaw on the head/root bone — reaction to tail thrust, opposite phase, tiny amplitude.
      if (b.root) {
        const r = b.rest.root;
        b.root.rotation.set(r.x, r.y, r.z - tailPhase * swimAmp * 0.10);
      }

      // ── Pectoral fin idle paddle ──────────────────────────────────────────────────
      // Fins paddle out of phase with each other and 90° off the tail so the steering motion
      // doesn't visually beat with the swim cycle.
      const finPhase = time * (swimFreqHz * 0.6) * 2 * Math.PI + f.finPhase;
      const finAmp = f.jumpT >= 0 ? 0.55 : 0.30;
      if (b.finL) {
        const r = b.rest.finL;
        b.finL.rotation.set(r.x + Math.sin(finPhase) * finAmp, r.y, r.z);
      }
      if (b.finR) {
        const r = b.rest.finR;
        b.finR.rotation.set(r.x + Math.sin(finPhase + Math.PI) * finAmp, r.y, r.z);
      }
    }
  };

  return group;
}
