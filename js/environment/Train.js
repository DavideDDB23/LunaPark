import * as THREE from 'three';
import { ControlPanel } from './ControlPanel.js';
import { eventBus } from '../utils/EventBus.js';
import { isNightNow } from '../utils/dayNight.js';
import { loadGLB } from '../utils/loaders.js';
import { loadVisitorTemplates, makeRider, updateRider, ACTIONS_SEATED_GENERAL } from './Passengers.js';

// ── CatmullRom control points for the train ring ─
const CONTROL_POINTS = [
  new THREE.Vector3(0, 5.5, -58),     // North crossing (elevated over path, well south of stage)
  new THREE.Vector3(45, 1.2, -80),    // NE inner curve (outside Carousel)
  new THREE.Vector3(82, 1.2, -82),    // NE outer corner curve
  new THREE.Vector3(92, 0.3, -40),    // East-North (near East fence)
  new THREE.Vector3(92, 5.5, 0),      // East River crossing (elevated)
  new THREE.Vector3(92, 1.2, 35),     // East-South (near East fence, next to Coaster, ground level)
  new THREE.Vector3(80, 1.2, 52),     // Westward bulge midpoint (moderate curve through coaster zone)
  new THREE.Vector3(92, 1.2, 70),     // SE outer curve (near East fence, ground level)
  new THREE.Vector3(82, 1.2, 86),     // SE corner curve (curves West, ground level)
  new THREE.Vector3(45, 5.5, 86),     // S transition to elevate (starts climbing and heading West)
  new THREE.Vector3(0, 5.5, 80),      // South crossing (elevated over path at Z=80)
  new THREE.Vector3(-85, 1.2, 92),    // SW outer corner curve (outside Tagada)
  new THREE.Vector3(-92, 0.3, 40),    // West-South (near West fence)
  new THREE.Vector3(-92, 5.5, 0),     // West River crossing (elevated)
  new THREE.Vector3(-92, 0.3, -40),   // West-North (near West fence, outside Ferris Wheel)
  new THREE.Vector3(-82, 1.2, -82),   // NW outer corner curve (outside Ferris Wheel)
  new THREE.Vector3(-45, 1.2, -80),   // NW inner curve (outside Ferris Wheel)
];

const TRAIN_SPEED = 6;
const CAR_SPACING = 5.5;
const NUM_WAGONS = 3;
const TOTAL_CARS = 1 + NUM_WAGONS;

export async function buildTrain({ anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'train';

  const curve = new THREE.CatmullRomCurve3(CONTROL_POINTS, true, 'catmullrom', 0.5);
  // Override curve methods to prevent Y from dipping underground (Y-clamp)
  const originalGetPointAt = curve.getPointAt.bind(curve);
  curve.getPointAt = function(u, target) {
    const p = originalGetPointAt(u, target);
    p.y = Math.max(0.2, p.y);
    return p;
  };
  const originalGetPoint = curve.getPoint.bind(curve);
  curve.getPoint = function(t, target) {
    const p = originalGetPoint(t, target);
    p.y = Math.max(0.2, p.y);
    return p;
  };

  curve.arcLengthDivisions = 10000;
  const trackLength = curve.getLength();

  // ── Track Footprint for NavGrid ──
  const footprintPts = [];
  for (let i = 0; i < 500; i++) {
    const p = curve.getPointAt(i / 500);
    footprintPts.push(p.x, p.z);
  }
  group.userData.footprint = { pts: footprintPts, pad: 7.5 };

  // ── Build physical track (Rails & Sleepers) ──
  const pts = curve.getPoints(500);
  const leftPts = [], rightPts = [];
  const tangent = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3();
  
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    curve.getTangent(t, tangent);
    right.crossVectors(tangent, up).normalize();
    leftPts.push(pts[i].clone().addScaledVector(right, -1.0));
    rightPts.push(pts[i].clone().addScaledVector(right, 1.0));
  }
  
  const railMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.4 });
  const railL = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftPts, true), 500, 0.1, 6, true), railMat);
  const railR = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightPts, true), 500, 0.1, 6, true), railMat);
  railL.castShadow = true; railL.receiveShadow = true;
  railR.castShadow = true; railR.receiveShadow = true;
  group.add(railL, railR);

  const sleeperGeom = new THREE.BoxGeometry(3.0, 0.15, 0.4);
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
  const sleeperCount = 350;
  const sleepers = new THREE.InstancedMesh(sleeperGeom, sleeperMat, sleeperCount);
  sleepers.castShadow = true; sleepers.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < sleeperCount; i++) {
    const t = i / sleeperCount;
    const p = curve.getPointAt(t);
    curve.getTangentAt(t, tangent);
    dummy.position.copy(p);
    dummy.position.y -= 0.05;
    dummy.lookAt(p.clone().add(tangent));
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  group.add(sleepers);

  // ── Support Pillars for elevated track (in pairs) ──
  let pillarCount = 0;
  const pillarInterval = 6; // place support every 6 sleepers
  for (let i = 0; i < sleeperCount; i += pillarInterval) {
    const t = i / sleeperCount;
    const p = curve.getPointAt(t);
    // Skip if not elevated, or if over the main street (X centered at 0, width ~6) or the river (Z centered at 0, width ~20)
    // Also skip placing pillars inside the Roller Coaster area (X > 20, Z > 15) to avoid clipping with coaster structures,
    // and near the Shooting Gallery panel (around X=18, Z=28)
    if (p.y > 0.6 && Math.abs(p.x) >= 5.0 && Math.abs(p.z) >= 12.0 && !(p.x > 20.0 && p.z > 15.0) && !(Math.abs(p.x - 18.0) < 4.0 && Math.abs(p.z - 28.0) < 4.0)) {
      pillarCount += 2;
    }
  }

  const pillarGeom = new THREE.CylinderGeometry(0.12, 0.16, 1.0, 8); // paired, slightly thinner columns
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.7 });
  const pillars = new THREE.InstancedMesh(pillarGeom, pillarMat, pillarCount);
  pillars.castShadow = true; pillars.receiveShadow = true;

  let pillarIdx = 0;
  const dummyPillar = new THREE.Object3D();
  const tempRight = new THREE.Vector3();
  const tempTangent = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < sleeperCount; i += pillarInterval) {
    const t = i / sleeperCount;
    const p = curve.getPointAt(t);
    
    if (p.y > 0.6 && Math.abs(p.x) >= 5.0 && Math.abs(p.z) >= 12.0 && !(p.x > 20.0 && p.z > 15.0) && !(Math.abs(p.x - 18.0) < 4.0 && Math.abs(p.z - 28.0) < 4.0)) {
      curve.getTangentAt(t, tempTangent);
      tempRight.crossVectors(tempTangent, upVec).normalize();
      
      const h = p.y - 0.1;
      
      // Left pillar (-0.85 offset along right vector)
      const leftPos = p.clone().addScaledVector(tempRight, -0.85);
      dummyPillar.position.set(leftPos.x, h / 2, leftPos.z);
      dummyPillar.scale.set(1, h, 1);
      dummyPillar.rotation.set(0, 0, 0);
      dummyPillar.updateMatrix();
      pillars.setMatrixAt(pillarIdx++, dummyPillar.matrix);
      
      // Right pillar (0.85 offset along right vector)
      const rightPos = p.clone().addScaledVector(tempRight, 0.85);
      dummyPillar.position.set(rightPos.x, h / 2, rightPos.z);
      dummyPillar.scale.set(1, h, 1);
      dummyPillar.rotation.set(0, 0, 0);
      dummyPillar.updateMatrix();
      pillars.setMatrixAt(pillarIdx++, dummyPillar.matrix);
    }
  }
  group.add(pillars);

  // ── Load Assets ──
  let trainModel;
  try {
    const gltf = await loadGLB('assets/models/train.glb');
    trainModel = gltf.scene;
    trainModel.scale.set(0.6, 0.6, 0.6); // scale appropriately
    trainModel.rotation.y = Math.PI / 2; // point +Z forward based on orientation constraint
    
    // Process model to ensure materials and shadows
    trainModel.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
        }
      }
    });
  } catch (e) {
    console.warn("Could not load train.glb, falling back to procedural", e);
  }

  const templates = await loadVisitorTemplates();
  const passengers = [];

  // ── Build Train Cars ──
  const cars = [];
  const nightLights = [];
  const carMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.7, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x2244cc, roughness: 0.7, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xcccc22, roughness: 0.7, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x22aa44, roughness: 0.7, metalness: 0.2 }),
  ];

  for (let i = 0; i < TOTAL_CARS; i++) {
    const carGroup = new THREE.Group();
    const isLoco = i === 0;

    if (isLoco && trainModel) {
      const loco = trainModel.clone();
      loco.position.y = 0.5; // sit on tracks
      carGroup.add(loco);

      // Headlight/Spotlight
      const spotLight = new THREE.SpotLight(0xffffee, 0, 50, Math.PI / 5, 0.5, 1.5);
      spotLight.position.set(0, 2.5, 3.0);
      spotLight.castShadow = true;
      spotLight.shadow.mapSize.width = 512;
      spotLight.shadow.mapSize.height = 512;
      spotLight.shadow.camera.near = 0.5;
      spotLight.shadow.camera.far = 40;
      spotLight.shadow.bias = -0.002;
      const target = new THREE.Object3D();
      target.position.set(0, 1.0, 15);
      carGroup.add(spotLight);
      carGroup.add(target);
      spotLight.target = target;
      
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ emissive: 0xffffee, emissiveIntensity: 0 }));
      bulb.position.copy(spotLight.position);
      carGroup.add(bulb);

      nightLights.push({ light: spotLight, mesh: bulb, type: 'spot' });

    } else {
      // Detailed Procedural Open Wagon
      const color = carMaterials[i].color;
      
      const chassisMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
      const woodMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.4 });
      
      // 1. Chassis
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 4.4), chassisMat);
      chassis.position.y = 0.4;
      chassis.castShadow = true; chassis.receiveShadow = true;
      carGroup.add(chassis);
      
      // 2. Axles
      for (const z of [-1.5, 1.5]) {
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), ironMat);
        axle.rotation.z = Math.PI / 2;
        axle.position.set(0, 0.4, z);
        carGroup.add(axle);
      }
      
      // 3. Wheels
      for (const [wx, wz] of [[-1.1, 1.5], [1.1, 1.5], [-1.1, -1.5], [1.1, -1.5]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.4, wz);
        wheel.castShadow = true;
        carGroup.add(wheel);
      }
      
      // 4. Open Tub / Body (5 panels)
      const wallH = 1.0;
      const wallT = 0.12; // thickness
      
      // Floor
      const floor = new THREE.Mesh(new THREE.BoxGeometry(2.0, wallT, 4.2), woodMat);
      floor.position.y = 0.4 + 0.075 + wallT/2;
      floor.castShadow = true; floor.receiveShadow = true;
      carGroup.add(floor);
      
      // Left Wall
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 4.2), woodMat);
      wallL.position.set(-1.0 + wallT/2, 0.4 + 0.075 + wallH/2, 0);
      wallL.castShadow = true; wallL.receiveShadow = true;
      carGroup.add(wallL);
      
      // Right Wall
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 4.2), woodMat);
      wallR.position.set(1.0 - wallT/2, 0.4 + 0.075 + wallH/2, 0);
      wallR.castShadow = true; wallR.receiveShadow = true;
      carGroup.add(wallR);
      
      // Front Wall
      const wallF = new THREE.Mesh(new THREE.BoxGeometry(2.0, wallH, wallT), woodMat);
      wallF.position.set(0, 0.4 + 0.075 + wallH/2, 2.1 - wallT/2);
      wallF.castShadow = true; wallF.receiveShadow = true;
      carGroup.add(wallF);
      
      // Back Wall
      const wallB = new THREE.Mesh(new THREE.BoxGeometry(2.0, wallH, wallT), woodMat);
      wallB.position.set(0, 0.4 + 0.075 + wallH/2, -2.1 + wallT/2);
      wallB.castShadow = true; wallB.receiveShadow = true;
      carGroup.add(wallB);
      
      // Metal corner brackets (iron/metallic accents for low-poly detail)
      for (const cx of [-0.98, 0.98]) {
        for (const cz of [-2.08, 2.08]) {
          const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 0.15), ironMat);
          bracket.position.set(cx, 0.4 + 0.075 + wallH/2, cz);
          carGroup.add(bracket);
        }
      }

      // Benches (seats inside)
      const bzVals = [-1.1, 1.1];
      for (const bz of bzVals) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.6), benchMat);
        bench.position.set(0, 0.4 + 0.075 + 0.125, bz);
        bench.castShadow = true;
        carGroup.add(bench);
        
        // Bench backrest
        const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.08), benchMat);
        backrest.position.set(0, 0.4 + 0.075 + 0.35, bz + (bz > 0 ? -0.26 : 0.26));
        backrest.castShadow = true;
        carGroup.add(backrest);
        
        // Add passengers seated correctly on the benches
        if (templates && templates.length > 0) {
          const tmpl1 = templates[Math.floor(Math.random() * templates.length)];
          const p1 = makeRider(tmpl1, 1.2, { pool: ACTIONS_SEATED_GENERAL });
          p1.pivot.position.set(-0.45, 0.4 + 0.075 + 0.15, bz); 
          p1.pivot.rotation.y = bz > 0 ? 0 : Math.PI; 
          carGroup.add(p1.pivot);
          passengers.push(p1);

          const tmpl2 = templates[Math.floor(Math.random() * templates.length)];
          const p2 = makeRider(tmpl2, 1.2, { pool: ACTIONS_SEATED_GENERAL });
          p2.pivot.position.set(0.45, 0.4 + 0.075 + 0.15, bz); 
          p2.pivot.rotation.y = bz > 0 ? 0 : Math.PI; 
          carGroup.add(p2.pivot);
          passengers.push(p2);
        }
      }

      // Decorative Light Bulbs along the top side walls of each wagon
      const wagonBulbs = [];
      const bulbGeom = new THREE.SphereGeometry(0.12, 8, 8);
      const bulbColors = [0xff3333, 0x33ff33, 0x3333ff, 0xffff33];
      const bulbColor = bulbColors[i % bulbColors.length];
      const bulbMat = new THREE.MeshStandardMaterial({
        color: bulbColor,
        emissive: bulbColor,
        emissiveIntensity: 0
      });

      const bulbPositions = [
        [-0.95, 0.4 + 0.075 + wallH, -2.0],
        [0.95, 0.4 + 0.075 + wallH, -2.0],
        [-0.95, 0.4 + 0.075 + wallH, 2.0],
        [0.95, 0.4 + 0.075 + wallH, 2.0]
      ];

      for (const pos of bulbPositions) {
        const bMesh = new THREE.Mesh(bulbGeom, bulbMat.clone());
        bMesh.position.set(pos[0], pos[1], pos[2]);
        carGroup.add(bMesh);
        wagonBulbs.push(bMesh);
      }

      // Add a Central warm PointLight underneath/inside
      const bulbCenter = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ emissive: 0xffcc66, emissiveIntensity: 0 }));
      bulbCenter.position.set(0, 0.4 + 0.075 + wallH + 0.1, 0);
      carGroup.add(bulbCenter);
      const pointLight = new THREE.PointLight(0xffcc66, 0, 10);
      pointLight.position.copy(bulbCenter.position);
      carGroup.add(pointLight);
      
      nightLights.push({ light: pointLight, mesh: bulbCenter, type: 'point', phase: i });
      nightLights.push({ type: 'wagon-bulbs', meshes: wagonBulbs, color: new THREE.Color(bulbColor), phase: i });
    }

    if (i > 0) {
      const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      coupling.rotation.x = Math.PI / 2;
      coupling.position.set(0, 0.5, -2.8); // sit on chassis height
      carGroup.add(coupling);
    }

    group.add(carGroup);
    cars.push({ mesh: carGroup, offset: i * CAR_SPACING });
  }

  // ── Control Panel ──
  const panel = new ControlPanel({
    initialRunning: true,
    onToggle: (isRunning) => { running = isRunning; },
    rampUp: 1.5,
    rampDown: 2.0,
  });
  group.add(panel.group);

  let speedScale = 1;
  let uLead = 0;
  let nightMix = 0;

  group.userData.controller = {
    panel: panel.group,
    toggle() { panel.toggle(); },
    get speedMultiplier() { return speedScale; },
    set speedMultiplier(v) { speedScale = v; },
  };

  eventBus.on('speed-scroll', ({ rideId, delta }) => {
    if (rideId === 'train') speedScale = Math.max(0.2, Math.min(1.5, speedScale + delta));
  });

  let lightColor = new THREE.Color(0xffcc66);
  eventBus.on('color-change', (hex) => { lightColor = new THREE.Color(hex); });

  const _lookTarget = new THREE.Vector3();

  group.userData.tick = (delta, time) => {
    const dt = Math.min(delta, 0.05);
    const panelEase = panel.tick(dt);
    
    nightMix += ((isNightNow(group) ? 1 : 0) - nightMix) * (1 - Math.exp(-3 * dt));

    if (panelEase > 0.01) {
      const speed = TRAIN_SPEED * speedScale * panelEase;
      uLead = (uLead + (speed / trackLength) * dt) % 1;
      if (uLead < 0) uLead += 1;
    }

    for (let i = 0; i < cars.length; i++) {
      const carU = (uLead - (cars[i].offset / trackLength) + 1) % 1;
      const pos = curve.getPointAt(carU);
      const tangent = curve.getTangentAt(carU);
      
      cars[i].mesh.position.copy(pos);
      _lookTarget.copy(pos).add(tangent);
      cars[i].mesh.lookAt(_lookTarget);

      // Tilt
      const nextTangent = curve.getTangentAt((carU + 0.001) % 1);
      const cross = new THREE.Vector3().crossVectors(tangent, nextTangent);
      cars[i].mesh.rotateZ(cross.y * 2);
    }

    for (const p of passengers) {
      updateRider(p, time);
    }

    for (const nl of nightLights) {
      if (nl.type === 'spot') {
        nl.light.intensity = nightMix * 20.0;
        nl.mesh.material.emissiveIntensity = nightMix * 2.0;
      } else if (nl.type === 'point') {
        const glow = nightMix * (0.6 + 0.4 * Math.sin(time * 3 + nl.phase));
        nl.light.intensity = glow * 8.0;
        nl.light.color.copy(lightColor);
        nl.mesh.material.emissiveIntensity = glow;
        nl.mesh.material.emissive.copy(lightColor);
      } else if (nl.type === 'wagon-bulbs') {
        const glow = nightMix * (0.6 + 0.4 * Math.sin(time * 4 + nl.phase));
        for (const mesh of nl.meshes) {
          mesh.material.emissiveIntensity = glow * 3.0;
        }
      }
    }
  };

  return group;
}

