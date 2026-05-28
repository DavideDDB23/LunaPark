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
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  
  const longest = Math.max(size.x, size.y, size.z);
  const scale = longest > 0 ? TARGET_FISH_LENGTH / longest : 1;
  const forwardAxis = size.x >= size.z ? 'x' : 'z';

  // Wrap and center the raw GLTF scene around the origin
  const wrapper = new THREE.Group();
  wrapper.name = 'fish_wrapper';
  wrapper.add(source);
  source.position.set(-center.x, -center.y, -center.z);

  return { source: wrapper, scale, forwardAxis };
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

export async function buildFish(water) {
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

  // ─── Custom Foam Ring Shader Material ─────────────────────────
  const ringVertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const ringFragmentShader = /* glsl */ `
    uniform float uProgress;
    uniform float uOpacity;
    uniform vec3 uColor;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    void main() {
      // Planar UV distance from center (0.5, 0.5)
      float d = length(vUv - vec2(0.5)) * 2.0;
      
      // Ring thickness profile (fades at inner 0.78 and outer 1.02 boundaries)
      float radial = smoothstep(0.78, 0.88, d) * smoothstep(1.02, 0.92, d);
      if (radial <= 0.0) discard;

      // Circular angle for polar coordinates noise
      float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
      
      // Warped circular foam texture
      vec2 noiseUv = vec2(angle * 5.0, (d - 0.9) * 20.0 - uProgress * 3.0);
      float n1 = noise(noiseUv);
      float n2 = noise(noiseUv * 2.1 + vec2(uProgress * 1.5));
      float n = 0.6 * n1 + 0.4 * n2;

      // Foam breaks up dynamically as progress increases
      float threshold = 0.25 + uProgress * 0.5;
      float foam = smoothstep(threshold, threshold + 0.12, n);
      float alpha = foam * radial * uOpacity * (1.0 - uProgress);
      
      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  // ─── Concentric Ripple Pool ───────────────────────────────────
  const rippleCount = 32;
  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.8, 1.0, 32);
  
  for (let i = 0; i < rippleCount; i++) {
    const rMat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(0xd8edff) }
      },
      vertexShader: ringVertexShader,
      fragmentShader: ringFragmentShader,
      transparent: true,
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
      age: 0,
      delay: 0,
      duration: 1.0,
      maxScale: 2.5
    });
  }

  function triggerSplashRipples(x, z, isEntry) {
    const configs = isEntry ? [
      { delay: 0.0, duration: 0.8, maxScale: 1.8 },
      { delay: 0.1, duration: 1.0, maxScale: 2.6 },
      { delay: 0.25, duration: 1.2, maxScale: 3.4 }
    ] : [
      { delay: 0.0, duration: 0.6, maxScale: 1.4 },
      { delay: 0.15, duration: 0.9, maxScale: 2.1 }
    ];
    
    for (const conf of configs) {
      const rip = ripples.find(r => !r.active);
      if (rip) {
        rip.active = true;
        rip.age = 0;
        rip.delay = conf.delay;
        rip.duration = conf.duration;
        rip.maxScale = conf.maxScale;
        rip.mesh.position.set(x, WATER_LEVEL + 0.005, z);
        rip.mesh.scale.set(0.01, 0.01, 0.01);
        rip.mesh.visible = false;
        rip.mesh.material.uniforms.uOpacity.value = 0.0;
        rip.mesh.material.uniforms.uProgress.value = 0.0;
        rip.mesh.material.uniforms.uColor.value.setHex(isEntry ? 0xffffff : 0xd8edff);
      }
    }
  }

  // ─── Droplet Particle Pool ────────────────────────────────────
  const particleCount = 150;
  const particles = [];
  const dropGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
  
  for (let i = 0; i < particleCount; i++) {
    const dMat = new THREE.MeshBasicMaterial({
      color: 0xe6f2ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const dMesh = new THREE.Mesh(dropGeo, dMat);
    dMesh.visible = false;
    group.add(dMesh);
    
    particles.push({
      mesh: dMesh,
      active: false,
      vx: 0, vy: 0, vz: 0,
      age: 0,
      duration: 1.0
    });
  }

  function triggerSplashDroplets(x, z, vx, vy, vz, isEntry) {
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const speedBonus = Math.floor(speed * 2.0);
    const numDroplets = isEntry
      ? (36 + speedBonus + Math.floor(Math.random() * 16))
      : (14 + Math.floor(Math.random() * 8));
    
    for (let k = 0; k < numDroplets; k++) {
      const part = particles.find(p => !p.active);
      if (!part) break;
      
      part.active = true;
      part.age = 0;
      part.duration = 0.5 + Math.random() * 0.5;
      part.mesh.position.set(
        x + (Math.random() - 0.5) * 0.1,
        WATER_LEVEL + 0.01,
        z + (Math.random() - 0.5) * 0.1
      );
      
      const baseScale = isEntry ? (0.6 + Math.random() * 0.8) : (0.4 + Math.random() * 0.6);
      part.mesh.scale.setScalar(baseScale);
      part.mesh.visible = true;
      part.mesh.material.opacity = 0.9;
      
      const angle = Math.random() * Math.PI * 2;
      const spreadSpeed = isEntry ? (1.5 + Math.random() * 2.5) : (0.8 + Math.random() * 1.5);
      
      const rx = Math.cos(angle) * spreadSpeed;
      const rz = Math.sin(angle) * spreadSpeed;
      
      if (isEntry) {
        // Entry radial rebound + forward momentum
        part.vx = rx * 0.7 + vx * 0.4;
        part.vy = Math.abs(vy) * 0.5 + 2.0 + Math.random() * 3.0; // rebound upwards
        part.vz = rz * 0.7 + vz * 0.4;
      } else {
        // Exit spray forward-up
        part.vx = rx * 0.5 + vx * 0.6;
        part.vy = vy * 0.7 + 1.5 + Math.random() * 2.0;
        part.vz = rz * 0.5 + vz * 0.6;
      }
    }
  }

  function spawnContinuousTrailDroplets(x, y, z, vx, vy, vz, count, isEntry) {
    for (let k = 0; k < count; k++) {
      const part = particles.find(p => !p.active);
      if (!part) break;
      
      part.active = true;
      part.age = 0;
      part.duration = 0.3 + Math.random() * 0.3;
      part.mesh.position.set(
        x + (Math.random() - 0.5) * 0.08,
        y,
        z + (Math.random() - 0.5) * 0.08
      );
      
      const baseScale = isEntry ? (0.4 + Math.random() * 0.5) : (0.3 + Math.random() * 0.3);
      part.mesh.scale.setScalar(baseScale);
      part.mesh.visible = true;
      part.mesh.material.opacity = 0.8;
      
      const angle = Math.random() * Math.PI * 2;
      const spreadSpeed = isEntry ? (0.6 + Math.random() * 0.8) : (0.4 + Math.random() * 0.6);
      
      part.vx = Math.cos(angle) * spreadSpeed + vx * 0.3;
      part.vy = Math.abs(vy) * 0.2 + 0.6 + Math.random() * 0.8; // pop up slightly
      part.vz = Math.sin(angle) * spreadSpeed + vz * 0.3;
    }
  }

  function triggerFullSplash(x, z, vx, vy, vz, isEntry) {
    if (water && water.userData.triggerRipple) {
      water.userData.triggerRipple(x, z, isEntry ? 1.4 : 0.7);
    }
    triggerSplashRipples(x, z, isEntry);
    triggerSplashDroplets(x, z, vx, vy, vz, isEntry);
  }

  for (let i = 0; i < FISH_COUNT; i++) {
    const inst = cloneSkinned(tmpl.source);
    inst.scale.setScalar(tmpl.scale);

    const root = new THREE.Group();
    root.userData.isFishRoot = true;
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
      y: WATER_LEVEL + (-0.22 - Math.random() * 0.05),
      z: riverCenter(seedX),
      baseSpeed: 1.6 + Math.random() * 1.0,
      dir: Math.random() < 0.5 ? -1 : 1,
      lateralPhase: Math.random() * Math.PI * 2,
      bobPhase:     Math.random() * Math.PI * 2,
      wagPhase:     Math.random() * Math.PI * 2,
      finPhase:     Math.random() * Math.PI * 2,
      // Dynamic motion state
      baseFreq:     3.6 + Math.random() * 1.2,
      nextJump:     4.0 + Math.random() * 8.0,
      jumpState:    'swim',
      isTurning:    false,
      targetDir:    0,
      vx: 0, vy: 0, vz: 0,
      airTime: 0,
      airT: 0,
      diveT: 0,
      jumpRoll:     0,
      depthVariant: -0.22 - Math.random() * 0.05,
      // Swim state variables (Burst-and-Coast)
      swimState:    Math.random() < 0.5 ? 'burst' : 'coast',
      stateTimer:   1.0 + Math.random() * 2.0,
      activeSpeed:  1.0,
      activeFreq:   3.6,
      activeAmp:    0.35,
      activeFinAmp: 0.30,
      phaseAccumulator: 0
    });
  }

  group.userData.fishes = fishes; // debug: expose for camera tracking / forced jumps

  group.userData.tick = (delta, time, _windSpeed) => {
    // Clamp delta to prevent physics glitches during lag spikes
    const dt = Math.min(delta, 0.05);

    // ── Update Ripples ──────────────────────────────────────────
    for (const rip of ripples) {
      if (!rip.active) continue;
      rip.age += dt;
      if (rip.age < rip.delay) continue;
      
      const progress = (rip.age - rip.delay) / rip.duration;
      if (progress >= 1.0) {
        rip.active = false;
        rip.mesh.visible = false;
      } else {
        rip.mesh.visible = true;
        const s = THREE.MathUtils.lerp(0.01, rip.maxScale, progress);
        rip.mesh.scale.set(s, s, s);
        rip.mesh.material.uniforms.uProgress.value = progress;
        rip.mesh.material.uniforms.uOpacity.value = 0.85;
      }
    }

    // ── Update Droplets ─────────────────────────────────────────
    const gravity = 12.0;
    for (const part of particles) {
      if (!part.active) continue;
      part.age += dt;
      const progress = part.age / part.duration;
      if (progress >= 1.0 || part.mesh.position.y < WATER_LEVEL - 0.1) {
        part.active = false;
        part.mesh.visible = false;
      } else {
        part.vy -= gravity * dt;
        part.mesh.position.x += part.vx * dt;
        part.mesh.position.y += part.vy * dt;
        part.mesh.position.z += part.vz * dt;
        
        const scaleVal = 1.0 - progress;
        part.mesh.material.opacity = 0.9 * (1.0 - progress);

        // Motion stretched droplet particles
        const speed = Math.sqrt(part.vx * part.vx + part.vy * part.vy + part.vz * part.vz);
        if (speed > 0.01) {
          const dir = new THREE.Vector3(part.vx, part.vy, part.vz).normalize();
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          part.mesh.quaternion.copy(quat);

          const stretch = 1.0 + speed * 0.18;
          const thickness = 1.0 / Math.sqrt(stretch);
          part.mesh.scale.set(thickness, stretch, thickness).multiplyScalar(scaleVal * 0.6);
        } else {
          part.mesh.scale.setScalar(scaleVal * 0.6);
        }
      }
    }

    for (const f of fishes) {
      const b = f.bones;

      // ── Swim state machine (Burst-and-Coast) ──────────────────
      f.stateTimer -= dt;
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

      if (f.jumpState === 'airborne') {
        // Thrashing escape leap — faster wag, fins spread wide at apex then tuck
        const t_air = f.airTime > 0 ? Math.min(1.0, f.airT / f.airTime) : 0;
        const apexBulge = Math.sin(t_air * Math.PI);
        targetSpeedMultiplier = 1.8;
        targetFreq = f.baseFreq * 1.6;
        targetAmp = 0.38 + apexBulge * 0.12;
        targetFinAmp = 0.08 + apexBulge * 0.55; // spread like wings at apex, tuck on entry
      } else if (f.jumpState === 'takeoff') {
        targetSpeedMultiplier = 1.8;
        targetFreq = f.baseFreq * 1.2;
        targetAmp = 0.40;
        targetFinAmp = 0.10;
      } else if (f.jumpState === 'dive') {
        targetSpeedMultiplier = 1.0;
        targetFreq = f.baseFreq * 1.0;
        targetAmp = 0.30;
        targetFinAmp = 0.30;
      } else if (f.isTurning) {
        // Slow down tail beat during turn pivot
        targetSpeedMultiplier = 0.05;
        targetFreq = f.baseFreq * 0.8; // active wag during turn
        targetAmp = 0.25;
        targetFinAmp = 0.45;
      } else if (f.swimState === 'burst') {
        targetSpeedMultiplier = 1.5;
        targetFreq = f.baseFreq * 1.5;
        targetAmp = 0.35 * 1.3;
        targetFinAmp = 0.05;
      } else {
        // Coasting / drifting
        targetSpeedMultiplier = 0.45 + Math.sin(time * 0.5 + f.bobPhase) * 0.15;
        targetFreq = f.baseFreq * targetSpeedMultiplier;
        targetAmp = 0.35 * targetSpeedMultiplier;
        targetFinAmp = 0.45;
      }

      // Pre-jump charge: ramp up speed/amp in the 1.2s before any leap
      if (f.jumpState === 'swim' && !f.isTurning) {
        const timeToJump = f.nextJump - time;
        if (timeToJump > 0 && timeToJump < 1.2) {
          const chargeRamp = 1.0 - timeToJump / 1.2;
          targetSpeedMultiplier = Math.max(targetSpeedMultiplier, 1.5 + chargeRamp * 1.0);
          targetFreq = Math.max(targetFreq, f.baseFreq * (1.4 + chargeRamp * 1.2));
          targetAmp  = Math.max(targetAmp,  0.38 + chargeRamp * 0.12);
        }
      }

      // Smoothly interpolate active state values (Frame-rate independent)
      const speedAlpha = 1.0 - Math.exp(-5.0 * dt);
      const freqAlpha = 1.0 - Math.exp(-6.0 * dt);
      const ampAlpha = 1.0 - Math.exp(-6.0 * dt);
      f.activeSpeed = THREE.MathUtils.lerp(f.activeSpeed, targetSpeedMultiplier, speedAlpha);
      f.activeFreq = THREE.MathUtils.lerp(f.activeFreq, targetFreq, freqAlpha);
      f.activeAmp = THREE.MathUtils.lerp(f.activeAmp, targetAmp, ampAlpha);
      f.activeFinAmp = THREE.MathUtils.lerp(f.activeFinAmp, targetFinAmp, ampAlpha);

      // Accumulate phase smoothly to avoid frequency change snaps
      f.phaseAccumulator += dt * f.activeFreq * 2 * Math.PI;
      const phase = f.phaseAccumulator + f.wagPhase;

      // ── River Path Properties (Curvilinear coordinates) ─────────
      const cz = riverCenter(f.x);
      const hw = riverHalfWidth(f.x);
      
      // River derivatives for tangent/normal alignment
      const dz_ds = 14 * 0.04 * Math.cos(f.x * 0.04) + 3 * 0.11 * Math.cos(f.x * 0.11);
      const len = Math.sqrt(1 + dz_ds * dz_ds);
      const tx = 1.0 / len;
      const tz = dz_ds / len;
      const nx = -tz;
      const nz = tx;

      // Curvature calculation for spine bending
      const d2z_ds2 = -14 * 0.0016 * Math.sin(f.x * 0.04) - 3 * 0.0121 * Math.sin(f.x * 0.11);
      const curvature = d2z_ds2 / Math.pow(1.0 + dz_ds * dz_ds, 1.5);
      const pathCurvatureYaw = curvature * 14.0 * f.dir;

      // 1. Normal swimming path parameters
      const v_path = f.baseSpeed * f.activeSpeed;
      const vx_swim = v_path * f.dir * tx;
      const vz_swim = v_path * f.dir * tz;
      
      const lateralPhase = time * 0.7 + f.lateralPhase;
      const L = Math.sin(lateralPhase) * (hw * 0.55);
      const dL_dt = 0.7 * Math.cos(lateralPhase) * (hw * 0.55);
      const vx_lat = dL_dt * nx;
      const vz_lat = dL_dt * nz;

      const vx_swim_total = vx_swim + vx_lat;
      const vz_swim_total = vz_swim + vz_lat;
      
      const y_target = WATER_LEVEL + f.depthVariant + Math.sin(time * 1.8 + f.bobPhase) * 0.02;

      let curlBack  = 0;
      let curlFront = 0;
      let targetRoll = 0;
      let targetPitch = 0;
      let targetTravelAngle = 0;

      // ── Physical State Updates ─────────────────────────────────
      if (f.jumpState === 'swim') {
        if (!f.isTurning) {
          // Propulsion pulses smoothly twice per tail wag cycle
          const propulse = 1.0 + 0.3 * Math.sin(2 * phase - Math.PI / 2);
          const speedMul = f.activeSpeed * propulse;
          const ds_dt = (f.baseSpeed * speedMul * f.dir) / len;
          f.x += ds_dt * dt;

          // U-turn triggers at boundaries
          if (f.x > RIVER_X_MAX - 12 && f.dir === 1) {
            f.isTurning = true;
            f.targetDir = -1;
          } else if (f.x < RIVER_X_MIN + 12 && f.dir === -1) {
            f.isTurning = true;
            f.targetDir = 1;
          }
        }

        f.y = y_target;
        
        // Fade lateral weave and sway smoothly during turns
        let weaveFactorTarget = f.isTurning ? 0.0 : 1.0;
        if (f.weaveFactor === undefined) f.weaveFactor = 1.0;
        f.weaveFactor = THREE.MathUtils.lerp(f.weaveFactor, weaveFactorTarget, 8.0 * dt);

        const L_active = L * f.weaveFactor;
        const sway = Math.sin(phase - 0.45) * f.activeAmp * 0.14 * f.dir * f.weaveFactor;
        
        f.z = cz + L_active + sway * nz;

        // Position root
        f.root.position.set(f.x + (L_active + sway) * nx, f.y, f.z);

        if (f.isTurning) {
          f.vx = 0.01 * f.dir; // minimal speed
          f.vz = 0.01 * f.dir;
          f.vy = 0;
          
          // Target yaw is the new tangent direction
          targetTravelAngle = Math.atan2(tz * f.targetDir, tx * f.targetDir);
          
          // Finish U-turn when aligned
          let yawDiff = targetTravelAngle - f.currentYaw;
          yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
          if (Math.abs(yawDiff) < 0.15) {
            f.dir = f.targetDir;
            f.isTurning = false;
          }
        } else {
          f.vx = vx_swim_total;
          f.vz = vz_swim_total;
          f.vy = 1.8 * 0.02 * Math.cos(time * 1.8 + f.bobPhase); // vertical change speed
          
          // Heading Stabilization: Align with path tangent + subtle clamped steer angle
          const pathAngle = Math.atan2(tz * f.dir, tx * f.dir);
          const steerAngle = Math.atan2(dL_dt, v_path) * 0.15; // limited steer deviation (max ~10 deg)
          targetTravelAngle = pathAngle + steerAngle;
        }

        // Check for jump trigger (only if far from endpoints, not turning, and not under/near the bridge)
        if (time >= f.nextJump && f.x > RIVER_X_MIN + 25 && f.x < RIVER_X_MAX - 25 && !f.isTurning && Math.abs(f.x) > 14.0) {
          f.jumpState = 'takeoff';
          // 28% chance of full barrel roll, otherwise partial twist
          f.jumpRoll = Math.random() < 0.28
            ? Math.PI * (1.6 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1)
            : (Math.random() - 0.5) * 2.2;

          // Higher, faster takeoff for more dramatic arc
          f.vx = v_path * f.dir * tx * 1.6;
          f.vz = v_path * f.dir * tz * 1.6;
          f.vy = 5.5 + Math.random() * 2.5;
          
          f.takeoffX = f.x + (L + sway) * nx;
          f.takeoffZ = f.z;
          f.takeoffY = f.y;
        }

        targetRoll = dL_dt * 0.08 * f.dir + Math.cos(phase - 0.45) * f.activeAmp * 0.04 * f.dir;
        targetPitch = Math.atan2(f.vy, Math.sqrt(f.vx * f.vx + f.vz * f.vz));
      }
      else if (f.jumpState === 'takeoff') {
        f.takeoffX += f.vx * dt;
        f.takeoffZ += f.vz * dt;
        f.takeoffY += f.vy * dt;
        
        f.root.position.set(f.takeoffX, f.takeoffY, f.takeoffZ);
        f.x = f.takeoffX; // sync path position

        targetTravelAngle = Math.atan2(f.vz, f.vx);
        targetPitch = Math.atan2(f.vy, Math.sqrt(f.vx * f.vx + f.vz * f.vz));
        targetRoll = 0.0;

        if (f.takeoffY >= WATER_LEVEL) {
          f.jumpState = 'airborne';
          f.airTime = 2.0 * f.vy / 11.0; // parabolic duration in air
          f.airT = 0;
          f.airX = f.takeoffX;
          f.airY = WATER_LEVEL;
          f.airZ = f.takeoffZ;
          
          triggerFullSplash(f.takeoffX, f.takeoffZ, f.vx, f.vy, f.vz, false); // Exit splash
        }
      }
      else if (f.jumpState === 'airborne') {
        // Projectile gravity motion in air
        f.vy -= 11.0 * dt;
        f.airX += f.vx * dt;
        f.airY += f.vy * dt;
        f.airZ += f.vz * dt;

        f.root.position.set(f.airX, f.airY, f.airZ);
        f.x = f.airX;

        f.airT += dt;
        const t_progress = Math.min(1.0, f.airT / f.airTime);
        
        targetTravelAngle = Math.atan2(f.vz, f.vx);
        // Pitch follows velocity vector directly
        targetPitch = Math.atan2(f.vy, Math.sqrt(f.vx * f.vx + f.vz * f.vz));
        // Signature air twist roll
        targetRoll = Math.sin(t_progress * Math.PI) * f.jumpRoll;

        // Dramatic C-arc body at apex; streamlines nose-first before water entry
        const arcFactor   = Math.sin(t_progress * Math.PI);
        const streamline  = Math.max(0.0, (t_progress - 0.72) / 0.28); // last 28% tucks
        curlFront =  arcFactor * 0.35 * (1.0 - streamline); // head pitches up at apex
        curlBack  = -arcFactor * 0.78 * (1.0 - streamline); // belly curves hard inward

        // Spawn continuous spray droplets as the fish enters/exits surface boundary
        if (f.airY < WATER_LEVEL + 0.15 && f.airY >= WATER_LEVEL) {
          spawnContinuousTrailDroplets(f.airX, WATER_LEVEL + 0.01, f.airZ, f.vx * 0.4, f.vy * 0.4, f.vz * 0.4, 2, false);
        }

        if (f.airY < WATER_LEVEL) {
          f.jumpState = 'dive';
          f.diveX = f.airX;
          f.diveY = f.airY;
          f.diveZ = f.airZ;

          triggerFullSplash(f.airX, f.airZ, f.vx, f.vy, f.vz, true); // Entry splash
        }
      }
      else if (f.jumpState === 'dive') {
        // Underwater recovery - apply water resistance drag and spring depth recovery
        f.vx = THREE.MathUtils.lerp(f.vx, vx_swim_total, 5.5 * dt);
        f.vz = THREE.MathUtils.lerp(f.vz, vz_swim_total, 5.5 * dt);

        const springForceY = (y_target - f.diveY) * 16.0 - f.vy * 4.0;
        f.vy += springForceY * dt;

        f.diveX += f.vx * dt;
        f.diveY += f.vy * dt;
        f.diveZ += f.vz * dt;

        f.root.position.set(f.diveX, f.diveY, f.diveZ);
        f.x = f.diveX;

        targetTravelAngle = Math.atan2(f.vz, f.vx);
        targetPitch = Math.atan2(f.vy, Math.sqrt(f.vx * f.vx + f.vz * f.vz));
        targetRoll = 0.0;

        // Continuous bubble droplets trail during high-velocity dive entry
        if (f.diveY > WATER_LEVEL - 0.20 && f.diveY < WATER_LEVEL) {
          spawnContinuousTrailDroplets(f.diveX, WATER_LEVEL + 0.01, f.diveZ, f.vx * 0.35, f.vy * 0.35, f.vz * 0.35, 1, true);
        }

        if (Math.abs(f.diveY - y_target) < 0.035 && Math.abs(f.vy) < 0.35) {
          f.jumpState = 'swim';
          f.nextJump = time + 7.0 + Math.random() * 11.0;
        }
      }

      // ── Root Heading (Yaw) Alignment (Frame-rate independent) ────
      if (f.currentYaw === undefined) f.currentYaw = targetTravelAngle;
      let yawDiff = targetTravelAngle - f.currentYaw;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
      
      const yawDecaySpeed = f.jumpState === 'swim' ? (f.isTurning ? 2.5 : 10.0) : 25.0;
      f.currentYaw += yawDiff * (1.0 - Math.exp(-yawDecaySpeed * dt));
      
      const extraYaw = f.forwardAxis === 'z' ? Math.PI / 2 : 0;
      
      f.root.rotation.order = 'YXZ';
      f.root.rotation.y = f.currentYaw + extraYaw;

      // ── Smooth Pitch and Roll Interpolation (Frame-rate independent) ──
      if (f.currentPitch === undefined) f.currentPitch = 0;
      if (f.currentRoll === undefined) f.currentRoll = 0;
      
      const pitchRollDecay = f.jumpState === 'swim' ? 11.0 : 20.0;
      const prAlpha = 1.0 - Math.exp(-pitchRollDecay * dt);
      f.currentPitch = THREE.MathUtils.lerp(f.currentPitch, targetPitch, prAlpha);
      f.currentRoll = THREE.MathUtils.lerp(f.currentRoll, targetRoll, prAlpha);

      if (f.forwardAxis === 'x') {
        f.root.rotation.z = f.currentPitch;
        f.root.rotation.x = f.currentRoll;
      } else {
        f.root.rotation.x = f.currentPitch;
        f.root.rotation.z = f.currentRoll;
      }

      // ── Bone rotations (Wave propagation Head -> Tail) ─────────
      const isAir = f.jumpState === 'airborne';
      
      // Bone wave amplitudes: tail dominates, head barely moves
      const frontWagAmp = f.activeAmp * (isAir ? 0.18 : 0.11);
      const backWagAmp  = f.activeAmp * (isAir ? 0.58 : 0.52);
      const tailWagAmp  = f.activeAmp * (isAir ? 1.08 : 1.08);

      // Curvature-induced bend is applied only when swimming (disabled in air/turn to avoid pinching)
      const finalCurvatureYaw = (f.jumpState === 'swim' && !f.isTurning) ? pathCurvatureYaw : 0.0;

      // U-turn bend
      const turnBend = f.isTurning ? Math.max(-0.5, Math.min(0.5, yawDiff)) * 1.0 : 0.0;

      // Airborne lateral C-curve (yaw bend) — capped regardless of barrel roll magnitude
      let airYawBend = 0.0;
      if (f.jumpState === 'airborne') {
        const t_progress = Math.min(1.0, f.airT / f.airTime);
        const normalizedRoll = Math.max(-1, Math.min(1, f.jumpRoll / Math.PI));
        airYawBend = Math.sin(t_progress * Math.PI) * 0.38 * normalizedRoll;
      }

      // Traveling wave: each segment lags the previous by 60° — creates visible wave running nose→tail
      const WAVE_LAG = Math.PI / 3;
      const sinPhase = Math.sin(phase); // kept for fin rowing (front-node phase)
      const wagFront = sinPhase * frontWagAmp;
      const wagBack  = Math.sin(phase - WAVE_LAG) * backWagAmp;
      const wagTail  = Math.sin(phase - 2 * WAVE_LAG) * tailWagAmp;

      if (b.spineFront) {
        const r = b.rest.spineFront;
        b.spineFront.rotation.set(
          r.x + curlFront,
          r.y,
          r.z + wagFront + finalCurvatureYaw * 0.8 + turnBend * 0.8 + airYawBend * 0.8
        );
      }
      if (b.spineBack) {
        const r = b.rest.spineBack;
        b.spineBack.rotation.set(
          r.x + curlBack,
          r.y,
          r.z + wagBack + finalCurvatureYaw * 0.5 + turnBend * 0.6 + airYawBend * 0.6
        );
      }
      if (b.tail) {
        const r = b.rest.tail;
        b.tail.rotation.set(
          r.x,
          r.y,
          r.z + wagTail + turnBend * 0.4 + airYawBend * 0.4
        );
      }
      if (b.root) {
        // Very subtle reactive counter-wag on head (opposite to spineFront — feels alive)
        const r = b.rest.root;
        b.root.rotation.set(r.x, r.y, r.z - wagFront * 0.09);
      }

      // ── Pectoral fin idle paddle & steer ───────────────────────
      const finAmp = f.activeFinAmp;
      if (b.finL) {
        const r = b.rest.finL;
        const steerTuck = Math.max(0, -dL_dt * f.dir) * 0.4;
        
        // Coordinated 2D rowing motion in phase with the tail wag
        const rx = r.x + sinPhase * 0.33 * finAmp;
        const ry = r.y - sinPhase * 0.20 * finAmp + steerTuck;
        const rz = r.z + sinPhase * 0.10 * finAmp;
        b.finL.rotation.set(rx, ry, rz);
      }
      if (b.finR) {
        const r = b.rest.finR;
        const steerTuck = Math.max(0, dL_dt * f.dir) * 0.4;
        
        // Coordinated 2D rowing motion in phase with the tail wag
        const rx = r.x - sinPhase * 0.33 * finAmp;
        const ry = r.y + sinPhase * 0.40 * finAmp + steerTuck;
        const rz = r.z - sinPhase * 0.17 * finAmp;
        b.finR.rotation.set(rx, ry, rz);
      }
    }
  };

  return group;
}
