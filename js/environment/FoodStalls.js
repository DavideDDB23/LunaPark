import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';

const STALL_URL = 'assets/models/stylized_carnival_booth.glb';

const PLACEMENTS = [
  // Hub area stalls (around the central circle)
  ['stall_1',  12, -12, -Math.PI * 0.75], // NE quadrant
  ['stall_2', -12,  12,  Math.PI * 0.25], // SW quadrant
];

function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

export async function buildFoodStalls() {
  const group = new THREE.Group();
  group.name = 'foodStalls';

  const gltf = await loadGLB(STALL_URL);
  const source = gltf.scene;
  sanitizeMaterials(source);

  const bbox = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const targetHeight = 4.0;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const groundOffset = -bbox.min.y * scale;

  for (const [id, x, z, rotY] of PLACEMENTS) {
    const stall = source.clone(true);
    stall.name = id;
    stall.scale.setScalar(scale);
    stall.position.set(x, groundOffset, z);
    stall.rotation.y = rotY;
    enableShadows(stall);
    group.add(stall);
  }

  return group;
}
