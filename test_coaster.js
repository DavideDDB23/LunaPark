import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function toArrayBuffer(buf) {
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

const data = fs.readFileSync('assets/models/rides/coaster_track.glb');
const loader = new GLTFLoader();
loader.parse(toArrayBuffer(data), '', (gltf) => {
  const model = gltf.scene;
  const RAIL_MESH_NAME = 'Circle023_build_gen_1_0';
  const railMesh = model.getObjectByName(RAIL_MESH_NAME);
  if (!railMesh) {
    console.log("NOT FOUND");
    return;
  }
  const pos = railMesh.geometry.attributes.position;
  const nRings = Math.floor(pos.count / 24);
  console.log(`Found ${nRings} rings`);
  
  // Let's check the first few rings and see if vertex 0 is consistently 'up' relative to the centroid
  for (let r = 0; r < 5; r++) {
    const cen = new THREE.Vector3();
    for (let j = 0; j < 24; j++) {
      const idx = r * 24 + j;
      cen.x += pos.getX(idx); cen.y += pos.getY(idx); cen.z += pos.getZ(idx);
    }
    cen.multiplyScalar(1 / 24);
    
    // get vertex 0
    const v0 = new THREE.Vector3(pos.getX(r*24), pos.getY(r*24), pos.getZ(r*24));
    v0.sub(cen).normalize();
    console.log(`Ring ${r} v0 direction:`, v0.x.toFixed(3), v0.y.toFixed(3), v0.z.toFixed(3));
  }
});
