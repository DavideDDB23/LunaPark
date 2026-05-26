import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB } from '../utils/loaders.js';

const HUMANS_DIR = 'assets/models/Humans/';

export let passengerWorldHeight = 3.28; // Default fallback height in world units

export function setPassengerWorldHeight(h) {
  passengerWorldHeight = h;
}

export function getPassengerWorldHeight() {
  return passengerWorldHeight;
}


// Park-visitor models (Quaternius) — civilian outfits only, no soldiers/zombies/etc.
export const VISITOR_MODELS = [
  'Casual_Male', 'Casual_Female', 'Casual2_Male', 'Casual2_Female',
  'Casual3_Male', 'Casual3_Female', 'Casual_Bald', 'Suit_Male', 'Suit_Female',
  'Kimono_Male', 'Kimono_Female', 'Worker_Male', 'Worker_Female',
  'OldClassy_Male', 'OldClassy_Female',
];

const ANIM_BONES = [
  'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'Head', 'Torso',
  'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR',
];

export const ACTIONS_SEATED_GENERAL = ['rest', 'rest', 'lookL', 'lookR', 'lookUp', 'wave', 'point', 'photo', 'cheer', 'relax'];
export const ACTIONS_SEATED_CHAT_L = ['chatL', 'chatL', 'rest', 'lookR'];   // neighbour sits to this rider's left
export const ACTIONS_SEATED_CHAT_R = ['chatR', 'chatR', 'rest', 'lookL'];
export const ACTIONS_STANDING = ['standRest', 'standRest', 'standWave', 'standCheer', 'standPoint', 'standLook'];

const smoothstep = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Load a handful of random visitor models as reusable templates.
export async function loadVisitorTemplates(count) {
  const picks = shuffle(VISITOR_MODELS).slice(0, count);
  const results = await Promise.allSettled(
    picks.map((name) => loadGLB(`${HUMANS_DIR}${name}.gltf`))
  );
  const templates = [];
  results.forEach((r, idx) => {
    if (r.status !== 'fulfilled') return;
    const root = r.value.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false; // SkinnedMesh bind-pose bbox ignores deformation
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mat) => {
            if (mat.name === 'Skin') {
              mat.color.setRGB(1.0, 0.88, 0.82); // Light Caucasian skin tone
              mat.roughness = 0.6;
              mat.metalness = 0.0;
            }
          });
        }
      }
    });
    const h = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y || 3.3;
    templates.push({ root, height: h, name: picks[idx] });
  });
  return templates;
}

export function collectBones(fig) {
  const map = {};
  const foundBones = [];
  const allBonesInRig = [];
  
  fig.traverse((o) => {
    if (o.isBone) allBonesInRig.push(o.name);
  });
  
  for (const n of ANIM_BONES) {
    let b = fig.getObjectByName(n);
    if (!b) {
      const dottedName = n.replace(/([LR])$/, '.$1');
      b = fig.getObjectByName(dottedName);
    }
    if (b) {
      map[n] = { bone: b, rest: b.rotation.clone() };
      foundBones.push(n);
    }
  }
  
  fetch('/log', { method: 'POST', body: `collectBones: Figure ${fig.name || 'unnamed'} has bones in rig: [${allBonesInRig.join(', ')}], collected map keys: [${foundBones.join(', ')}]` }).catch(() => {});
  
  return map;
}

// Set a bone to rest-pose + delta Euler (so it works regardless of the bind rotation).
export function pose(bones, name, dx = 0, dy = 0, dz = 0) {
  const e = bones[name];
  if (e) e.bone.rotation.set(e.rest.x + dx, e.rest.y + dy, e.rest.z + dz);
}

// Seated leg pose — calibrated to wrap the rider's legs beautifully around the horse mesh
// Seated leg pose — applied every frame (legs never gesture).
export function applySeatedLegs(B, scale = 1.0) {
  // Flexion/extension: thigh forward/downward (negative rotation in Quaternius rig)
  const ulx = -0.55;
  // Twist: inward rotation to contour flanks
  const uly = 0.15 * scale;
  // Abduction: wider splay for smaller riders to clear constant horse width
  const ulz = 1.15 - 0.20 * scale;
  // Knee flexion: bend shins back (positive rotation in Quaternius rig)
  const llx = 0.95;
  // Knee twist: none
  const lly = 0;
  // Shin wrap: wrap shins inward to hug underbelly
  const llz = 0.35 - 0.15 * scale;

  // ── LEFT LEG (Standard Armature Space) ──
  pose(B, 'UpperLegL', ulx,  uly, -ulz);
  pose(B, 'LowerLegL', llx,  lly,  llz);

  // ── RIGHT LEG (Symmetrically Mirrored) ──
  pose(B, 'UpperLegR', ulx, -uly,  ulz);
  pose(B, 'LowerLegR', llx, -lly, -llz);
}

const UPPER_BONES = ['UpperArmR', 'UpperArmL', 'LowerArmR', 'LowerArmL', 'Head', 'Torso'];

const REST_UPPER = {
  UpperArmR: [0.55, 0, 0.10], UpperArmL: [0.55, 0, -0.10],
  LowerArmR: [0.45, 0, 0], LowerArmL: [0.45, 0, 0],
  Head: [0, 0, 0], Torso: [0, 0, 0],
};

const POSE_DEFS = {
  rest:   {},
  lookL:  { Head: [0.05, 0.6, 0], Torso: [0, 0.18, 0] },
  lookR:  { Head: [0.05, -0.6, 0], Torso: [0, -0.18, 0] },
  lookUp: { Head: [-0.45, 0.1, 0], Torso: [-0.08, 0, 0] },
  wave:   { UpperArmR: [0.2, 1.9, -0.2], LowerArmR: [1.1, 0, 0], Head: [0, 0.2, 0] },
  cheer:  { UpperArmR: [0.2, 2.2, -0.2], UpperArmL: [-0.2, -2.2, 0.2], LowerArmR: [0.8, 0, 0], LowerArmL: [0.8, 0, 0], Head: [-0.06, 0, 0] },
  point:  { UpperArmR: [0.1, 1.45, 0], Head: [0, 0.32, 0], Torso: [0, 0.1, 0] },
  photo:  { UpperArmR: [1.0, 0.4, 0.25], UpperArmL: [1.0, -0.4, -0.25],
            LowerArmR: [0.8, 0, 0], LowerArmL: [0.8, 0, 0], Head: [-0.12, 0, 0] },
  relax:  { UpperArmR: [0.15, 1.05, 0], Head: [0.06, -0.2, 0], Torso: [0.05, -0.05, 0] },
  chatL:  { UpperArmR: [0.4, 0.8, 0], LowerArmR: [0.8, 0, 0], Head: [0.1, 0.5, 0], Torso: [0.1, 0.14, 0] },
  chatR:  { UpperArmL: [-0.4, -0.8, 0], LowerArmL: [0.8, 0, 0], Head: [0.1, -0.5, 0], Torso: [0.1, -0.14, 0] },

  // Standing poses
  standRest: {
    Torso: [0.15, 0, 0], Head: [0.05, 0, 0],
    UpperArmR: [0.4, 0.2, 0], UpperArmL: [0.4, -0.2, 0],
    LowerArmR: [0.5, 0, 0], LowerArmL: [0.5, 0, 0]
  },
  standWave: {
    Torso: [0.10, 0, 0], Head: [0, 0.2, 0],
    UpperArmR: [0.2, 1.9, -0.2], LowerArmR: [1.1, 0, 0],
    UpperArmL: [0.4, -0.2, 0], LowerArmL: [0.5, 0, 0]
  },
  standCheer: {
    Torso: [0.05, 0, 0], Head: [-0.06, 0, 0],
    UpperArmR: [0.2, 2.2, -0.2], UpperArmL: [-0.2, -2.2, 0.2],
    LowerArmR: [0.8, 0, 0], LowerArmL: [0.8, 0, 0]
  },
  standPoint: {
    Torso: [0.12, 0.1, 0], Head: [0, 0.32, 0],
    UpperArmR: [0.1, 1.45, 0],
    UpperArmL: [0.4, -0.2, 0], LowerArmL: [0.5, 0, 0]
  },
  standLook: {
    Torso: [0.28, 0, 0], Head: [0.25, 0.4, 0],
    UpperArmR: [0.5, 0.15, 0], UpperArmL: [0.5, -0.15, 0],
    LowerArmR: [0.6, 0, 0], LowerArmL: [0.6, 0, 0]
  }
};

const POSES = {};
for (const k in POSE_DEFS) {
  POSES[k] = { ...REST_UPPER };
  for (const b in POSE_DEFS[k]) POSES[k][b] = POSE_DEFS[k][b];
}

// One rider with a pose state-machine: it holds an action, then eases to the next.
export function makeRider(template, height, { pool, facingY = 0, phase = 0, standing = false }) {
  const pivot = new THREE.Group();             // gentle body sway lives here
  const fig = cloneSkinned(template.root);
  const scale = height / template.height;
  fig.scale.setScalar(scale);
  fig.rotation.y = facingY;
  pivot.add(fig);
  return {
    pivot, fig, bones: collectBones(fig), pool, phase, standing, scale,
    from: pool.includes('rest') || pool.includes('standRest') ? (pool.includes('standRest') ? 'standRest' : 'rest') : pool[0],
    to: pick(pool), tStart: 0, transDur: 0.7,
    nextSwitch: phase * 0.7 + Math.random() * 3, // stagger first switch
    restZ: pivot.rotation.z,
  };
}

// Advance the rider's state-machine and pose its bones for absolute time t.
export function updateRider(r, t) {
  if (t >= r.nextSwitch) {
    r.from = r.to;
    r.to = pick(r.pool);
    r.tStart = t;
    r.nextSwitch = t + r.transDur + 2.5 + Math.random() * 4; // hold 2.5–6.5 s
  }
  const k = smoothstep(Math.min((t - r.tStart) / r.transDur, 1)); // eased blend
  const B = r.bones;

  if (r.standing) {
    // Standing legs (straight)
    pose(B, 'UpperLegL', 0, 0, 0);
    pose(B, 'UpperLegR', 0, 0, 0);
    pose(B, 'LowerLegL', 0, 0, 0);
    pose(B, 'LowerLegR', 0, 0, 0);
  } else {
    // Seated legs
    applySeatedLegs(B, r.scale);
  }

  const A = POSES[r.from], C = POSES[r.to];
  for (const bn of UPPER_BONES) {
    const a = A[bn], c = C[bn];
    let dx = lerp(a[0], c[0], k), dy = lerp(a[1], c[1], k), dz = lerp(a[2], c[2], k);
    if (bn === 'Torso') dx += Math.sin(t * 1.1 + r.phase) * 0.02;  // breathing
    if (bn === 'Head') dy += Math.sin(t * 0.5 + r.phase) * 0.04;   // idle micro-glance
    pose(B, bn, dx, dy, dz);
  }

  // Live flair on the active action (eased in by k so it doesn't pop on transition).
  if (r.to === 'wave' || r.to === 'standWave') {
    pose(B, 'UpperArmR', 0.2 + Math.sin(t * 3) * 0.05 * k, 1.9 + Math.sin(t * 3) * 0.05 * k, -0.2);
    pose(B, 'LowerArmR', 1.1, Math.sin(t * 10) * 0.35 * k, Math.sin(t * 10) * 0.35 * k);
    pose(B, 'Head', 0, 0.2 + Math.sin(t * 2) * 0.08 * k, 0);
  } else if (r.to === 'cheer' || r.to === 'standCheer') {
    const pump = Math.sin(t * 8) * 0.2 * k;
    pose(B, 'UpperArmR', 0.2 + pump, 2.2 + pump * 0.5, -0.2);
    pose(B, 'UpperArmL', -0.2 - pump, -2.2 - pump * 0.5, 0.2);
    pose(B, 'LowerArmR', 0.8 + pump, 0, 0);
    pose(B, 'LowerArmL', 0.8 + pump, 0, 0);
    pose(B, 'Torso', 0.05 + Math.sin(t * 8) * 0.04 * k, 0, 0);
  } else if (r.to === 'chatL') {
    pose(B, 'UpperArmR', 0.4 + Math.sin(t * 2.0) * 0.1 * k, 0.8 + Math.sin(t * 2.0) * 0.1 * k, 0);
    pose(B, 'LowerArmR', 0.8 + Math.sin(t * 4.0) * 0.3 * k, 0, 0);
    pose(B, 'Head', 0.1, 0.5 + Math.sin(t * 2.0) * 0.1 * k, Math.sin(t * 3.0) * 0.05 * k);
    pose(B, 'Torso', 0.1 + Math.sin(t * 1.0) * 0.03 * k, 0.14, 0);
  } else if (r.to === 'chatR') {
    pose(B, 'UpperArmL', -0.4 - Math.sin(t * 2.0) * 0.1 * k, -0.8 - Math.sin(t * 2.0) * 0.1 * k, 0);
    pose(B, 'LowerArmL', 0.8 + Math.sin(t * 4.0) * 0.3 * k, 0, 0);
    pose(B, 'Head', 0.1, -0.5 - Math.sin(t * 2.0) * 0.1 * k, Math.sin(t * 3.0) * 0.05 * k);
    pose(B, 'Torso', 0.1 + Math.sin(t * 1.0) * 0.03 * k, -0.14, 0);
  } else if (r.to === 'standLook') {
    pose(B, 'Head', 0.25, 0.4 + Math.sin(t * 1.5) * 0.3 * k, 0);
    pose(B, 'Torso', 0.28 + Math.sin(t * 1.0) * 0.04 * k, 0, 0);
  } else if (r.to === 'standRest') {
    pose(B, 'Head', 0.05 + Math.sin(t * 0.8) * 0.05 * k, Math.sin(t * 0.4) * 0.1 * k, 0);
  } else if (r.to === 'standPoint') {
    pose(B, 'UpperArmR', 0.1, 1.5 + Math.sin(t * 2.5) * 0.04 * k, -0.1);
    pose(B, 'LowerArmR', 0.2, 0, 0);
    pose(B, 'UpperArmL', 0.3, -0.3, 0);
    pose(B, 'LowerArmL', 0.6, 0, 0);
    pose(B, 'Head', 0.1, 0.35 + Math.sin(t * 2.5) * 0.05 * k, 0);
  }
}
