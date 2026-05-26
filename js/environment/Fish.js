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
const TARGET_FISH_LENGTH = 0.65;

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

  // ─── Ripple Pool ──────────────────────────────────────────────
  const rippleCount = 8;
  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.8, 1.0, 24);
  
  for (let i = 0; i < rippleCount; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xcce6ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const rMesh = new THREE.Mesh(rippleGeo, rMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.visible = false;
    group.add(rMesh);
    
    ripples.push({
      mesh: rMesh,
      active: false,
      time: 0,
      duration: 1.0,
      maxScale: 2.5
    });
  }

  function spawnRipple(x, z) {
    const rip = ripples.find(r => !r.active);
    if (rip) {
      rip.active = true;
      rip.time = 0;
      rip.mesh.position.set(x, WATER_LEVEL + 0.005, z);
      rip.mesh.scale.set(0.01, 0.01, 0.01);
      rip.mesh.visible = true;
      rip.mesh.material.opacity = 0.65;
    }
  }

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
      // Dynamic motion state
      baseFreq:     3.6 + Math.random() * 1.2,
      nextJump:     4.0 + Math.random() * 8.0, // jump less often so it's more special
      jumpT:        -1,
      jumpDur:      1.2 + Math.random() * 0.4,
      jumpRoll:     0,
      jumpHeight:   0.7 + Math.random() * 0.5,
      depthVariant: -0.13 - Math.random() * 0.04,
      // Swim state variables (Burst-and-Coast)
      swimState:    Math.random() < 0.5 ? 'burst' : 'coast',
      stateTimer:   1.0 + Math.random() * 2.0,
      activeSpeed:  1.0,
      activeFreq:   3.6,
      activeAmp:    0.35,
      activeFinAmp: 0.30,
      phaseAccumulator: 0,
      wasUnderwater: true
    });
  }

  group.userData.tick = (delta, time, _windSpeed) => {
    // ── Update Ripples ──────────────────────────────────────────
    for (const rip of ripples) {
      if (!rip.active) continue;
      rip.time += delta;
      const progress = rip.time / rip.duration;
      if (progress >= 1.0) {
        rip.active = false;
        rip.mesh.visible = false;
      } else {
        const s = THREE.MathUtils.lerp(0.01, rip.maxScale, progress);
        rip.mesh.scale.set(s, s, s);
        rip.mesh.material.opacity = 0.65 * (1.0 - progress);
      }
    }

    for (const f of fishes) {
      const b = f.bones;

      // ── Swim state machine (Burst-and-Coast) ──────────────────
      f.stateTimer -= delta;
      if (f.stateTimer <= 0) {
        if (f.swimState === 'burst') {
          f.swimState = 'coast';
          f.stateTimer = 2.0 + Math.random() * 3.0; // coast longer
        } else {
          f.swimState = 'burst';
          f.stateTimer = 1.0 + Math.random() * 1.5; // burst shorter
        }
      }

      // Determine target values
      let targetSpeedMultiplier = 1.0;
      let targetFreq = f.baseFreq;
      let targetAmp = 0.35;
      let targetFinAmp = 0.30;

      if (f.jumpT >= 0) {
        targetSpeedMultiplier = 2.2;
        targetFreq = f.baseFreq * 2.5;
        targetAmp = 0.65;
        targetFinAmp = 0.10;
      } else if (f.swimState === 'burst') {
        targetSpeedMultiplier = 1.6 + Math.random() * 0.2;
        targetFreq = f.baseFreq * 1.6;
        targetAmp = 0.50;
        targetFinAmp = 0.05; // tuck fins during burst
      } else {
        // Coasting / drifting
        targetSpeedMultiplier = 0.35 + Math.sin(time * 0.5 + f.bobPhase) * 0.15;
        targetFreq = f.baseFreq * 0.3;
        targetAmp = 0.12; // very gentle wag
        targetFinAmp = 0.45; // flare fins to stabilize
      }

      // Smoothly interpolate active state values
      f.activeSpeed = THREE.MathUtils.lerp(f.activeSpeed, targetSpeedMultiplier, 0.08);
      f.activeFreq = THREE.MathUtils.lerp(f.activeFreq, targetFreq, 0.08);
      f.activeAmp = THREE.MathUtils.lerp(f.activeAmp, targetAmp, 0.08);
      f.activeFinAmp = THREE.MathUtils.lerp(f.activeFinAmp, targetFinAmp, 0.08);

      // Accumulate phase smoothly to avoid frequency change jumps
      f.phaseAccumulator += delta * f.activeFreq * 2 * Math.PI;
      const phase = f.phaseAccumulator + f.wagPhase;
      const tailPhase = Math.sin(phase);

      // ── Cyclic propulsion speed modification ───────────────────
      const propulse = 0.85 + 0.25 * Math.max(0, Math.cos(phase));
      const speedMul = f.activeSpeed * propulse;
      f.x += f.baseSpeed * speedMul * f.dir * delta;
      
      if (f.x > RIVER_X_MAX - 8) { f.dir = -1; f.x = RIVER_X_MAX - 8; }
      if (f.x < RIVER_X_MIN + 8) { f.dir =  1; f.x = RIVER_X_MIN + 8; }

      const cz = riverCenter(f.x);
      const hw = riverHalfWidth(f.x);
      const lateral = Math.sin(time * 0.7 + f.lateralPhase) * (hw * 0.55);
      const z = cz + lateral;
      const lateralVel = Math.cos(time * 0.7 + f.lateralPhase) * (hw * 0.55) * 0.7;
      // Turn rate / curvature is proportional to lateral acceleration
      const lateralAcc = -Math.sin(time * 0.7 + f.lateralPhase) * (hw * 0.55) * 0.49;

      // ── Depth and Jumps ────────────────────────────────────────
      const bob = Math.sin(time * 1.8 + f.bobPhase) * 0.02;
      let y = WATER_LEVEL + f.depthVariant + bob;

      let pitch = Math.cos(time * 1.8 + f.bobPhase) * 0.04;
      let roll  = lateralVel * 0.18 * f.dir;
      let curlBack  = 0;
      let curlFront = 0;

      // Jump trigger check
      if (f.jumpT < 0 && time >= f.nextJump) {
        f.jumpT = 0;
        f.jumpRoll = (Math.random() - 0.5) * 1.5; // roll in air
      }

      if (f.jumpT >= 0) {
        f.jumpT += delta / f.jumpDur;
        if (f.jumpT >= 1) {
          f.jumpT = -1;
          f.nextJump = time + 6 + Math.random() * 10;
        } else {
          const t = f.jumpT;
          const arc = Math.sin(t * Math.PI);
          // Height arc
          y = THREE.MathUtils.lerp(WATER_LEVEL + f.depthVariant, WATER_LEVEL + f.jumpHeight, arc);
          
          // Trajectory Pitch: positive on ascent, zero at apex, negative on descent
          pitch = Math.cos(t * Math.PI) * 0.95;
          // Add roll rotation
          roll = arc * f.jumpRoll;
          
          // Frantic air thrashing curl
          curlBack  = -Math.cos(t * Math.PI) * 0.35 + Math.sin(time * 15.0) * 0.10;
          curlFront = -Math.cos(t * Math.PI) * 0.15 + Math.sin(time * 15.0) * 0.05;
        }
      }

      // ── Entry/Exit boundary crossings (Ripples) ──────────────────
      const isUnderwater = y < WATER_LEVEL;
      if (f.wasUnderwater !== isUnderwater) {
        spawnRipple(f.x, z);
        f.wasUnderwater = isUnderwater;
      }

      // ── Root transform (world position + heading) ───────────────
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

      // ── Spine Turn-Bending ─────────────────────────────────────
      // Flex spine front and back yaw rotation based on turn acceleration
      const spineYaw = lateralAcc * 0.12 * f.dir;

      // ── Bone rotations ─────────────────────────────────────────
      if (b.tail) {
        const r = b.rest.tail;
        // Thrash frantically if in the air
        const amp = f.activeAmp;
        const wag = f.jumpT >= 0 ? Math.sin(phase * 1.5) * amp * 1.3 : tailPhase * amp;
        b.tail.rotation.set(r.x, r.y, r.z + wag);
      }
      if (b.spineBack) {
        const r = b.rest.spineBack;
        const wag = Math.sin(phase - 0.35) * f.activeAmp * 0.55;
        b.spineBack.rotation.set(
          r.x + curlBack,
          r.y + spineYaw * 0.5,
          r.z + wag
        );
      }
      if (b.spineFront) {
        const r = b.rest.spineFront;
        const wag = Math.sin(phase - 0.70) * f.activeAmp * 0.22;
        b.spineFront.rotation.set(
          r.x + curlFront,
          r.y + spineYaw * 0.8,
          r.z + wag
        );
      }
      if (b.root) {
        const r = b.rest.root;
        b.root.rotation.set(r.x, r.y, r.z - tailPhase * f.activeAmp * 0.10);
      }

      // ── Pectoral fin idle paddle & steer ───────────────────────
      const finPhase = time * (f.activeFreq * 0.6) * 2 * Math.PI + f.finPhase;
      const finAmp = f.activeFinAmp;
      if (b.finL) {
        const r = b.rest.finL;
        // Pectoral steering: flare the inside fin, tuck the outside fin
        const steerTuck = Math.max(0, -lateralVel * f.dir) * 0.4;
        b.finL.rotation.set(r.x + Math.sin(finPhase) * finAmp, r.y + steerTuck, r.z);
      }
      if (b.finR) {
        const r = b.rest.finR;
        const steerTuck = Math.max(0, lateralVel * f.dir) * 0.4;
        b.finR.rotation.set(r.x + Math.sin(finPhase + Math.PI) * finAmp, r.y + steerTuck, r.z);
      }
    }
  };

  return group;
}
