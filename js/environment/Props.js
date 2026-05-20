import * as THREE from 'three';
import { loadColorTexture, loadLinearTexture } from '../utils/loaders.js';

export function buildEntranceGate() {
  const group = new THREE.Group();
  
  // Arch pillars
  const mat = new THREE.MeshStandardMaterial({ color: 0xcd853f, roughness: 0.9 });
  const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 8);
  const p1 = new THREE.Mesh(pillarGeo, mat);
  p1.position.set(-6, 4, 100);
  p1.castShadow = true;
  group.add(p1);

  const p2 = new THREE.Mesh(pillarGeo, mat);
  p2.position.set(6, 4, 100);
  p2.castShadow = true;
  group.add(p2);

  // Sign board
  const signMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.1 });
  const signGeo = new THREE.BoxGeometry(14, 2.5, 0.5);
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, 8, 100);
  sign.castShadow = true;
  group.add(sign);
  
  return group;
}
