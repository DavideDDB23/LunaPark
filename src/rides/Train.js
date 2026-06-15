import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { ControlPanel } from '../ui/ControlPanel.js';
import { eventBus } from '../utils/EventBus.js';
import { Easings } from '../utils/Easings.js';
import { isNightNow } from '../lighting/DayNightCycle.js';
import { loadGLB } from '../utils/loaders.js';

// ── CatmullRom control points for the train ring ─
const CONTROL_POINTS = [
  new THREE.Vector3(0, 5.5, -58),     // North crossing (elevated over path, well south of stage)
  new THREE.Vector3(45, 1.2, -80),    // NE inner curve (outside Carousel)
  new THREE.Vector3(82, 1.2, -82),    // NE outer corner curve
  new THREE.Vector3(92, 0.3, -40),    // East-North (near East fence)
  new THREE.Vector3(88, 3.5, -12),    // NEW: East transition (descending from East-North)
  new THREE.Vector3(72, 5.5, 12),     // NEW: East River crossing (elevated)
  new THREE.Vector3(45, 8.5, 18),     // NEW: Curve north of coaster, elevated, climbing
  new THREE.Vector3(22, 11.5, 26),    // NEW: High scenic bridge section, well north of coaster (y=11.5)
  new THREE.Vector3(15, 11.5, 34),    // NEW: High flyover heading to path crossing (y=11.5)
  new THREE.Vector3(0, 11.5, 39),     // NEW: High street crossing, elevated over central path at Z=39 (y=11.5)
  new THREE.Vector3(-6.0, 11.5, 43.5), // Sostituisci il vecchio (-3, 11.5, 40)
  new THREE.Vector3(-18, 11.5, 60),   // NEW: High curve between trees (first green circle) (y=11.5)
  new THREE.Vector3(-50, 6.5, 78),    // NEW: South-West transition (descending after first green circle)
  new THREE.Vector3(-85, 1.2, 92),    // SW outer corner curve (outside Tagada)
  new THREE.Vector3(-92, 0.3, 40),    // West-South (near West fence)
  new THREE.Vector3(-92, 5.5, 0),     // West River crossing (elevated)
  new THREE.Vector3(-92, 0.3, -40),   // West-North (near West fence, outside Ferris Wheel)
  new THREE.Vector3(-82, 1.2, -82),   // NW outer corner curve (outside Ferris Wheel)
  new THREE.Vector3(-45, 1.2, -80),   // NW inner curve (outside Ferris Wheel)
];

const TRAIN_SPEED = 6;

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
    // Also skip placing pillars inside the Roller Coaster area (X > 20, Z > 30) to avoid clipping with coaster structures,
    // and near the Shooting Gallery (around X=12, Z=24)
    if (p.y > 0.6 && Math.abs(p.x) >= 4.0 && Math.abs(p.z) >= 12.0 && !(p.x > 20.0 && p.z > 30.0) && !(Math.abs(p.x - 12.0) < 5.0 && Math.abs(p.z - 24.0) < 5.0)) {
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
    
    if (p.y > 0.6 && Math.abs(p.x) >= 4.0 && Math.abs(p.z) >= 12.0 && !(p.x > 20.0 && p.z > 30.0) && !(Math.abs(p.x - 12.0) < 5.0 && Math.abs(p.z - 24.0) < 5.0)) {
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

  // ── Load Wacky Worm Coaster Model (split into individual wagons) ──
  const cars = [];
  const nightLights = [];

  try {
    const gltf = await loadGLB('assets/models/rides/wacky_worm.glb');
    const trainModel = gltf.scene;

    // Remove track nodes (project has custom track)
    const trackNodes = [];
    trainModel.traverse((node) => {
      if (node.name && node.name.startsWith('track')) {
        trackNodes.push(node);
      }
    });
    trackNodes.forEach((node) => {
      if (node.parent) {
        node.parent.remove(node);
      }
    });

    // Reset pre-applied transforms on coaster nodes (scale=0.01, rotation quaternions)
    // Keep translations (relative positions of carriages)
    trainModel.traverse((node) => {
      if (node.isMesh) return;
      // Reset scale from 0.01 to 1.0
      if (Math.abs(node.scale.x - 0.01) < 0.001) {
        node.scale.set(1, 1, 1);
      }
      // Reset rotation to identity (clear quaternion)
      node.quaternion.identity();
      node.rotation.set(0, 0, 0);
      // Reset matrix to force recalculation
      node.matrix.identity();
      node.matrixAutoUpdate = true;
    });

    // Replace materials with standard PBR (original uses KHR_materials_pbrSpecularGlossiness with white diffuse)
    const carriageColors = {
      'coaster front': 0xcc2222,    // head - red
      'coaster back': 0x2244cc,     // first wagon - blue
      'coaster back001': 0xcccc22,  // second wagon - yellow
      'coaster back002': 0x22aa44,  // third wagon - green
      'coaster back003': 0xcc6622,  // fourth wagon - orange
    };

    // ── 1. Identify wagon nodes (direct children of RootNode, exclude track) ──
    const wagonNodes = [];
    trainModel.traverse((node) => {
      if (node.name && node.name.startsWith('coaster') && node.parent?.name === 'RootNode') {
        wagonNodes.push(node);
      }
    });

    // ── 2. Spatial sort by Z position (descending) ──
    wagonNodes.sort((a, b) => b.position.z - a.position.z);

    // ── 3. Deep-clone + zero-out transforms (fix flying wagons) ──
    const SCALE = 0.030;
    const CAR_SPACING = 4.0;
    const wagonGroups = [];

    for (const wn of wagonNodes) {
      const subtree = wn.clone(true);
      const wagonGroup = new THREE.Group();
      const wnColor = carriageColors[wn.name] ?? 0xcccccc;

      subtree.traverse((child) => {
        if (child.isMesh) {
          child.position.set(0, 0, 0);
          child.rotation.set(0, 0, 0);
          child.quaternion.identity();
          child.scale.set(1, 1, 1);
          child.matrix.identity();
          child.matrixAutoUpdate = true;
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            color: wnColor,
            roughness: 0.7,
            metalness: 0.1,
            envMapIntensity: 0,
          });
          wagonGroup.add(child);
        }
      });

      // Restore upright orientation (model authored lying down, +Z is "up" in model)
      wagonGroup.rotation.x = -Math.PI / 2;
      wagonGroup.updateMatrixWorld(true);

      // Center: X/Z at geometric center, bottom at Y=0
      const bbox = new THREE.Box3().setFromObject(wagonGroup);
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      wagonGroup.position.set(-center.x, -bbox.min.y, -center.z);

      const wrapper = new THREE.Group();
      wrapper.scale.setScalar(SCALE);
      wrapper.add(wagonGroup);
      wrapper.updateMatrixWorld(true);

      wagonGroups.push(wrapper);
    }

    // ── 5. Populate cars array with progressive offsets ──
    for (let i = 0; i < wagonGroups.length; i++) {
      group.add(wagonGroups[i]);
      cars.push({ mesh: wagonGroups[i], offset: i * CAR_SPACING });
    }

  } catch (e) {
    console.warn('Could not load wacky_worm.glb', e);
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
    cars: cars,
  };

  eventBus.on('speed-scroll', ({ rideId, delta }) => {
    if (rideId === 'train') speedScale = Math.max(0.2, Math.min(1.5, speedScale + delta));
  });

  let lightColor = new THREE.Color(0xffcc66);
  eventBus.on('color-change', (hex) => {
    const target = new THREE.Color(hex);
    new TWEEN.Tween(lightColor)
      .to(target, 500)
      .easing(Easings.COLOR)
      .start();
  });

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

    // Position each wagon along curve
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

    // No passenger updates needed (passengers are part of the model)

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

