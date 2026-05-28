import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';

const LAMP_URL = 'assets/models/low_poly_garden_lamp__stylized_outdoor_light.glb';
export const LAMPPOST_LAYER = 1;

const POSITIONS = [
  // North Arm
  ['lamp_0', -5, -25],
  ['lamp_1', -5, -50],
  ['lamp_2', -5, -75],
  ['lamp_3',  5, -25],
  ['lamp_4',  5, -50],
  ['lamp_5',  5, -75],

  // South Arm
  ['lamp_6', -5,  25],
  ['lamp_7', -5,  50],
  ['lamp_8', -5,  75],
  ['lamp_9',  5,  25],
  ['lamp_10', 5,  50],
  ['lamp_11', 5,  75]
];

function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false; // Disable to prevent blocking its own light
      o.receiveShadow = true;
      o.layers.enable(LAMPPOST_LAYER);
    }
  });
}

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

  for (const [id, x, z] of POSITIONS) {
    const lampRoot = new THREE.Group();
    lampRoot.name = id;
    lampRoot.position.set(x, groundOffset, z);
    lampRoot.userData.lampId = id;
    lampRoot.userData.on = false;
    lampRoot.userData.isManual = false;
    lampRoot.userData.targetOn = false;
    lampRoot.userData.nightFactor = 0.0;

    const lampMesh = source.clone(true);
    lampMesh.scale.setScalar(scale);
    enableShadows(lampMesh);
    lampMesh.traverse((o) => {
      if (o.isMesh) {
        o.userData.lampRef = lampRoot;
        if (o.material) {
          o.material = o.material.clone(); // unique material for individual emissive/color control
        }
      }
    });
    lampRoot.add(lampMesh);

    // High-performance PointLight shining in all directions
    const pointLight = new THREE.PointLight(0xfffaf0, 0, 70, 1.2);
    pointLight.position.set(0, lampHeadY, 0);
    pointLight.name = `${id}_light`;
    pointLight.castShadow = false; // Disable shadows to avoid self-blocking and save WebGL shadow map slots
    pointLight.userData.lockColor = true;
    lampRoot.add(pointLight);

    lampRoot.userData.pointLight = pointLight;
    group.add(lampRoot);
  }

  // Listen for time phase changes to drive automated lighting
  eventBus.on('time-phase-change', (data) => {
    const isNight = data.isNight;
    const nightFactor = data.nightFactor;
    
    for (const lampRoot of group.children) {
      // Reset manual override on sunrise/sunset transition boundaries
      if (lampRoot.userData.targetOn !== isNight) {
        lampRoot.userData.isManual = false;
      }
      lampRoot.userData.targetOn = isNight;
      lampRoot.userData.nightFactor = nightFactor;
    }
  });

  // Smooth transition (0.8s) -> Rate = 120.0 / 0.8 = 150.0 units per second
  group.userData.tick = (delta, time) => {
    for (const lampRoot of group.children) {
      const pl = lampRoot.userData.pointLight;
      if (!pl) continue;

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

      // Update emissive intensity of physical lamp mesh to match actual PointLight intensity
      const normalizedIntensity = pl.intensity / 120.0;
      lampRoot.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mat of mats) {
            if (mat.emissive) {
              mat.emissiveIntensity = normalizedIntensity * 8.0;
              mat.emissive.setHex(0xfffaf0);
            }
          }
        }
      });
    }
  };

  return group;
}
