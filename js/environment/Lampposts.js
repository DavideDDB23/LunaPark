import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';

const LAMP_URL = 'assets/models/low_poly_garden_lamp__stylized_outdoor_light.glb';
export const LAMPPOST_LAYER = 1;

const POSITIONS = [
  ['lamp_0', -5, -25],
  ['lamp_1', -5, -50],
  ['lamp_2', -5, -75],
  ['lamp_3',  5, -25],
  ['lamp_4',  5, -50],
  ['lamp_5',  5, -75],
  ['lamp_6', -5,  25],
  ['lamp_7', -5,  50],
  ['lamp_8', -5,  75],
  ['lamp_9',  5,  25],
  ['lamp_10', 5,  50],
  ['lamp_11', 5,  75]
];

export async function buildLampposts() {
  const group = new THREE.Group();
  group.name = 'lampposts';

  const gltf = await loadGLB(LAMP_URL);
  const source = gltf.scene;
  sanitizeMaterials(source);

  const bbox = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const targetHeight = 6.0;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const groundOffset = -bbox.min.y * scale;
  const lampHeadY = bbox.max.y * scale * 0.9;

  // Collect all meshes from the source model — we will bucket them by material
  // so each material can become one InstancedMesh (one draw call per material).
  const sourceMeshes = [];
  source.traverse((o) => {
    if (o.isMesh) {
      sourceMeshes.push({ geometry: o.geometry, material: o.material });
    }
  });

  // De-duplicate materials to know how many InstancedMeshes we need.
  const uniqueMaterials = [];
  const meshToBucket = new Map();
  for (const m of sourceMeshes) {
    if (!meshToBucket.has(m.material)) {
      meshToBucket.set(m.material, uniqueMaterials.length);
      // Clone material so each InstancedMesh can be independently controlled
      // (emissive intensity at night, etc.). The clone is shared by all 12
      // instances of the same bucket, so we get per-material global control
      // rather than per-lamp — visually identical, much cheaper.
      uniqueMaterials.push(m.material.clone());
    }
  }

  const count = POSITIONS.length;
  const _tmpMat = new THREE.Matrix4();
  const _tmpPos = new THREE.Vector3();
  const _tmpQuat = new THREE.Quaternion();
  const _tmpScale = new THREE.Vector3(scale, scale, scale);

  // Build one InstancedMesh per unique material.
  const instancedMeshes = [];
  for (let bucketIdx = 0; bucketIdx < uniqueMaterials.length; bucketIdx++) {
    const mat = uniqueMaterials[bucketIdx];
    // Pick a representative geometry for this bucket (the first mesh that uses it).
    const repMesh = sourceMeshes.find(m => meshToBucket.get(m.material) === bucketIdx);
    const instanced = new THREE.InstancedMesh(repMesh.geometry, mat, count);
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    instanced.layers.enable(LAMPPOST_LAYER);
    instanced.name = `lamppost_instances_${bucketIdx}`;
    group.add(instanced);
    instancedMeshes.push({ mesh: instanced, material: mat });
  }

  // Set up lamp roots: each is a Group with lampId userData + a PointLight +
  // an invisible "click hitbox" mesh so raycasts still work.
  for (let i = 0; i < count; i++) {
    const [id, x, z] = POSITIONS[i];

    const lampRoot = new THREE.Group();
    lampRoot.name = id;
    lampRoot.position.set(x, groundOffset, z);
    lampRoot.userData.lampId = id;
    lampRoot.userData.on = false;
    lampRoot.userData.isManual = false;
    lampRoot.userData.targetOn = false;
    lampRoot.userData.nightFactor = 0.0;
    lampRoot.userData.instanceIndex = i;
    lampRoot.userData.blinkTime = 0.0;
    group.add(lampRoot);

    // Fill the instance matrices for every bucket. Each instance sits at the
    // lampRoot's world position (the InstancedMesh is a child of `group`, not
    // of lampRoot, so we bake the position into the matrix).
    for (let bucketIdx = 0; bucketIdx < instancedMeshes.length; bucketIdx++) {
      _tmpPos.set(x, groundOffset, z);
      _tmpMat.compose(_tmpPos, _tmpQuat, _tmpScale);
      instancedMeshes[bucketIdx].mesh.setMatrixAt(i, _tmpMat);
    }

    // Invisible click hitbox — a tall slim box roughly matching the lamppost
    // footprint. Raycasting against this is cheap (12 small boxes).
    const hitboxGeo = new THREE.BoxGeometry(1.2, targetHeight, 1.2);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.position.set(0, targetHeight / 2, 0);
    hitbox.userData.lampRef = lampRoot;
    hitbox.layers.enable(LAMPPOST_LAYER);
    lampRoot.add(hitbox);

    // High-performance PointLight shining in all directions
    const pointLight = new THREE.PointLight(0xfffaf0, 0, 90, 1.2);
    pointLight.position.set(0, lampHeadY, 0);
    pointLight.name = `${id}_light`;
    pointLight.castShadow = false;
    pointLight.userData.lockColor = true;
    pointLight.layers.enable(LAMPPOST_LAYER);
    lampRoot.add(pointLight);

    lampRoot.userData.pointLight = pointLight;
  }

  // Mark instance matrices as needing an upload (one-time).
  for (const im of instancedMeshes) {
    im.mesh.instanceMatrix.needsUpdate = true;
  }

  // Listen for time phase changes to drive automated lighting
  let lastGlobalIsNight = null;
  eventBus.on('time-phase-change', (data) => {
    const isNight = data.isNight;
    const nightFactor = data.nightFactor;

    const phaseTransitioned = (lastGlobalIsNight !== null && lastGlobalIsNight !== isNight);
    lastGlobalIsNight = isNight;

    for (const lampRoot of group.children) {
      if (!lampRoot.userData.isManual) {
        lampRoot.userData.targetOn = isNight;
      }
      lampRoot.userData.nightFactor = nightFactor;
    }
  });

  // Smooth transition (0.8s) -> Rate = 120.0 / 0.8 = 150.0 units per second.
  // Emissive materials are shared across all instances of a bucket, so we
  // update the bucket material rather than per-lamp meshes.
  group.userData.tick = (delta, time) => {
    for (const lampRoot of group.children) {
      const pl = lampRoot.userData.pointLight;
      if (!pl) continue;

      if (lampRoot.userData.blinkTime > 0) {
        lampRoot.userData.blinkTime -= delta;
        const step = Math.floor(lampRoot.userData.blinkTime / 0.10);
        // During blink, alternate between Auto's target state and its opposite
        const isNight = lampRoot.userData.targetOn; // targetOn is set to current isNight when resetting
        const isBlinkOn = (step % 2 === 0) ? isNight : !isNight;
        pl.intensity = isBlinkOn ? 120.0 : 0.0;
        continue;
      }

      let targetIntensity = 0;
      if (lampRoot.userData.targetOn) {
        if (lampRoot.userData.isManual) {
          targetIntensity = 120.0;
        } else {
          const nf = lampRoot.userData.nightFactor !== undefined ? lampRoot.userData.nightFactor : 1.0;
          targetIntensity = nf * 120.0;
        }
      }

      const rate = 150.0 * delta;
      const diff = targetIntensity - pl.intensity;
      if (Math.abs(diff) > 0.01) {
        pl.intensity += Math.sign(diff) * Math.min(rate, Math.abs(diff));
      } else {
        pl.intensity = targetIntensity;
      }
    }

    // Drive emissive intensity on the shared instanced materials from the
    // AVERAGE lamp intensity. (Sampling only lamp_0 meant manually switching
    // that one lamp off at night blacked out the bulb glow of all 12 heads
    // while their point lights stayed on.)
    let sum = 0, n = 0;
    for (const lampRoot of group.children) {
      const pl = lampRoot.userData.pointLight;
      if (pl) { sum += pl.intensity; n++; }
    }
    if (!n) return;
    const emissiveStrength = (sum / n / 120.0) * 8.0;
    for (const im of instancedMeshes) {
      const mat = im.material;
      if (mat.emissive) {
        mat.emissiveIntensity = emissiveStrength;
        mat.emissive.setHex(0xfffaf0);
      }
    }
  };

  group.userData.instancedMeshes = instancedMeshes;
  return group;
}
