import * as THREE from 'three';
import { loadColorTexture, loadLinearTexture, loadGLB, sanitizeMaterials } from '../utils/loaders.js';

const TEX_BASE = 'assets/textures/asphalt_02_2k/textures/';
const BRIDGE_URL = 'assets/models/japanese_bridge.glb';

function makeAsphaltMaterial({ repeat, anisotropy }) {
  const map = loadColorTexture(`${TEX_BASE}asphalt_02_diff_2k.jpg`, { repeat, anisotropy });
  const roughnessMap = loadLinearTexture(`${TEX_BASE}asphalt_02_rough_2k.jpg`, { repeat, anisotropy });
  const displacementMap = loadLinearTexture(`${TEX_BASE}asphalt_02_disp_2k.png`, { repeat, anisotropy });

  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    bumpMap: displacementMap,
    bumpScale: 0.15,
    roughness: 1.0,
    metalness: 0.0,
  });
}

export async function buildPaths({ anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'paths';

  const pathY = 0.01;

  // Split NS path into North and South segments, leaving a space at Z=0 for the East-West river
  const matNS = makeAsphaltMaterial({ repeat: [1, 14], anisotropy });
  const pathN = new THREE.Mesh(new THREE.PlaneGeometry(6, 90), matNS);
  pathN.rotation.x = -Math.PI / 2;
  pathN.position.set(0, pathY, -55);
  pathN.receiveShadow = true;
  group.add(pathN);

  const pathS = new THREE.Mesh(new THREE.PlaneGeometry(6, 90), matNS);
  pathS.rotation.x = -Math.PI / 2;
  pathS.position.set(0, pathY, 55);
  pathS.receiveShadow = true;
  group.add(pathS);

  // Decorative central bridge (model) over the East-West river
  try {
    const gltf = await loadGLB(BRIDGE_URL);
    const bridge = gltf.scene;
    sanitizeMaterials(bridge);

    const bbox = new THREE.Box3().setFromObject(bridge);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const targetWidth = 32.0;
    const scale = size.z > 0 ? targetWidth / size.z : 1;
    bridge.scale.setScalar(scale);

    bridge.position.set(0, pathY - bbox.min.y * scale, 0);
    // Align bridge crossing NS path over EW river
    bridge.rotation.y = 0; 

    bridge.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(bridge);
  } catch (e) {
    console.error("Failed to load bridge", e);
  }

  // River underneath (Runs East-West and is wavy)
  const riverMat = new THREE.MeshStandardMaterial({ color: 0x3388cc, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85 });
  const riverGeo = new THREE.PlaneGeometry(200, 24, 100, 1);
  const posAttribute = riverGeo.attributes.position;
  // create wavy curves long X
  for (let i = 0; i < posAttribute.count; i++) {
    const x = posAttribute.getX(i);
    let y = posAttribute.getY(i);
    // Add sine wave to Y so edges become curved. 
    y += Math.sin(x * 0.08) * 4.0;
    posAttribute.setY(i, y);
  }
  riverGeo.computeVertexNormals();

  const river = new THREE.Mesh(riverGeo, riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, pathY + 0.1, 0); // slightly above ground to avoid z-fighting
  river.receiveShadow = true;
  group.add(river);

  return group;
}
