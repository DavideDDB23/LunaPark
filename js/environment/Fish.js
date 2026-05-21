// Fish animation is entirely procedural — the imported GLB's keyframe animation
// is intentionally NOT used. All swimming, body wiggle, jumping arc, pitch and roll
// are computed here per-frame.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB } from '../utils/loaders.js';
import { riverCenter, riverHalfWidth, RIVER_X_MIN, RIVER_X_MAX } from '../utils/river.js';

const WATER_LEVEL = 0.25;
const FISH_URL = 'assets/models/clown_fish_low_poly_animated.glb';
const FISH_COUNT = 8;
const TARGET_FISH_LENGTH = 1.0;

async function loadFishTemplate() {
  const gltf = await loadGLB(FISH_URL);
  const source = gltf.scene;

  // Give the clown-fish a visible orange-white striped look since the GLB ships with a
  // plain white material (no texture). Add a small emissive tint so they read in shadow.
  source.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      if (o.material) {
        o.material.side = THREE.DoubleSide;
        // Boost contrast: orange diffuse + slight emissive so fish are clearly visible
        // even when partly under the water surface.
        if (o.material.color && o.material.color.getHex() === 0xffffff) {
          o.material.color.setHex(0xff6a1a);
        }
        if ('emissive' in o.material) {
          o.material.emissive = new THREE.Color(0xff3300);
          o.material.emissiveIntensity = 0.35;
        }
        o.material.toneMapped = true;
      }
      o.frustumCulled = false; // Disable culling for skinned meshes moved by root groups
    }
  });

  const bbox = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  const scale = longest > 0 ? TARGET_FISH_LENGTH / longest : 1;
  // Forward axis = longest horizontal extent.
  const forwardAxis = size.x >= size.z ? 'x' : 'z';

  return { source, scale, forwardAxis };
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
    // Clone the static mesh — no animation mixer, no clipAction.
    const inst = cloneSkinned(tmpl.source);
    inst.scale.setScalar(tmpl.scale);

    // Three nested groups give us independent control:
    //  root   — world-space position + yaw (heading)
    //   wag   — per-frame body yaw (wiggle), so it doesn't fight with heading
    //    inst — the static GLB mesh
    const wag = new THREE.Group();
    wag.add(inst);

    const root = new THREE.Group();
    root.add(wag);
    group.add(root);

    const seedX = THREE.MathUtils.lerp(RIVER_X_MIN + 10, RIVER_X_MAX - 10, (i + 0.5) / FISH_COUNT);

    fishes.push({
      root,
      wag,
      inst,
      forwardAxis: tmpl.forwardAxis,
      x: seedX,
      speed: 1.5 + Math.random() * 1.5,
      dir: Math.random() < 0.5 ? -1 : 1,
      lateralPhase: Math.random() * Math.PI * 2,
      bobPhase: Math.random() * Math.PI * 2,
      wagPhase: Math.random() * Math.PI * 2,
      nextJump: 1.5 + Math.random() * 4,
      jumpT: -1,
      jumpDur: 1.2 + Math.random() * 0.4, // Smoother timing
      jumpRoll: 0,
      jumpHeight: 0.2 + Math.random() * 0.2, // Small jumps for small fish
      depthVariant: -0.10 - Math.random() * 0.05, // 0.10 to 0.15 absolute Y
    });
  }

  group.userData.tick = (delta, time, _windSpeed) => {
    for (const f of fishes) {
      const speedMul = f.jumpT >= 0 ? 1.4 : 1.0;
      f.x += f.speed * speedMul * f.dir * delta;
      if (f.x > RIVER_X_MAX - 8) { f.dir = -1; f.x = RIVER_X_MAX - 8; }
      if (f.x < RIVER_X_MIN + 8) { f.dir =  1; f.x = RIVER_X_MIN + 8; }

      const cz = riverCenter(f.x);
      const hw = riverHalfWidth(f.x);
      
      // Smooth lateral movement using pure sine
      const lateral = Math.sin(time * 0.7 + f.lateralPhase) * (hw * 0.55);
      const z = cz + lateral;

      // ── Underwater swim ──────────────────────────────────────
      // Perfect analytical derivative for smooth banking, independent of delta
      const lateralVel = Math.cos(time * 0.7 + f.lateralPhase) * (hw * 0.55) * 0.7;

      const baseDepth = f.depthVariant;
      const bob = Math.sin(time * 1.8 + f.bobPhase) * 0.02;
      let y = WATER_LEVEL + baseDepth + bob;
      
      // Base swim pitch gently follows the bob
      let pitch = Math.cos(time * 1.8 + f.bobPhase) * 0.05;
      
      // Roll smoothly into turns
      let roll = lateralVel * 0.3 * f.dir;

      // ── Jump trigger / arc ───────────────────────────────────
      if (f.jumpT < 0 && time >= f.nextJump) {
        f.jumpT = 0;
        f.jumpRoll = (Math.random() - 0.5) * 0.8;
      }
      
      if (f.jumpT >= 0) {
        f.jumpT += delta / f.jumpDur;
        if (f.jumpT >= 1) {
          f.jumpT = -1;
          f.nextJump = time + 4 + Math.random() * 8;
        } else {
          const t = f.jumpT;
          
          // Pure sine wave for the jump arc is perfectly smooth over 0..1
          const arc = Math.sin(t * Math.PI);
          y = THREE.MathUtils.lerp(WATER_LEVEL + baseDepth, WATER_LEVEL + f.jumpHeight, arc);
          
          // Pitch perfectly matches the derivative of the sine arc (cosine)
          pitch = Math.cos(t * Math.PI) * 0.8;
            
          // Blend in mid-air flip seamlessly
          roll = arc * f.jumpRoll;
        }
      }

      f.root.position.set(f.x, y, z);

      // ── Heading yaw (where the fish faces) + GLB orientation offset ──
      const baseYaw = f.dir > 0 ? 0 : Math.PI;
      const extraYaw = f.forwardAxis === 'z' ? Math.PI / 2 : 0;
      f.root.rotation.set(0, baseYaw + extraYaw, 0);

      // Pitch axis depends on which local axis is "forward" for this GLB.
      const signedPitch = f.dir > 0 ? pitch : -pitch;
      if (f.forwardAxis === 'x') {
        f.root.rotation.z = signedPitch;
        f.root.rotation.x = roll;
      } else {
        f.root.rotation.x = signedPitch;
        f.root.rotation.z = roll;
      }

      // ── Procedural body wiggle (tail wag) ────────────────────
      // Faster wiggle while jumping (escape thrash); slow lazy wiggle when cruising.
      const wagFreq  = (f.jumpT >= 0 ? 14.0 : 6.0);
      const wagAmp   = (f.jumpT >= 0 ? 0.45 : 0.22);
      const wiggle = Math.sin(time * wagFreq + f.wagPhase) * wagAmp;
      // Apply around the GLB's vertical axis so body S-curves; axis depends on forward.
      if (f.forwardAxis === 'x') {
        f.wag.rotation.set(0, wiggle, 0);
      } else {
        f.wag.rotation.set(0, wiggle, 0);
      }
    }
  };

  return group;
}
