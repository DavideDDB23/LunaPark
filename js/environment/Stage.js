import * as THREE from 'three';
import { loadColorTexture, loadLinearTexture } from '../utils/loaders.js';

const WOOD_BASE = 'assets/textures/PaintedWood003_2K-JPG/';
const STAGE_Z = -88;

function makePaintedWoodMaterial({ repeat = [2, 2], anisotropy = 8, color = 0xffffff } = {}) {
  const map = loadColorTexture(`${WOOD_BASE}PaintedWood003_2K-JPG_Color.jpg`, { repeat, anisotropy });
  const normalMap = loadLinearTexture(`${WOOD_BASE}PaintedWood003_2K-JPG_NormalGL.jpg`, { repeat, anisotropy });
  const roughnessMap = loadLinearTexture(`${WOOD_BASE}PaintedWood003_2K-JPG_Roughness.jpg`, { repeat, anisotropy });
  return new THREE.MeshStandardMaterial({
    map, normalMap, roughnessMap,
    color, roughness: 0.85, metalness: 0.0,
  });
}

export function buildStage({ anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'stage';

  const Z = STAGE_Z;

  // ─── Materials ────────────────────────────────────────────────
  const platformMat = makePaintedWoodMaterial({ repeat: [6, 6], anisotropy });
  const stairMat = makePaintedWoodMaterial({ repeat: [2, 2], anisotropy, color: 0xeae0c8 });
  const roofMat = makePaintedWoodMaterial({ repeat: [3, 3], anisotropy, color: 0xaa2211 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7, metalness: 0.1 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xddc060, roughness: 0.35, metalness: 0.7 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x7c1d1d, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0xfff3c8, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff0aa, emissive: 0xffd766, emissiveIntensity: 0.9, roughness: 0.3,
  });

  // ─── Platform (octagonal) ─────────────────────────────────────
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.6, 8), platformMat);
  platform.position.set(0, 0.3, Z);
  platform.rotation.y = Math.PI / 8;
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);

  // Platform edge trim
  const edgeRing = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.12, 8, 8), goldTrim);
  edgeRing.position.set(0, 0.6, Z);
  edgeRing.rotation.set(Math.PI / 2, 0, Math.PI / 8);
  group.add(edgeRing);

  // ─── Stairs (3 steps front) ───────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const w = 8 - i * 0.4;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.7), stairMat);
    step.position.set(0, 0.09 + i * 0.18, Z + 12 + 0.35 + i * 0.7);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // ─── Pillars (8 ornate columns) ───────────────────────────────
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.32, 4.8, 16);
  const baseGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.35, 16);
  const capGeo = new THREE.CylinderGeometry(0.45, 0.3, 0.4, 16);
  const radius = 10.5;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius + Z;

    const base = new THREE.Mesh(baseGeo, goldTrim);
    base.position.set(x, 0.78, z);
    base.castShadow = true;
    group.add(base);

    const col = new THREE.Mesh(pillarGeo, pillarMat);
    col.position.set(x, 3.35, z);
    col.castShadow = true;
    group.add(col);

    const cap = new THREE.Mesh(capGeo, goldTrim);
    cap.position.set(x, 5.95, z);
    group.add(cap);
  }

  // ─── Roof (8-sided cone + ridge trim + finial) ───────────────
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 13, 4.5, 8), roofMat);
  roof.position.set(0, 8.45, Z);
  roof.rotation.y = Math.PI / 8;
  roof.castShadow = true;
  group.add(roof);

  // Roof underside trim (octagon ring)
  const roofRing = new THREE.Mesh(new THREE.CylinderGeometry(12.6, 12.6, 0.25, 8), goldTrim);
  roofRing.position.set(0, 6.3, Z);
  roofRing.rotation.y = Math.PI / 8;
  group.add(roofRing);

  // Finial
  const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), goldTrim);
  finialBall.position.set(0, 11.0, Z);
  group.add(finialBall);
  const finialSpike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 16), goldTrim);
  finialSpike.position.set(0, 12.4, Z);
  group.add(finialSpike);

  // ─── Backdrop (curtain panels + banner) ──────────────────────
  const curtainGeo = new THREE.PlaneGeometry(5.8, 4.6);
  for (let i = -1; i <= 1; i++) {
    const c = new THREE.Mesh(curtainGeo, curtainMat);
    c.position.set(i * 5.8, 3.0, Z - 9.5);
    c.castShadow = true;
    c.receiveShadow = true;
    group.add(c);
  }

  // Curtain rod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 18, 12), goldTrim);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 5.4, Z - 9.45);
  group.add(rod);

  // Banner
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.5), bannerMat);
  banner.position.set(0, 5.5, Z - 9.4);
  group.add(banner);

  // ─── Marquee bulbs around roof base ──────────────────────────
  const bulbGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const bulbCount = 24;
  for (let i = 0; i < bulbCount; i++) {
    const a = (i / bulbCount) * Math.PI * 2 + Math.PI / 8;
    const r = 12.3;
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(Math.cos(a) * r, 6.2, Math.sin(a) * r + Z);
    group.add(bulb);
  }

  // ─── Spotlight ───────────────────────────────────────────────
  const spot = new THREE.SpotLight(0xffffff, 0, 50, Math.PI / 6, 0.3, 1);
  spot.position.set(0, 14, Z + 8);
  spot.target.position.set(0, 0.6, Z);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.name = 'stage_spotlight';
  group.add(spot);
  group.add(spot.target);

  group.userData.spotLight = spot;
  return group;
}
