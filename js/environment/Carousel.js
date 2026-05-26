import * as THREE from 'three';
import { loadGLB, loadColorTexture, loadLinearTexture } from '../utils/loaders.js';
import { loadVisitorTemplates, makeRider, updateRider, ACTIONS_SEATED_GENERAL, getPassengerWorldHeight } from './Passengers.js';
import { ControlPanel } from './ControlPanel.js';

const HORSE_MODEL_URL = 'assets/models/carousel_horse.glb';

// Animation constants
const PLATFORM_OMEGA = 0.8;      // rad/s platform rotation at full speed
const HORSE_BOB_FREQ = 1.5;      // Bob cycles/s
const BOB_AMP = 0.9;            // Bob amplitude in meters
const HORSE_BASE_Y = 2.53;       // Default height on pole

// Procedural texture for the canopy (stripes of deep red and cream white separated by gold lines)
function createStripedTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  const stripeWidth = 256 / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#a82c2c' : '#fcfaf2';
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, 256);
  }
  
  // Gold dividers
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * stripeWidth, 0);
    ctx.lineTo(i * stripeWidth, 256);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export async function buildCarousel({ position = [40, 0, -40], camera, renderer, anisotropy = 8 } = {}) {
  // Load horse GLB and visitor templates in parallel
  const [gltf, visitors] = await Promise.all([
    loadGLB(HORSE_MODEL_URL),
    loadVisitorTemplates(8)
  ]);
  const rawHorse = gltf.scene;

  // Filter out kimono models which have single-skirt geometry and cannot spread their legs
  const carouselVisitors = visitors ? visitors.filter(v => !v.name.toLowerCase().includes('kimono')) : [];
  const activeVisitors = carouselVisitors.length > 0 ? carouselVisitors : visitors;

  // Configure raw model shadows
  rawHorse.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  hideEmbeddedPole(rawHorse);

  // Calculate horse bounding box and scale
  const horseBbox = new THREE.Box3().setFromObject(rawHorse);
  const horseSize = new THREE.Vector3();
  horseBbox.getSize(horseSize);
  const targetHorseY = 4.0; // target height in world units
  const horseScale = horseSize.y > 0 ? targetHorseY / horseSize.y : 1;

  // Find center of horse to offset it correctly
  const horseCenter = new THREE.Box3().setFromObject(rawHorse).getCenter(new THREE.Vector3());

  // Carousel materials
  // Platform: Painted Red Wood
  const woodColor = loadColorTexture('assets/textures/PaintedWood003_2K-JPG/PaintedWood003_2K-JPG_Color.jpg', { repeat: [2, 2], anisotropy });
  const woodNormal = loadLinearTexture('assets/textures/PaintedWood003_2K-JPG/PaintedWood003_2K-JPG_NormalGL.jpg', { repeat: [2, 2], anisotropy });
  const woodRough = loadLinearTexture('assets/textures/PaintedWood003_2K-JPG/PaintedWood003_2K-JPG_Roughness.jpg', { repeat: [2, 2], anisotropy });
  
  const platformMat = new THREE.MeshStandardMaterial({
    map: woodColor,
    normalMap: woodNormal,
    roughnessMap: woodRough,
    color: 0xaa2b2b, // tinted red wood
    roughness: 0.9,
    metalness: 0.1
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.9,
    roughness: 0.15
  });

  const canopyStripes = createStripedTexture();
  const canopyMat = new THREE.MeshStandardMaterial({
    map: canopyStripes,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    metalness: 0.95,
    roughness: 0.05
  });

  // ── Scene Hierarchy ──
  const group = new THREE.Group();
  group.name = 'carousel';
  group.position.set(position[0], position[1], position[2]);

  // Main rotating assembly (platform + canopy + center column + horses)
  const rotatingAssembly = new THREE.Group();
  rotatingAssembly.name = 'carousel_rotating_assembly';
  group.add(rotatingAssembly);

  // Platform: Cylinder of radius 12.0, thickness 0.6
  const platformMesh = new THREE.Mesh(new THREE.CylinderGeometry(12.0, 12.0, 0.6, 48), platformMat);
  platformMesh.position.y = 0.3; // resting on ground
  platformMesh.receiveShadow = true;
  platformMesh.castShadow = true;
  rotatingAssembly.add(platformMesh);

  // Gold platform trim
  const trimMesh = new THREE.Mesh(new THREE.CylinderGeometry(12.05, 12.05, 0.15, 48), goldMat);
  trimMesh.position.y = 0.3;
  rotatingAssembly.add(trimMesh);

  // Central column: Mirror-finished main support cylinder (radius 2.0, height 6.3) resting on platform surface, touching canopy underside
  const columnMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 6.3, 24), mirrorMat);
  columnMesh.position.y = 0.6 + 3.15; // centered: bottom at y=0.6 (platform surface), top at y=6.9 (canopy rim bottom)
  columnMesh.castShadow = true;
  columnMesh.receiveShadow = true;
  rotatingAssembly.add(columnMesh);

  // Column gold moldings (decorative bands)
  const bottomBand = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.2, 24), goldMat);
  bottomBand.position.y = 0.6 + 0.1; // base of column, on platform surface
  rotatingAssembly.add(bottomBand);

  const topBand = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.2, 24), goldMat);
  topBand.position.y = 6.9 - 0.1; // top of column
  rotatingAssembly.add(topBand);

  // Canopy conical roof: Cone of radius 13.2, height 3.5
  const canopyMesh = new THREE.Mesh(new THREE.ConeGeometry(13.2, 3.5, 32), canopyMat);
  canopyMesh.position.y = 0.3 + 0.3 + 5.5 + 1.75 + 1.0; // 0.6 + 5.5 + 1.75 + 1.0 = 8.85
  canopyMesh.castShadow = true;
  canopyMesh.receiveShadow = true;
  rotatingAssembly.add(canopyMesh);

  // Canopy valance/rim
  const canopyRim = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 13.2, 0.4, 32), goldMat);
  canopyRim.position.y = 0.3 + 0.3 + 5.5 + 1.0; // 0.6 + 5.5 + 1.0 = 7.1
  canopyRim.castShadow = true;
  rotatingAssembly.add(canopyRim);

  // ── Poles & Horses ──
  const horses = [];

  const poleRadius = 8.5; // distance from center

  // Build emissive bulbs for night lighting
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffdd88,
    emissive: 0xffdd88,
    emissiveIntensity: 0.0, // off by day
    roughness: 0.1
  });

  // Bulbs along canopy rim
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(13.22 * Math.cos(angle), 0.3 + 0.3 + 5.5 + 1.0, 13.22 * Math.sin(angle));
    rotatingAssembly.add(bulb);
    bulbs.push(bulb);
  }

  // Model offset rotation: Sketchfab GLB horses are facing -X, so we add Math.PI * 0.5 to rotate them forward (tangential)
  const MODEL_ROTATION_OFFSET = Math.PI * 0.5;

  for (let i = 0; i < 8; i++) {
    const angle = i * (Math.PI / 4);

    // Group for pole and horse to sit in, positioned on platform
    const mountGroup = new THREE.Group();
    mountGroup.name = `mount_group_${i}`;
    mountGroup.position.set(poleRadius * Math.cos(angle), 0.6, poleRadius * Math.sin(angle));
    
    // Rotate mount to orient horse tangentially
    mountGroup.rotation.y = -angle + MODEL_ROTATION_OFFSET;
    rotatingAssembly.add(mountGroup);

    // Stationary pole (gold) — horse slides up/down on it via horseContainer bobbing.
    // Slightly thicker than GLB's built-in pole to conceal it during bob.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 7.2, 12), goldMat
    );
    pole.position.y = 3.6; // centered: spans Y 0–7.2 in mountGroup space
    pole.castShadow = true;
    mountGroup.add(pole);

    // Horse container group (for Y-bobbing)
    const horseContainer = new THREE.Group();
    horseContainer.name = `horse_container_${i}`;
    mountGroup.add(horseContainer);

    // Cloned horse mesh
    const horse = rawHorse.clone(true);
    horse.name = `horse_mesh_${i}`;
    horse.scale.setScalar(horseScale);
    // Center model geometry offset
    horse.position.copy(horseCenter).multiplyScalar(-horseScale);
    horseContainer.add(horse);

    // Add Quaternius human rider sitting on the horse
    if (activeVisitors && activeVisitors.length > 0) {
      const tmpl = activeVisitors[i % activeVisitors.length];
      const currentHeight = getPassengerWorldHeight();
      const rider = makeRider(tmpl, currentHeight, {
        pool: ACTIONS_SEATED_GENERAL,
        facingY: 0,
        phase: i * (Math.PI / 4)
      });
      rider.index = i;
      
      // Position rider realistically on the horse saddle:
      // Since rider origin is at the feet, we offset the pivot so that the rider's
      // hips (approx 28% of height) align with the horse's saddle
      const saddleHeight = 0.48 * (targetHorseY / 2.4);
      const riderY = saddleHeight - currentHeight * 0.28;
      const riderZ = -0.10 * (targetHorseY / 2.4);
      rider.pivot.position.set(-0.3, riderY, riderZ); // offset toward tail, away from pole axis
      
      // Update skeleton matrix to compute correct bone positions
      rider.fig.updateMatrixWorld(true);
      
      const scale = currentHeight / tmpl.height;
      const targetHipX = 0.32 + 0.35 * scale;
      
      const hipBone = rider.fig.getObjectByName('Hips');
      if (hipBone) {
        const localHip = new THREE.Vector3();
        hipBone.getWorldPosition(localHip);
        rider.fig.worldToLocal(localHip);
        
        // Scale the local hip offset by the rider's scale factor
        const scaledHip = localHip.clone().multiplyScalar(scale);
        
        // Since rider.fig has rotation.y = -Math.PI / 2 (aligning rider +Z with horse -X),
        // we rotate scaledHip vector by -Math.PI / 2 around Y axis to get its position in pivot space
        const hipInPivot = scaledHip.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        
        // We want the Hips bone (hips/pelvis) to sit exactly at (targetHipX, saddleHeight, 0.0) in the horse container space.
        // Therefore, we position the pivot such that: pivot.position + hipInPivot = (targetHipX, saddleHeight, 0.0)
        rider.pivot.position.set(targetHipX - hipInPivot.x, saddleHeight - hipInPivot.y, -hipInPivot.z);
        
      } else {
        const riderY = saddleHeight - currentHeight * 0.28;
        rider.pivot.position.set(targetHipX, riderY, 0.0);
      }
      
      rider.pivot.rotation.y = - Math.PI / 2; // Face forward along with horse (aligns rider +Z with horse -X)
      rider.height = currentHeight;
      horseContainer.add(rider.pivot);

      horses.push({
        container: horseContainer,
        rider: rider,
        phaseOffset: i * (Math.PI / 4) // phase-offset wave pattern
      });
    } else {
      horses.push({
        container: horseContainer,
        rider: null,
        phaseOffset: i * (Math.PI / 4)
      });
    }
  }

  // ── Control Panel (semaphore + lever) ──
  const controlPanel = new ControlPanel({ initialRunning: true });
  controlPanel.group.position.set(-15, 0, 15); // Southwest of carousel, toward park center (mirrors FerrisWheel panel)
  group.add(controlPanel.group);
  controlPanel.group.lookAt(0, 1.35, 0); // controls face the park center (where the operator approaches from)

  // ── Controller / State ──
  const controller = {
    rotatingAssembly,
    horses,
    panel: controlPanel.group,
    get running() { return controlPanel.running; },
    set running(v) { controlPanel.running = v; },
    angle: 0,
    maxSpeed: PLATFORM_OMEGA,
    toggle() { controlPanel.toggle(); },
    start() { controlPanel.running = true; },
    stop() { controlPanel.running = false; },
    setSpeed(v) { this.maxSpeed = Math.max(0, v); },
  };

  group.userData.tick = (delta, time) => {
    // Gradual start/stop transitions driven by the shared ControlPanel
    const ease = controlPanel.tick(delta);

    // 1. Platform rotation
    controller.angle += controller.maxSpeed * ease * delta;
    rotatingAssembly.rotation.y = - controller.angle;

    // 2. Horse bobbing (each horse has phase offset) and rider updates
    const speed = controller.maxSpeed * ease;
    const platformY = 0.6;
    const maxWorldHeadY = 6.8;
    for (const h of horses) {
      const wave = (Math.sin(time * HORSE_BOB_FREQ + h.phaseOffset) + 1.0) * BOB_AMP;
      
      let maxContainerY = Infinity;
      if (h.rider) {
        const riderY = h.rider.pivot.position.y;
        const riderHeight = h.rider.height;
        maxContainerY = maxWorldHeadY - platformY - (riderY + riderHeight);
      }
      
      const targetY = (HORSE_BASE_Y - BOB_AMP) + wave * ease;
      // Clamp at bottom (targetHorseY / 2) to prevent ground clipping, and at top (maxContainerY) to prevent ceiling clipping
      h.container.position.y = Math.max(targetHorseY / 2.0, Math.min(targetY, maxContainerY));
      
      if (h.rider) {
        updateRider(h.rider, time + h.rider.phase);
      }
    }

    // 3. Emissive bulbs blink at night (read night state from scene lights)
    const sun = group.parent?.parent?.getObjectByName('sun') || group.parent?.getObjectByName('sun');
    const isNight = sun ? (sun.position.y < 5.0 || sun.intensity < 0.5) : false;

    if (isNight) {
      // Blinking bulbs with phase offsets
      bulbs.forEach((b, idx) => {
        const pulse = Math.sin(time * 5.0 + idx * 0.4) * 0.5 + 0.5; // [0, 1]
        b.material.emissiveIntensity = 1.0 + pulse * 1.5; // warm pulse
      });
    } else {
      bulbs.forEach((b) => {
        b.material.emissiveIntensity = 0.0;
      });
    }

    // 4. Panel feedback update (handled by ControlPanel.tick)
  };

  // ── Raycast Toggle Handler ──
  if (camera && renderer) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dom = renderer.domElement;

    const pick = (ev) => {
      const r = dom.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(controlPanel.group, true).length > 0;
    };

    dom.addEventListener('pointerdown', (ev) => {
      if (pick(ev)) controller.toggle();
    });

    dom.addEventListener('pointermove', (ev) => {
      if (pick(ev)) dom.style.cursor = 'pointer';
      else if (dom.style.cursor === 'pointer') dom.style.cursor = '';
    });
  }

  group.userData.controller = controller;
  return group;
}

function hideEmbeddedPole(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geom = o.geometry;
    
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;

    const normalAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');
    const tangentAttr = geom.getAttribute('tangent');

    const keptIndices = [];
    const newPositions = [];
    const newNormals = [];
    const newUvs = [];
    const newTangents = [];

    const indexMap = new Map();
    let newIdx = 0;
    
    const vertexCount = posAttr.count;
    for (let i = 0; i < vertexCount; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      
      // The pole is centered at (0, 0) in local X-Y, with radius approx 3.683.
      // We filter out any vertices that are close to the pole axis (X^2 + Y^2 < 4.5^2).
      const isPole = (x * x + y * y < 4.5 * 4.5);
      if (!isPole) {
        newPositions.push(x, y, z);
        if (normalAttr) {
          newNormals.push(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
        }
        if (uvAttr) {
          newUvs.push(uvAttr.getX(i), uvAttr.getY(i));
        }
        if (tangentAttr) {
          newTangents.push(tangentAttr.getX(i), tangentAttr.getY(i), tangentAttr.getZ(i), tangentAttr.getW(i));
        }
        indexMap.set(i, newIdx++);
      }
    }
    
    const indexAttr = geom.getIndex();
    const newIndexData = [];
    if (indexAttr) {
      const arr = indexAttr.array;
      const len = arr.length;
      for (let i = 0; i < len; i += 3) {
        const idx0 = arr[i];
        const idx1 = arr[i + 1];
        const idx2 = arr[i + 2];
        if (indexMap.has(idx0) && indexMap.has(idx1) && indexMap.has(idx2)) {
          newIndexData.push(indexMap.get(idx0), indexMap.get(idx1), indexMap.get(idx2));
        }
      }
    }
    
    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    if (newNormals.length > 0) {
      newGeom.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
    }
    if (newUvs.length > 0) {
      newGeom.setAttribute('uv', new THREE.Float32BufferAttribute(newUvs, 2));
    }
    if (newTangents.length > 0) {
      newGeom.setAttribute('tangent', new THREE.Float32BufferAttribute(newTangents, 4));
    }
    if (newIndexData.length > 0) {
      newGeom.setIndex(newIndexData);
    }
    
    newGeom.computeBoundingBox();
    newGeom.computeBoundingSphere();
    
    o.geometry = newGeom;
  });
}
