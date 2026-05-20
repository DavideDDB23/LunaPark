import * as THREE from 'three';
import { loadColorTexture, loadLinearTexture } from '../utils/loaders.js';

const WOOD_BASE = 'assets/textures/PaintedWood003_2K-JPG/';

function makePaintedWoodMaterial({ repeat = [2, 2], anisotropy = 8, color = 0xffffff } = {}) {
  const map = loadColorTexture(`${WOOD_BASE}PaintedWood003_2K-JPG_Color.jpg`, { repeat, anisotropy });
  const normalMap = loadLinearTexture(`${WOOD_BASE}PaintedWood003_2K-JPG_NormalGL.jpg`, { repeat, anisotropy });
  const roughnessMap = loadLinearTexture(`${WOOD_BASE}PaintedWood003_2K-JPG_Roughness.jpg`, { repeat, anisotropy });
  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap,
    color,
    roughness: 0.85,
    metalness: 0.0,
  });
}

export function buildStage({ anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'stage';

  // Wider stage platform (radius 12, octagon)
  const platformMat = makePaintedWoodMaterial({ repeat: [6, 6], anisotropy });
  const platformGeo = new THREE.CylinderGeometry(12, 12, 0.6, 8);
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.set(0, 0.3, -88);
  platform.rotation.y = Math.PI / 8; // align flat side with path
  platform.castShadow = true;
  platform.receiveShadow = true;
  platform.name = 'stage_platform';
  group.add(platform);

  // Stage roof
  const roofMat = makePaintedWoodMaterial({ repeat: [2, 2], anisotropy, color: 0xaa2211 });
  const roofGeo = new THREE.CylinderGeometry(0, 13, 4, 8);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 6, -88);
  roof.rotation.y = Math.PI / 8;
  roof.castShadow = true;
  group.add(roof);

  // Pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.4 });
  const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 4);
  const radius = 10;
  for (let i = 0; i < 8; i++) {
    // leave front open
    if (i === 4 || i === 5) continue;
    const angle = (i * Math.PI) / 4 + Math.PI / 8;
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(Math.cos(angle) * radius, 2.3, -88 + Math.sin(angle) * radius);
    p.castShadow = true;
    group.add(p);
  }

  // Backdrop
  const backdropMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.1,
  });
  const backdropGeo = new THREE.PlaneGeometry(16, 4);
  const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
  backdrop.position.set(0, 2.6, -96);
  backdrop.castShadow = true;
  group.add(backdrop);

  // Stage spotlight
  const spot = new THREE.SpotLight(0xffffff, 0, 50, Math.PI / 6, 0.3, 1);
  spot.position.set(0, 10, -78);
  spot.target.position.set(0, 0.6, -88);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.name = 'stage_spotlight';
  group.add(spot);
  group.add(spot.target);

  group.userData.spotLight = spot;
  return group;
}
