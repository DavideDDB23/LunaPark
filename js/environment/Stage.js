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

  // Animation arrays
  const stageBulbs = [];
  const beams = [];
  const uplights = [];

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
  const starNeonMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(15, 12.5, 0),
    transparent: true,
    opacity: 1.0
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

  // ─── Stairs (3 steps front - corrected slope direction) ────────
  for (let i = 0; i < 3; i++) {
    const w = 8 - i * 0.4;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.7), stairMat);
    // Corrected so that lower steps are further forward (larger Z)
    step.position.set(0, 0.09 + i * 0.18, Z + 12 + 0.35 + (2 - i) * 0.7);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // ─── VIP Red Carpet Runner ───────────────────────────────────
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x9e1b1b, roughness: 0.9, metalness: 0.0 });
  
  // Platform carpet strip (from back curtains to front edge of platform)
  const platCarpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 21.0), carpetMat);
  platCarpet.position.set(0, 0.606, Z + 1.5);
  platCarpet.receiveShadow = true;
  group.add(platCarpet);
  
  // Stairs carpet treads
  // Step 2: y = 0.45, z = Z + 12.35
  const step2Carpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 0.72), carpetMat);
  step2Carpet.position.set(0, 0.546, Z + 12.35);
  step2Carpet.receiveShadow = true;
  group.add(step2Carpet);
  
  // Step 1: y = 0.27, z = Z + 13.05
  const step1Carpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 0.72), carpetMat);
  step1Carpet.position.set(0, 0.366, Z + 13.05);
  step1Carpet.receiveShadow = true;
  group.add(step1Carpet);
  
  // Step 0: y = 0.09, z = Z + 13.75
  const step0Carpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 0.72), carpetMat);
  step0Carpet.position.set(0, 0.186, Z + 13.75);
  step0Carpet.receiveShadow = true;
  group.add(step0Carpet);
  
  // Pathway carpet continuation at the bottom
  const pathCarpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 2.5), carpetMat);
  pathCarpet.position.set(0, 0.006, Z + 13.75 + 0.36 + 1.25);
  pathCarpet.receiveShadow = true;
  group.add(pathCarpet);

  // ─── Stage Footlights (fixtures matching the light sources) ───
  const footlightFixtureGeo = new THREE.BoxGeometry(0.4, 0.25, 0.4);
  const footlightHoodGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 12, 1, true);
  const footlightBulbGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const footlightHousingMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8, metalness: 0.2 });
  const footlightBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffeebb,
    emissive: 0xffaa44,
    emissiveIntensity: 2.0,
    roughness: 0.2
  });
  
  const footlightPositions = [
    { x: -9.0, z: Z + 8.5, rotY: Math.PI / 4 },
    { x: 9.0, z: Z + 8.5, rotY: -Math.PI / 4 },
    { x: -4.5, z: Z + 11.2, rotY: 0 },
    { x: 4.5, z: Z + 11.2, rotY: 0 }
  ];
  
  for (const pos of footlightPositions) {
    const fixture = new THREE.Group();
    fixture.position.set(pos.x, 0.6 + 0.125, pos.z);
    fixture.rotation.y = pos.rotY;
    
    // Base box
    const baseBox = new THREE.Mesh(footlightFixtureGeo, footlightHousingMat);
    baseBox.castShadow = true;
    fixture.add(baseBox);
    
    // Gold hood (tilted back to face stage)
    const hood = new THREE.Mesh(footlightHoodGeo, goldTrim);
    hood.position.set(0, 0.15, -0.05);
    hood.rotation.x = -Math.PI / 4; // angle back to stage
    fixture.add(hood);
    
    // Bulb inside
    const bulb = new THREE.Mesh(footlightBulbGeo, footlightBulbMat);
    bulb.position.set(0, 0.15, 0);
    fixture.add(bulb);
    
    group.add(fixture);
  }

  // ─── Floor Compass/Star Medallion ─────────────────────────────
  const medallionGroup = new THREE.Group();
  medallionGroup.position.set(0, 0.605, Z);
  
  // Outer gold ring
  const outerRingGeo = new THREE.RingGeometry(3.6, 3.8, 8);
  const outerRing = new THREE.Mesh(outerRingGeo, goldTrim);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.rotation.z = Math.PI / 8; // align with platform
  medallionGroup.add(outerRing);
  
  // Inner gold ring
  const innerRingGeo = new THREE.RingGeometry(1.8, 1.9, 32);
  const innerRing = new THREE.Mesh(innerRingGeo, goldTrim);
  innerRing.rotation.x = -Math.PI / 2;
  medallionGroup.add(innerRing);
  
  // 8-pointed star points
  for (let k = 0; k < 8; k++) {
    const angle = k * Math.PI / 4;
    const starPointGeo = new THREE.ConeGeometry(0.25, 3.5, 4);
    const starPoint = new THREE.Mesh(starPointGeo, goldTrim);
    starPoint.position.set(Math.cos(angle) * 1.75, 0, Math.sin(angle) * 1.75);
    starPoint.rotation.x = Math.PI / 2;
    starPoint.rotation.z = -angle - Math.PI / 2;
    medallionGroup.add(starPoint);
  }
  
  group.add(medallionGroup);

  // ─── Pillars (8 ornate columns with rose vines) ───────────────
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

    // Golden rings around column at 1/3 and 2/3 height
    for (const ry of [3.35 - 1.2, 3.35 + 1.2]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 16), goldTrim);
      ring.position.set(x, ry, z);
      ring.castShadow = true;
      group.add(ring);
    }

    // Rose vine wrapping around column
    let prevColX = null, prevColY = null, prevColZ = null;
    const colIvySteps = 16;
    let colLcg = i * 200;
    function colRandom() {
      colLcg = (colLcg * 1664525 + 1013904223) % 4294967296;
      return colLcg / 4294967296;
    }
    for (let j = 0; j < colIvySteps; j++) {
      const t = j / (colIvySteps - 1);
      const ivyY = 0.95 + t * 4.6; // from base top to capital bottom
      const angle = t * Math.PI * 4.0 + i * 1.5;
      const leafX = x + Math.cos(angle) * 0.34;
      const leafZ = z + Math.sin(angle) * 0.34;
      
      // Draw vine stem
      if (prevColX !== null) {
        const dx = leafX - prevColX;
        const dy = ivyY - prevColY;
        const dz = leafZ - prevColZ;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, dist, 4);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d2712, roughness: 0.9 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set((leafX + prevColX)/2, (ivyY + prevColY)/2, (leafZ + prevColZ)/2);
        const direction = new THREE.Vector3(dx, dy, dz).normalize();
        stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        group.add(stem);
      }
      prevColX = leafX;
      prevColY = ivyY;
      prevColZ = leafZ;
      
      // Leaves
      if (colRandom() > 0.3) {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d4d22, roughness: 0.8 });
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), leafMat);
        leaf.position.set(leafX + Math.cos(angle)*0.03, ivyY, leafZ + Math.sin(angle)*0.03);
        leaf.rotation.set(0.4, angle + Math.PI/2, 0.2);
        group.add(leaf);
      }
      
      // Roses (every few steps, add a beautiful red rose bud)
      if (j > 2 && j < 14 && colRandom() > 0.6) {
        const roseMat = new THREE.MeshStandardMaterial({
          color: 0xd31b3b,
          emissive: 0x4a0005,
          emissiveIntensity: 0.3,
          roughness: 0.7
        });
        const roseGroup = new THREE.Group();
        roseGroup.position.set(leafX + Math.cos(angle)*0.05, ivyY, leafZ + Math.sin(angle)*0.05);
        
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), roseMat);
        roseGroup.add(bud);
        const petals = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 5), roseMat);
        petals.rotation.x = Math.PI / 2;
        roseGroup.add(petals);
        
        group.add(roseGroup);
      }
    }
  }

  // ─── Gold Railing between pillars (except front stairs) ────────
  for (let i = 0; i < 8; i++) {
    // Skip the front sections where stairs are (indices 5 and 6)
    if (i === 5 || i === 6) continue;

    const a1 = i * Math.PI / 4 + Math.PI / 8;
    const a2 = ((i + 1) % 8) * Math.PI / 4 + Math.PI / 8;

    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    const x2 = Math.cos(a2) * radius, z2 = Math.sin(a2) * radius;

    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2 + Z;
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(z2 - z1, x2 - x1);

    const railGroup = new THREE.Group();
    railGroup.position.set(midX, 0.6, midZ);
    railGroup.rotation.y = -angle;

    // Top rail
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, dist, 8), goldTrim);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.y = 0.8;
    topBar.castShadow = true;
    railGroup.add(topBar);

    // Bottom rail
    const bottomBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, dist, 8), goldTrim);
    bottomBar.rotation.z = Math.PI / 2;
    bottomBar.position.y = 0.15;
    bottomBar.castShadow = true;
    railGroup.add(bottomBar);

    // Balusters
    const balusterCount = 9;
    for (let k = 0; k < balusterCount; k++) {
      const t = (k + 1) / (balusterCount + 1);
      const bx = -dist / 2 + t * dist;
      const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6), goldTrim);
      baluster.position.set(bx, 0.475, 0);
      baluster.castShadow = true;
      railGroup.add(baluster);
    }
    group.add(railGroup);
  }

  // ─── Roof (8-sided cone + ridge trim + finial) ───────────────
  roofMat.side = THREE.DoubleSide;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 13, 4.5, 8, 1, true), roofMat);
  roof.position.set(0, 8.45, Z);
  roof.rotation.y = Math.PI / 8;
  roof.castShadow = true;
  group.add(roof);

  // Golden ribs along the 8 corners of the octagonal roof
  const roofTopY = 8.45 + 2.25; // 10.7
  const roofBottomY = 8.45 - 2.25; // 6.2
  const roofR = 13.0;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + Math.PI / 8;
    const bottomX = Math.cos(a) * roofR;
    const bottomZ = Math.sin(a) * roofR + Z;
    
    // Direction vector
    const dx = bottomX;
    const dy = roofBottomY - roofTopY;
    const dz = bottomZ - Z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    const ribGeo = new THREE.CylinderGeometry(0.08, 0.08, dist, 8);
    const rib = new THREE.Mesh(ribGeo, goldTrim);
    rib.position.set(bottomX / 2, (roofBottomY + roofTopY) / 2, (bottomZ + Z) / 2);
    
    const direction = new THREE.Vector3(dx, dy, dz).normalize();
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    rib.castShadow = true;
    group.add(rib);
  }

  // Scalloped gold valance along the roof edge
  for (let k = 0; k < 8; k++) {
    const a1 = k * Math.PI / 4 + Math.PI / 8;
    const a2 = ((k + 1) % 8) * Math.PI / 4 + Math.PI / 8;
    
    const x1 = Math.cos(a1) * roofR, z1 = Math.sin(a1) * roofR;
    const x2 = Math.cos(a2) * roofR, z2 = Math.sin(a2) * roofR;
    
    // Interpolate along the side
    const scallopsPerSide = 6;
    for (let s = 0; s < scallopsPerSide; s++) {
      const t = (s + 0.5) / scallopsPerSide;
      const sx = x1 + (x2 - x1) * t;
      const sz = z1 + (z2 - z1) * t + Z;
      
      const valance = new THREE.Group();
      valance.position.set(sx, 6.1, sz);
      
      // Scallop shape: small golden sphere and hanging cone
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), goldTrim);
      valance.add(sphere);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), goldTrim);
      cone.position.y = -0.09;
      cone.rotation.x = Math.PI; // point down
      valance.add(cone);
      
      group.add(valance);
    }
  }

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

  // ─── Backdrop (folded curtain panels + banner) ───────────────
  const curtainW = 18.0;
  const curtainH = 4.8;
  const curtainGeo = new THREE.PlaneGeometry(curtainW, curtainH, 80, 10);
  const posAttr = curtainGeo.attributes.position;
  for (let j = 0; j < posAttr.count; j++) {
    const vx = posAttr.getX(j);
    // Vertical folds using sine and cosine waves
    const fold = Math.sin(vx * 2.2) * 0.18 + Math.cos(vx * 5.5) * 0.05;
    posAttr.setZ(j, fold);
  }
  curtainGeo.computeVertexNormals();

  const curtainMesh = new THREE.Mesh(curtainGeo, curtainMat);
  curtainMesh.position.set(0, 3.0, Z - 9.5);
  curtainMesh.castShadow = true;
  curtainMesh.receiveShadow = true;
  group.add(curtainMesh);

  // Golden tieback ropes on the sides
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe6b030, roughness: 0.4, metalness: 0.7 });
  for (const sx of [-1, 1]) {
    const ropeGeo = new THREE.TorusGeometry(1.2, 0.05, 8, 24, Math.PI);
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(sx * 6.5, 2.0, Z - 9.3);
    rope.rotation.set(0, sx * Math.PI / 2, Math.PI / 2);
    group.add(rope);
  }

  // Curtain rod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 18, 12), goldTrim);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 4.5, Z - 8.3);
  group.add(rod);

  // Banner
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.5), bannerMat);
  banner.position.set(0, 4.6, Z - 8.2);
  group.add(banner);

  // Neon Star Crest on banner
  const stageStarGroup = new THREE.Group();
  stageStarGroup.position.set(0, 4.6, Z - 8.15);

  const starBack = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.08, 5), goldTrim);
  starBack.rotation.x = Math.PI / 2;
  stageStarGroup.add(starBack);

  const starNeonMesh = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.1, 5), starNeonMat);
  starNeonMesh.rotation.x = Math.PI / 2;
  stageStarGroup.add(starNeonMesh);
  group.add(stageStarGroup);

  // Neon musical notes on the banner
  const noteMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0, 15, 15),
    transparent: true,
    opacity: 1.0
  });
  
  for (const sx of [-1, 1]) {
    const noteGroup = new THREE.Group();
    noteGroup.position.set(sx * 3.0, 4.6, Z - 8.1);
    
    // Note head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), noteMat);
    head.position.set(-0.06, -0.15, 0);
    head.scale.set(1.3, 1, 0.7);
    head.rotation.z = 0.3;
    noteGroup.add(head);
    
    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 8), noteMat);
    stem.position.set(0, 0.04, 0);
    noteGroup.add(stem);
    
    // Flag
    const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), noteMat);
    flag.position.set(0.07, 0.16, 0);
    flag.rotation.z = -Math.PI / 4;
    noteGroup.add(flag);
    
    group.add(noteGroup);
  }

  // ─── Concert Loudspeakers ───────────────────────────────────
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85, metalness: 0.1 });
  const speakerGold = new THREE.MeshStandardMaterial({ color: 0xddb040, roughness: 0.4, metalness: 0.6 });

  for (const sx of [-1, 1]) {
    const spX = sx * 8.5;
    const spZ = Z + 7.5;

    const speaker = new THREE.Group();
    speaker.position.set(spX, 0.6 + 0.9, spZ);
    speaker.rotation.y = -sx * 0.35 + Math.PI;

    // Cabinet
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.8), speakerMat);
    cabinet.castShadow = true;
    speaker.add(cabinet);

    // Woofer
    const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 12), speakerGold);
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, -0.35, 0.41);
    speaker.add(woofer);

    // Tweeter
    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), speakerGold);
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(0, 0.35, 0.41);
    speaker.add(tweeter);

    group.add(speaker);
  }

  // ─── Microphone Stand ───────────────────────────────────────
  const micGroup = new THREE.Group();
  micGroup.position.set(0, 0.6, Z + 5);

  const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 12), goldTrim);
  micBase.position.y = 0.02;
  micBase.castShadow = true;
  micGroup.add(micBase);

  const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8), goldTrim);
  micPole.position.y = 0.9;
  micPole.castShadow = true;
  micGroup.add(micPole);

  const micBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8), goldTrim);
  micBoom.position.set(0, 1.8, 0.15);
  micBoom.rotation.x = 0.4;
  micBoom.castShadow = true;
  micGroup.add(micBoom);

  const micCapsule = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), speakerMat);
  micCapsule.position.set(0, 1.9, 0.3);
  micCapsule.castShadow = true;
  micGroup.add(micCapsule);

  group.add(micGroup);

  // ─── Marquee bulbs around roof base ──────────────────────────
  const bulbGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const bulbCount = 24;
  for (let i = 0; i < bulbCount; i++) {
    const a = (i / bulbCount) * Math.PI * 2 + Math.PI / 8;
    const r = 12.3;
    const bulbMatInstance = bulbMat.clone();
    const bulb = new THREE.Mesh(bulbGeo, bulbMatInstance);
    bulb.position.set(Math.cos(a) * r, 6.2, Math.sin(a) * r + Z);
    group.add(bulb);
    stageBulbs.push(bulb);
  }

  // ─── Spotlight & Volumetric Beams ───────────────────────────
  const spot = new THREE.SpotLight(0xffffff, 0, 60, Math.PI / 4, 0.4, 1);
  spot.position.set(0, 14, Z + 8);
  spot.target.position.set(0, 0.6, Z - 2.0);
  spot.castShadow = false;
  spot.shadow.mapSize.set(1024, 1024);
  spot.name = 'stage_spotlight';
  group.add(spot);
  group.add(spot.target);

  // Volumetric spotlight beams (translucent cones)
  const beamGeo = new THREE.ConeGeometry(3.2, 16.0, 16, 1, true);
  beamGeo.translate(0, -8.0, 0); // shift origin to tip
  const beamColors = [0x00ffff, 0xff00ff];

  for (let i = 0; i < 2; i++) {
    const beamMat = new THREE.MeshBasicMaterial({
      color: beamColors[i],
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(i === 0 ? -5 : 5, 14, Z + 8);
    beam.rotation.z = i === 0 ? -0.28 : 0.28;
    beam.rotation.x = -0.08;
    group.add(beam);
    beams.push(beam);
  }

  // ─── Stage Uplights ─────────────────────────────────────────
  for (const sx of [-1, 1]) {
    const uplight = new THREE.SpotLight(0xffb74d, 0, 30, Math.PI / 3, 0.6, 1);
    uplight.position.set(sx * 9.0, 0.65, Z + 8.5);
    uplight.target.position.set(sx * 3.0, 3.0, Z - 9.5);
    group.add(uplight);
    group.add(uplight.target);
    uplights.push(uplight);
  }

  // ─── Animation Tick ─────────────────────────────────────────
  group.userData.tick = (delta, time) => {
    const sun = group.parent?.parent?.getObjectByName('sun') || group.parent?.getObjectByName('sun');
    const isNight = sun ? (sun.position.y < 5.0 || sun.intensity < 0.5) : false;

    const targetSpotIntensity = isNight ? 100.0 : 0.0;
    const targetUplightIntensity = isNight ? 20.0 : 0.0;

    // Smooth spotlight and uplight transition
    spot.intensity = THREE.MathUtils.lerp(spot.intensity, targetSpotIntensity, 0.08);
    for (const u of uplights) {
      u.intensity = THREE.MathUtils.lerp(u.intensity, targetUplightIntensity, 0.08);
    }

    // Volumetric spotlight beams breathing/fading
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const targetOpacity = isNight ? (0.10 + Math.sin(time * 2.5 + i * Math.PI) * 0.03) : 0.0;
      b.material.opacity = THREE.MathUtils.lerp(b.material.opacity, targetOpacity, 0.05);
    }

    // Neon Star pulse
    starNeonMat.opacity = isNight ? (0.75 + Math.sin(time * 4.0) * 0.25) : 0.95;

    // Neon musical notes pulse
    if (typeof noteMat !== 'undefined') {
      noteMat.opacity = isNight ? (0.75 + Math.sin(time * 3.0) * 0.25) : 0.95;
    }

    // Footlights bulb glow
    if (typeof footlightBulbMat !== 'undefined') {
      footlightBulbMat.emissiveIntensity = isNight ? 12.0 : 0.0;
    }

    // Marquee bulbs chasing sequence
    for (let i = 0; i < stageBulbs.length; i++) {
      const b = stageBulbs[i];
      if (isNight) {
        const step = Math.floor(time * 6.0) % 3;
        const isOn = (i % 3) === step;
        b.material.emissiveIntensity = isOn ? 2.2 : 0.25;
      } else {
        b.material.emissiveIntensity = 0.0;
      }
    }
  };

  group.userData.spotLight = spot;
  return group;
}
