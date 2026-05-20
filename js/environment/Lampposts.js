import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';

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
      o.castShadow = true;
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

  const targetHeight = 6.0; // taller lamps
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const groundOffset = -bbox.min.y * scale;
  const lampHeadY = bbox.max.y * scale * 0.9;

  for (const [id, x, z] of POSITIONS) {
    const lampRoot = new THREE.Group();
    lampRoot.name = id;
    lampRoot.position.set(x, groundOffset, z);
    lampRoot.userData.lampId = id;
    lampRoot.userData.on = false;

    const lampMesh = source.clone(true);
    lampMesh.scale.setScalar(scale);
    enableShadows(lampMesh);
    lampMesh.traverse((o) => {
      if (o.isMesh) o.userData.lampRef = lampRoot;
    });
    lampRoot.add(lampMesh);

    const pointLight = new THREE.PointLight(0xffdd88, 0, 15, 2);
    pointLight.position.set(0, lampHeadY, 0);
    pointLight.name = `${id}_light`;
    lampRoot.add(pointLight);

    lampRoot.userData.pointLight = pointLight;
    group.add(lampRoot);
  }

  return group;
}
