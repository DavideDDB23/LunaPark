import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';

const FENCE_URL = 'assets/models/low_poly_wooden_fence.glb';
const HALF = 100;
const SEG_LEN = 4.0;

function bakeSourceToSingleMesh(root) {
  const geos = [];
  let mat = null;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    g.applyMatrix4(o.matrixWorld);
    geos.push(g);
    if (!mat && o.material) mat = Array.isArray(o.material) ? o.material[0] : o.material;
  });
  if (!geos.length) return null;
  for (const g of geos) {
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key);
    }
  }
  const merged = mergeGeometries(geos, false);
  // Recenter on XZ — source model may have its origin at one end of the segment.
  // Without this, segment world origin is not the segment centre and adjacent placements leave gaps.
  const cbb = new THREE.Box3().setFromBufferAttribute(merged.attributes.position);
  const cx = (cbb.min.x + cbb.max.x) / 2;
  const cz = (cbb.min.z + cbb.max.z) / 2;
  merged.translate(-cx, 0, -cz);
  return { geometry: merged, material: mat };
}

export async function buildFence() {
  const group = new THREE.Group();
  group.name = 'fence';

  const gltf = await loadGLB(FENCE_URL);
  sanitizeMaterials(gltf.scene);

  const baked = bakeSourceToSingleMesh(gltf.scene);
  if (!baked) return group;

  const bbox = new THREE.Box3().setFromBufferAttribute(baked.geometry.attributes.position);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const sourceLen = Math.max(size.x, size.z);
  const scale = sourceLen > 0 ? SEG_LEN / sourceLen : 1;
  const alongX = size.x >= size.z;
  const minY = bbox.min.y * scale;

  const count = Math.floor((HALF * 2) / SEG_LEN);
  const start = -HALF + SEG_LEN / 2;
  const totalInstances = count * 4;

  const inst = new THREE.InstancedMesh(baked.geometry, baked.material, totalInstances);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.name = 'fence_instanced';

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const s = new THREE.Vector3(scale, scale, scale);

  let idx = 0;
  function place(x, z, rotY) {
    let rot = rotY;
    if (!alongX) rot += Math.PI / 2;
    pos.set(x, -minY, z);
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    m.compose(pos, quat, s);
    inst.setMatrixAt(idx++, m);
  }

  // offset start by half a segment to perfectly fit 200x200
  for (let i = 0; i < count; i++) {
    const t = start + i * SEG_LEN;
    
    // Wider gap at the south entrance — entrance gate sits here, must not overlap fence.
    if (Math.abs(t) < 12) {
        place(t, -HALF, 0); // only build north wall here
        place( HALF, t, Math.PI / 2); // east wall
        place(-HALF, t, Math.PI / 2); // west wall
        continue;
    }

    place(t, -HALF, 0); // North
    place(t,  HALF, 0); // South (gap already skipped)
    place( HALF, t, Math.PI / 2); // East
    place(-HALF, t, Math.PI / 2); // West
  }
  inst.count = idx; // Update actual instance count
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);

  // Corner posts — close the gap at each of the 4 corners.
  const cornerHeight = (bbox.max.y - bbox.min.y) * scale * 1.15;
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0xa67b4a, roughness: 0.9, metalness: 0.0 });
  const cornerGeo = new THREE.BoxGeometry(0.5, cornerHeight, 0.5);
  for (const [cx, cz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
    const post = new THREE.Mesh(cornerGeo, cornerMat);
    post.position.set(cx, cornerHeight / 2, cz);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  return group;
}
