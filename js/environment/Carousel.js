import * as THREE from 'three';
import { loadGLB, loadColorTexture, loadLinearTexture } from '../utils/loaders.js';

const HORSE_MODEL_URL = 'assets/models/carousel_horse.glb';

// Animation constants
const PLATFORM_OMEGA = 0.8;      // rad/s platform rotation at full speed
const HORSE_BOB_FREQ = 1.5;      // Bob cycles/s
const BOB_AMP = 0.6;             // Bob amplitude in meters
const HORSE_BASE_Y = 1.8;        // Default height on pole

const RAMP_UP = 1.5;             // s, ease-in
const RAMP_DOWN = 2.0;           // s, ease-out

const smoothstep = (t) => t * t * (3 - 2 * t);

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

// Procedural jockey made from simple Three.js primitives
function buildProceduralJockey(index) {
  const jockeyGroup = new THREE.Group();
  jockeyGroup.name = `jockey_${index}`;

  const colors = [0x3a86c8, 0xc83a3a, 0x3ac85c, 0xc8a23a, 0x863ac8, 0x3ac8b8, 0xc86a3a, 0x8bc83a];
  const jacketColor = colors[index % colors.length];

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.5, metalness: 0.1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.6 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.2, metalness: 0.7 });
  const goggleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.1, metalness: 0.9 });

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.32, 8), jacketMat);
  torso.position.y = 0.16;
  torso.castShadow = true;
  jockeyGroup.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), skinMat);
  head.position.y = 0.36;
  head.castShadow = true;
  jockeyGroup.add(head);

  // Helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), helmetMat);
  helmet.position.y = 0.375;
  helmet.rotation.x = 0.15;
  helmet.castShadow = true;
  jockeyGroup.add(helmet);

  // Visor / Goggles
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.06), goggleMat);
  visor.position.set(0, 0.38, 0.05);
  jockeyGroup.add(visor);

  // Left leg
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 6), pantsMat);
  leftThigh.position.set(-0.08, 0.08, -0.02);
  leftThigh.rotation.z = Math.PI / 4;
  leftThigh.rotation.x = -Math.PI / 6;
  jockeyGroup.add(leftThigh);
  
  const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.18, 6), pantsMat);
  leftShin.position.set(-0.14, -0.04, 0.02);
  leftShin.rotation.x = Math.PI / 6;
  jockeyGroup.add(leftShin);
  
  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), bootMat);
  leftBoot.position.set(-0.14, -0.13, 0.04);
  jockeyGroup.add(leftBoot);

  // Right leg
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 6), pantsMat);
  rightThigh.position.set(0.08, 0.08, -0.02);
  rightThigh.rotation.z = -Math.PI / 4;
  rightThigh.rotation.x = -Math.PI / 6;
  jockeyGroup.add(rightThigh);
  
  const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.18, 6), pantsMat);
  rightShin.position.set(0.14, -0.04, 0.02);
  rightShin.rotation.x = Math.PI / 6;
  jockeyGroup.add(rightShin);
  
  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), bootMat);
  rightBoot.position.set(0.14, -0.13, 0.04);
  jockeyGroup.add(rightBoot);

  // Arms leaning forward (grasping the pole)
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), jacketMat);
  leftArm.position.set(-0.09, 0.2, 0.07);
  leftArm.rotation.x = Math.PI / 3;
  leftArm.rotation.z = -Math.PI / 8;
  jockeyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), jacketMat);
  rightArm.position.set(0.09, 0.2, 0.07);
  rightArm.rotation.x = Math.PI / 3;
  rightArm.rotation.z = Math.PI / 8;
  jockeyGroup.add(rightArm);

  return jockeyGroup;
}

export async function buildCarousel({ position = [40, 0, -40], camera, renderer, anisotropy = 8 } = {}) {
  // Load horse GLB
  const gltf = await loadGLB(HORSE_MODEL_URL);
  const rawHorse = gltf.scene;

  // Configure raw model shadows
  rawHorse.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Calculate horse bounding box and scale
  const horseBbox = new THREE.Box3().setFromObject(rawHorse);
  const horseSize = new THREE.Vector3();
  horseBbox.getSize(horseSize);
  const targetHorseY = 2.4; // target height in world units
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

  // Platform: Cylinder of radius 12, thickness 0.6
  const platformMesh = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.6, 48), platformMat);
  platformMesh.position.y = 0.3; // resting on ground
  platformMesh.receiveShadow = true;
  platformMesh.castShadow = true;
  rotatingAssembly.add(platformMesh);

  // Gold platform trim
  const trimMesh = new THREE.Mesh(new THREE.CylinderGeometry(12.05, 12.05, 0.15, 48), goldMat);
  trimMesh.position.y = 0.3;
  rotatingAssembly.add(trimMesh);

  // Central column: Mirror-finished main support cylinder
  const columnMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 5.5, 24), mirrorMat);
  columnMesh.position.y = 0.3 + 0.3 + 2.75; // above base
  columnMesh.castShadow = true;
  columnMesh.receiveShadow = true;
  rotatingAssembly.add(columnMesh);

  // Column gold moldings (decorative bands)
  const bottomBand = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.4, 24), goldMat);
  bottomBand.position.y = 0.3 + 0.3 + 0.2;
  rotatingAssembly.add(bottomBand);

  const topBand = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.4, 24), goldMat);
  topBand.position.y = 0.3 + 0.3 + 5.3;
  rotatingAssembly.add(topBand);

  // Canopy conical roof: Cone of radius 13, height 3.5
  const canopyMesh = new THREE.Mesh(new THREE.ConeGeometry(13.2, 3.5, 32), canopyMat);
  canopyMesh.position.y = 0.3 + 0.3 + 5.5 + 1.75;
  canopyMesh.castShadow = true;
  canopyMesh.receiveShadow = true;
  rotatingAssembly.add(canopyMesh);

  // Canopy valance/rim
  const canopyRim = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 13.2, 0.4, 32), goldMat);
  canopyRim.position.y = 0.3 + 0.3 + 5.5;
  canopyRim.castShadow = true;
  rotatingAssembly.add(canopyRim);

  // ── Poles & Horses ──
  const horses = [];
  const poles = [];
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
    bulb.position.set(13.22 * Math.cos(angle), 0.3 + 0.3 + 5.5, 13.22 * Math.sin(angle));
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

    // Vertical pole (gold): Cylinder of radius 0.08, height 5.8
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5.8, 8), goldMat);
    pole.position.y = 2.9; // centered on mount
    pole.castShadow = true;
    mountGroup.add(pole);
    poles.push(pole);

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

    // Add jockey sitting on the horse
    const jockey = buildProceduralJockey(i);
    // Position jockey on horse back
    jockey.position.set(0.0, 0.28, -0.05); // local coordinates relative to horse center
    jockey.rotation.y = Math.PI; // Face forward along with horse (raw horse faces backward compared to rider bind)
    jockey.scale.setScalar(2.4);
    horseContainer.add(jockey);

    horses.push({
      container: horseContainer,
      phaseOffset: i * (Math.PI / 4) // phase-offset wave pattern
    });
  }

  // ── Control Panel (semaphore + lever) ──
  const panel = buildControlPanel();
  panel.position.set(-15, 0, 0); // West of carousel platform
  group.add(panel);
  panel.lookAt(0, 1.35, 0); // face the carousel column center

  // ── Controller / State ──
  const controller = {
    rotatingAssembly,
    horses,
    panel,
    running: true,         // auto-start
    angle: 0,
    phase: 0,              // speed multiplier [0, 1]
    maxSpeed: PLATFORM_OMEGA,
    toggle() { this.running = !this.running; },
    start() { this.running = true; },
    stop() { this.running = false; },
    setSpeed(v) { this.maxSpeed = Math.max(0, v); },
  };

  group.userData.tick = (delta, time) => {
    // Gradual start/stop transitions
    const dur = controller.running ? RAMP_UP : RAMP_DOWN;
    controller.phase = THREE.MathUtils.clamp(
      controller.phase + (controller.running ? 1 : -1) * (delta / dur), 0, 1
    );
    const ease = smoothstep(controller.phase);

    // 1. Platform rotation
    controller.angle += controller.maxSpeed * ease * delta;
    rotatingAssembly.rotation.y = controller.angle;

    // 2. Horse bobbing (each horse has phase offset)
    const speed = controller.maxSpeed * ease;
    for (const h of horses) {
      const wave = Math.sin(time * HORSE_BOB_FREQ + h.phaseOffset) * BOB_AMP;
      h.container.position.y = HORSE_BASE_Y + wave * ease;
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

    // 4. Panel feedback update
    panel.userData.setState(ease);
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
      return ray.intersectObject(panel, true).length > 0;
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

// ── 3D Control Panel Geometry ──
function buildControlPanel() {
  const g = new THREE.Group();
  g.name = 'carousel_controlPanel';

  const metal = new THREE.MeshStandardMaterial({ color: 0x3d4452, roughness: 0.5, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.7, metalness: 0.3 });

  // Post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 12), metal);
  post.position.y = 0.55;
  post.castShadow = true;
  g.add(post);

  // Slanted Console
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.18), dark);
  console_.position.y = 1.35;
  console_.rotation.x = -0.5;
  console_.castShadow = true;
  g.add(console_);

  // Semaphore housing
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, 0.2), dark);
  housing.position.set(0.0, 2.0, -0.05);
  housing.castShadow = true;
  g.add(housing);

  // Semaphore lights
  const redMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff2222, emissiveIntensity: 1.0 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x003a00, emissive: 0x22ff44, emissiveIntensity: 0.0 });
  const lampGeo = new THREE.SphereGeometry(0.12, 14, 12);
  
  const red = new THREE.Mesh(lampGeo, redMat);
  red.position.set(0, 2.18, 0.06);
  g.add(red);
  
  const green = new THREE.Mesh(lampGeo, greenMat);
  green.position.set(0, 1.86, 0.06);
  g.add(green);

  // Control Lever
  const lever = new THREE.Group();
  lever.position.set(0.0, 1.5, 0.12);
  g.add(lever);
  
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8), metal);
  stick.position.y = 0.27;
  stick.castShadow = true;
  lever.add(stick);
  
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 }));
  knob.position.y = 0.55;
  lever.add(knob);

  const LEVER_REST = -0.5;
  const LEVER_ON = 0.6;
  lever.rotation.x = LEVER_REST;

  g.userData.setState = (ease) => {
    redMat.emissiveIntensity = 1.0 - ease;
    greenMat.emissiveIntensity = ease;
    lever.rotation.x = THREE.MathUtils.lerp(LEVER_REST, LEVER_ON, ease);
  };

  return g;
}
