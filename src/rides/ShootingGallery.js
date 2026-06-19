import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { makeRider, updateRider, pose } from '../people/Passengers.js';

export async function buildShootingGallery({ camera, renderer, controls }) {
  const group = new THREE.Group();
  group.name = 'shootingGallery';

  // ── Load prize and character models asynchronously ──
  let duckGltf, bearGltf, bunnyGltf, rabbitGltf, workerGltf, gunGltf, bulletGltf;
  try {
    [duckGltf, bearGltf, bunnyGltf, rabbitGltf, workerGltf, gunGltf, bulletGltf] = await Promise.all([
      loadGLB('assets/models/prizes/duck_plush.glb'),
      loadGLB('assets/models/prizes/low_poly_asset_teddy_bear.glb'),
      loadGLB('assets/models/prizes/low_poly_bunny_plush_toy.glb'),
      loadGLB('assets/models/prizes/rabbit_plush__conejo_peluche.glb'),
      loadGLB('assets/models/people/Cowboy_Male.gltf'),
      loadGLB('assets/models/9mm_pistol_low_poly_gun.glb'),
      loadGLB('assets/models/9mm_bullet_low_poly.glb')
    ]);
  } catch (err) {
    console.warn("Failed to load models", err);
  }


  // ── Helper to create customized prize versions ──
  function createPrize(type, { tint, scale = 1.0, position, rotation }) {
    let baseScene;
    if (type === 'duck') baseScene = duckGltf?.scene;
    else if (type === 'bear') baseScene = bearGltf?.scene;
    else if (type === 'bunny') baseScene = bunnyGltf?.scene;
    else if (type === 'rabbit') baseScene = rabbitGltf?.scene;
    
    if (!baseScene) return null;
    
    const clone = baseScene.clone();
    
    clone.traverse((o) => {
      if (o.isMesh && o.material) {
        if (Array.isArray(o.material)) {
          o.material = o.material.map(m => m.clone());
        } else {
          o.material = o.material.clone();
        }
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const rawHeight = size.y;
    
    const targetHeight = 0.8;
    const baseScale = rawHeight > 0 ? targetHeight / rawHeight : 1.0;
    
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    
    clone.scale.setScalar(baseScale);
    clone.position.set(-center.x * baseScale, -bbox.min.y * baseScale, -center.z * baseScale);
    
    wrapper.scale.setScalar(scale);
    if (position) wrapper.position.fromArray(position);
    if (rotation) wrapper.rotation.fromArray(rotation);
    
    if (tint) {
      const colors = {
        red: 0xdd3b3b,
        blue: 0x3b6ddd,
        yellow: 0xddb63b
      };
      const tintColor = new THREE.Color(colors[tint] || tint);
      wrapper.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mat) => {
            const name = (mat.name || '').toLowerCase();
            if (name.includes('eye') || name.includes('nose') || name.includes('teeth') || name.includes('blush')) {
              return;
            }
            if (mat.color.r < 0.05 && mat.color.g < 0.05 && mat.color.b < 0.05) {
              return;
            }
            mat.color.copy(tintColor);
          });
        }
      });
    }
    
    return wrapper;
  }

  function createHangingString(x, y, z, length) {
    const stringGeo = new THREE.CylinderGeometry(0.008, 0.008, length, 4);
    const stringMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.position.set(x, y - length / 2, z);
    stringMesh.castShadow = true;
    return stringMesh;
  }

  // ── Shelf geometry: plushies sitting on the shelf and hung on the back wall ──
  const SHELF_Y = 1.75;      // shelf surface height
  const SHELF_Z = -1.5;      // pushed back onto the counter
  const WALL_HANG_Y = 2.65;  // hung row above shelf
  const WALL_HANG_Z = -2.2;  // against the face of the back wall

  const SHELF_Z_BACK = -2;
  const SHELF_Z_FRONT = -1.4;

  const prizeSpecs = [
    // ── ROW 1: Plush toys sitting ON the shelf (Back Row) ──
    { type: 'duck',   tint: 'red',    scale: 1.2, position: [-2.4, SHELF_Y, SHELF_Z_BACK], rotation: [0, 0.2, 0] },
    { type: 'bear',                    scale: 1.2, position: [-1.4, SHELF_Y, SHELF_Z_BACK], rotation: [0, -0.15, 0] },
    { type: 'rabbit', tint: 'yellow',  scale: 1.2, position: [-0.4, SHELF_Y, SHELF_Z_BACK], rotation: [0, 0.1, 0] },
    { type: 'bunny',                   scale: 1.2, position: [0.4,  SHELF_Y, SHELF_Z_BACK], rotation: [0, -0.1, 0] },
    { type: 'duck',                    scale: 1.2, position: [1.4,  SHELF_Y, SHELF_Z_BACK], rotation: [0, 0.15, 0] },
    { type: 'bear',   tint: 'blue',    scale: 1.2, position: [2.4,  SHELF_Y, SHELF_Z_BACK], rotation: [0, -0.2, 0] },

    // ── ROW 2: Plush toys sitting ON the shelf (Front Row) ──
    { type: 'bunny',  tint: 'blue',    scale: 1.1, position: [-1.8, SHELF_Y, SHELF_Z_FRONT], rotation: [0, 0.1, 0] },
    { type: 'duck',   tint: 'yellow',  scale: 1.1, position: [-0.9, SHELF_Y, SHELF_Z_FRONT], rotation: [0, -0.05, 0] },
    { type: 'bear',   tint: 'red',     scale: 1.1, position: [0.0,  SHELF_Y, SHELF_Z_FRONT], rotation: [0, 0.05, 0] },
    { type: 'rabbit',                  scale: 1.1, position: [0.9,  SHELF_Y, SHELF_Z_FRONT], rotation: [0, -0.1, 0] },
    { type: 'duck',                    scale: 1.1, position: [1.8,  SHELF_Y, SHELF_Z_FRONT], rotation: [0, 0.12, 0] },

    // ── ROW 2: Plush toys hanging on the wall above the shelf ──
    { type: 'bear',   tint: 'red',     scale: 0.7, position: [-2.0, WALL_HANG_Y, WALL_HANG_Z], rotation: [0, 0.1, 0], hang: true },
    { type: 'bunny',  tint: 'yellow',  scale: 0.7, position: [-1.0, WALL_HANG_Y, WALL_HANG_Z], rotation: [0, -0.08, 0], hang: true },
    { type: 'duck',                    scale: 0.7, position: [0.0,  WALL_HANG_Y, WALL_HANG_Z], rotation: [0, 0.05, 0], hang: true },
    { type: 'rabbit', tint: 'blue',    scale: 0.7, position: [1.0,  WALL_HANG_Y, WALL_HANG_Z], rotation: [0, -0.05, 0], hang: true },
    { type: 'bear',                    scale: 0.7, position: [2.0,  WALL_HANG_Y, WALL_HANG_Z], rotation: [0, 0.12, 0], hang: true },

    // Giant versions sitting on the floor flanking the booth outside
    { type: 'bear', scale: 1.8, position: [-3.6, 0.0, 1.5], rotation: [0, 0.5, 0] },
    { type: 'duck', scale: 1.8, position: [3.6, 0.0, 1.5], rotation: [0, -0.5, 0] },
  ];

  if (duckGltf && bearGltf && bunnyGltf && rabbitGltf) {
    const CEILING_Y = 3.6;
    prizeSpecs.forEach(spec => {
      const prize = createPrize(spec.type, {
        tint: spec.tint,
        scale: spec.scale,
        position: spec.position,
        rotation: spec.rotation
      });
      if (prize) {
        group.add(prize);
        if (spec.hang) {
          const px = spec.position[0];
          const py = spec.position[1];
          const pz = spec.position[2];
          const prizeHeight = 0.8 * spec.scale;
          const topY = py + prizeHeight;
          const stringLength = CEILING_Y - topY;
          if (stringLength > 0) {
            const stringMesh = createHangingString(px, CEILING_Y, pz, stringLength);
            group.add(stringMesh);
          }
        }
      }
    });
  }

  // ── Build booth structure ──
  let boothModel;
  try {
    const gltf = await loadGLB('assets/models/environment/food_stall.glb');
    boothModel = gltf.scene;
    sanitizeMaterials(boothModel);
    
    // Scale and position the booth
    const bbox = new THREE.Box3().setFromObject(boothModel);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    const targetHeight = 4.5;
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    
    // Rotate 90 degrees (-Math.PI / 2) so it opens towards +Z (the player)
    boothModel.scale.setScalar(scale);
    boothModel.rotation.y = -Math.PI / 2;
    
    // Compute local matrix to get accurate bounding box and center of the rotated model
    boothModel.updateMatrix();
    boothModel.matrixWorld.copy(boothModel.matrix);
    
    const bboxRotated = new THREE.Box3().setFromObject(boothModel);
    const centerRotated = new THREE.Vector3();
    bboxRotated.getCenter(centerRotated);
    
    // Position the rotated booth so it is centered on X and Z, and sits on the ground at Y=0
    boothModel.position.set(-centerRotated.x, -bboxRotated.min.y, -centerRotated.z);
    
    boothModel.traverse((o) => {
      if (o.isMesh) {
        if (o.name.toLowerCase().includes('text') || o.name.toLowerCase().includes('sign')) {
          o.visible = false;
        } else {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      }
    });
    group.add(boothModel);
  } catch (e) {
    console.warn("Failed to load stylized_carnival_booth.glb, using procedural fallback", e);
    
    // Procedural fallback
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.8, side: THREE.DoubleSide });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });

    const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 1.5), woodMat);
    counter.position.set(0, 0.5, 0);
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.3), woodMat);
    backWall.position.set(0, 2, -0.9);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    for (const [rx, rz] of [[-1.5, -0.5], [1.5, -0.5]]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 2.5), canvasMat);
      roof.position.set(rx, 3.5, rz);
      roof.rotation.x = -0.15;
      roof.castShadow = true;
      group.add(roof);
    }

    for (const [px, pz] of [[-2.8, -1], [2.8, -1], [-2.8, 0.5], [2.8, 0.5]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), poleMat);
      pole.position.set(px, 1.5, pz);
      pole.castShadow = true;
      group.add(pole);
    }

    for (const sx of [-2.9, 2.9]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 1.5), woodMat);
      side.position.set(sx, 1.75, -0.25);
      side.castShadow = true;
      group.add(side);
    }
  }

  // ── Targets – raised well above the counter so they’re fully visible ──
  const targets = [];
  const rows = [
    { z: 0.2,   y: 2.05, speed: 0.8, direction: 1, multiplier: 1, count: 3 },  // Front row
    { z: -0.2,  y: 2.50, speed: 1.4, direction: -1, multiplier: 2, count: 4 }, // Middle row
    { z: -0.5,  y: 2.95, speed: 2.0, direction: 1, multiplier: 3, count: 4 }   // Back row
  ];

  const bound = 2.8;
  const trackWidth = bound * 2; // 5.6

  for (const row of rows) {
    const spacing = trackWidth / row.count;
    for (let i = 0; i < row.count; i++) {
      // Space them evenly across the track width
      const tx = -bound + (i * spacing) + (spacing / 2);
      const ty = row.y;
      const tz = row.z;

      const targetGroup = new THREE.Group();
      targetGroup.position.set(tx, ty, tz);

      // Outer ring (1pt)
      const outer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x000000 })
      );
      outer.rotation.x = -Math.PI / 2;
      targetGroup.add(outer);

      // Middle ring (5pt)
      const mid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 })
      );
      mid.rotation.x = -Math.PI / 2;
      targetGroup.add(mid);

      // Center (10pt)
      const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.07, 16),
        new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x000000 })
      );
      center.rotation.x = -Math.PI / 2;
      targetGroup.add(center);

      group.add(targetGroup);
      targets.push({
        group: targetGroup,
        meshes: [outer, mid, center],
        hit: false,
        hitTime: 0,
        points: [1, 5, 10],
        speed: row.speed,
        direction: row.direction,
        multiplier: row.multiplier,
        rowZ: row.z,
        omega: 0,
      });
    }
  }

  // ── Sophisticated interior lighting ──
  const galleryLights = [];  // track animated lights for tick()
  {
    // ─── 1. Warm overhead spots directed precisely at the shelves ───
    const shelfSpotPositions = [-1.5, 0.0, 1.5];
    for (const sx of shelfSpotPositions) {
      const sp = new THREE.SpotLight(0xfff0d0, 8);
      sp.position.set(sx, 3.5, 0.0);
      sp.target.position.set(sx, SHELF_Y, SHELF_Z);
      sp.angle = Math.PI / 6;
      sp.penumbra = 0.5;
      sp.decay = 1.5;
      sp.distance = 6;
      sp.castShadow = true;
      group.add(sp);
      group.add(sp.target);
    }

    // ─── 2. Target backlights for sophisticated glowing silhouette ───
    const targetGlow1 = new THREE.PointLight(0x2288ff, 3.0, 4, 1.2);
    targetGlow1.position.set(-1.0, 2.5, -0.65);
    group.add(targetGlow1);
    
    const targetGlow2 = new THREE.PointLight(0xff2288, 3.0, 4, 1.2);
    targetGlow2.position.set(1.0, 2.5, -0.65);
    group.add(targetGlow2);

    // ─── 3. Shelf under-glow (subtle neon strip effect under the plushies) ───
    const underGlow = new THREE.PointLight(0xffaa44, 4.0, 5, 1.5);
    underGlow.position.set(0, SHELF_Y - 0.2, SHELF_Z + 0.2);
    group.add(underGlow);

    // ─── 4. Front counter fill (soft warm light for the player area) ───
    const frontFill = new THREE.PointLight(0xffeebb, 2.0, 5, 1.5);
    frontFill.position.set(0, 1.5, 1.0);
    group.add(frontFill);
    
    // ─── 5. Mesh-attached light bars (neon tubes on side walls) ───
    const neonColors = [0xff2266, 0x22aaff];
    const neonXPositions = [-3.05, 3.05]; // attached to the inner face of the side walls
    for (let i = 0; i < 2; i++) {
      const nx = neonXPositions[i];
      const nc = neonColors[i];
      const isRed = (i === 0);
      
      const tubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: nc,
        emissive: nc,
        emissiveIntensity: isRed ? 12.0 : 5.0,
        roughness: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      // Attached to the side walls, midway into the stall
      tube.position.set(nx, 2.0, -1.2);
      group.add(tube);
      galleryLights.push({ mesh: tube, baseIntensity: isRed ? 12.0 : 5.0, phase: i * Math.PI });

      const neonPL = new THREE.PointLight(nc, isRed ? 4.0 : 2.5, 5.0, 1.5);
      neonPL.position.set(nx > 0 ? nx - 0.2 : nx + 0.2, 2.0, -1.2);
      group.add(neonPL);
      galleryLights.push({ light: neonPL, baseIntensity: isRed ? 4.0 : 2.5, phase: i * Math.PI });
    }
  }

  // ── Add Operator Character ──
  let operator = null;
  if (workerGltf) {
    const root = workerGltf.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mat) => {
            if (mat.name === 'Skin') {
              mat.color.setRGB(1.0, 0.88, 0.82);
              mat.roughness = 0.6;
              mat.metalness = 0.0;
            }
          });
        }
      }
    });
    
    const h = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y || 3.3;
    const template = { root, height: h, name: 'Cowboy_Male' };
    
    operator = makeRider(template, 3.28, {
      pool: ['standRest'], 
      facingY: 0,
      phase: Math.random() * 6,
      standing: true,
    });
    
    // Attach gun to hand of the CLONED operator scene
    if (gunGltf) {
      const gunWrapper = new THREE.Group();
      const gunModel = gunGltf.scene.clone();
      
      // Sanitize materials so they render correctly with standard shaders
      sanitizeMaterials(gunModel);
      gunModel.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
          // Hide the floating bullet mesh that comes in front of the gun model
          if (o.name === 'defaultMaterial') {
            o.visible = false;
          }
        }
      });
      
      const boxRaw = new THREE.Box3().setFromObject(gunModel);
      const sizeRaw = new THREE.Vector3();
      boxRaw.getSize(sizeRaw);
      const centerRaw = boxRaw.getCenter(new THREE.Vector3());
      console.log("RAW GUN MODEL SIZE:", sizeRaw.x, sizeRaw.y, sizeRaw.z, "CENTER:", centerRaw.x, centerRaw.y, centerRaw.z);
      
      // Scale gun model to be realistic (~20cm length in world space, accounting for internal GLTF scaling and character scale)
      gunModel.scale.setScalar(3.8);
      
      // Let the gun's natural local origin (grip/trigger area) align with the hand bone
      gunModel.position.set(0, 0, 0);
      
      // Rotate gunModel to map barrel (+X) to hand's forward (+Y) and grip (-Y) to hand's down (+Z),
      // then apply a -90 degree rotation around local X (barrel axis) to point the grip straight down in world space.
      const m = new THREE.Matrix4().set(
        0,  0, -1,  0,
        1,  0,  0,  0,
        0, -1,  0,  0,
        0,  0,  0,  1
      );
      const baseQ = new THREE.Quaternion().setFromRotationMatrix(m);
      const extraQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      gunModel.quaternion.copy(baseQ).multiply(extraQ);
      gunWrapper.add(gunModel);
      
      const fig = operator.fig;
      let hand = fig.getObjectByName('Fist.R') || fig.getObjectByName('Fist_R') || fig.getObjectByName('FistR') ||
                 fig.getObjectByName('HandR') || fig.getObjectByName('Hand.R') || fig.getObjectByName('Hand_R');
      if (hand) {
        // Fist.R position offset (adjust so it sits nicely in the palm)
        // Lowered and moved left to sit between the hands properly, pushed forward
        gunWrapper.position.set(-0.25, 0.35, 0.20);
      } else {
        hand = fig.getObjectByName('LowerArmR') || fig.getObjectByName('LowerArm.R') || fig.getObjectByName('LowerArm_R');
        gunWrapper.position.set(-0.1, 0.35, 0.1); // move down the arm to the hand position
      }
      if (hand) hand.add(gunWrapper);
    }
    
    const wrapper = new THREE.Group();
    wrapper.name = 'shooting_operator';
    // Position operator further back from the counter, completely clearing the building
    wrapper.position.set(-1.2, 0, 5.0);
    wrapper.rotation.y = Math.PI - 0.29;
    
    wrapper.add(operator.pivot);
    operator.pivot.position.set(0, 0, 0);
    updateRider(operator, 0);
    wrapper.updateMatrixWorld(true);
    operator.fig.traverse((o) => {
      if (o.isSkinnedMesh) o.skeleton.update();
    });
    const bbox = new THREE.Box3().setFromObject(operator.fig, true);
    if (isFinite(bbox.min.y)) {
      const fix = Math.max(-0.5, Math.min(0.5, bbox.min.y));
      operator.pivot.position.y -= fix;
    }
    
    // Expose cowboy to window for easy debugging in console
    if (!window.__lp) window.__lp = {};
    window.__lp.cowboy = wrapper;
    
    group.add(wrapper);
  }

  // ── FPS Gun (standalone gun model placed in the scene for aim mode) ──
  let fpsGun = null;
  const cowboyWrapper = group.getObjectByName('shooting_operator');
  if (gunGltf) {
    fpsGun = new THREE.Group();
    fpsGun.name = 'fpsGun';
    const fpsGunModel = gunGltf.scene.clone();
    sanitizeMaterials(fpsGunModel);
    fpsGunModel.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (o.name === 'defaultMaterial') o.visible = false;
      }
    });
    fpsGunModel.scale.setScalar(6.0);
    // Rotate so barrel points forward (-Z in local, toward targets)
    fpsGunModel.rotation.set(0, -Math.PI / 2, 0);
    fpsGun.add(fpsGunModel);

    // Calculate muzzle position in fpsGun's local space
    fpsGunModel.updateMatrix();
    const muzzleLocal = new THREE.Vector3(0.18, 0.13, 0).applyMatrix4(fpsGunModel.matrix);

    // Sophisticated Canvas-based Muzzle Flash Sprite
    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = 128;
    flashCanvas.height = 128;
    const ctx = flashCanvas.getContext('2d');
    
    const flashGradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    flashGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    flashGradient.addColorStop(0.15, 'rgba(255, 240, 150, 1)');
    flashGradient.addColorStop(0.4, 'rgba(255, 120, 0, 0.6)');
    flashGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = flashGradient;
    ctx.fillRect(0, 0, 128, 128);
    
    ctx.translate(64, 64);
    for (let i = 0; i < 7; i++) {
      ctx.rotate(Math.PI * 2 / 7);
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(0, -55);
      ctx.lineTo(3, 0);
      ctx.fillStyle = 'rgba(255, 200, 50, 0.7)';
      ctx.fill();
    }
    
    const flashTexture = new THREE.CanvasTexture(flashCanvas);
    const flashMat = new THREE.SpriteMaterial({
      map: flashTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const flashSprite = new THREE.Sprite(flashMat);
    // Align and size properly
    flashSprite.scale.set(0.6, 0.6, 1.0);
    
    const flashGroup = new THREE.Group();
    flashGroup.position.copy(muzzleLocal);
    flashGroup.add(flashSprite);
    
    fpsGun.add(flashGroup);
    flashGroup.visible = false;
    
    fpsGun.userData.flashGroup = flashGroup;
    fpsGun.userData.flashMat = flashMat;
    fpsGun.userData.flashSprite = flashSprite;

    // Place centered, at counter height, forward toward targets
    fpsGun.position.set(0, 1.5, 4.5);
    fpsGun.visible = false;
    group.add(fpsGun);
  }

  // ─ State ──
  let score = 0;
  let timer = 30;
  let aimMode = false;
  let isTransitioning = false;
  let aimYaw = 0;
  let aimPitch = 0;
  let preAimPos = null;
  let preAimTarget = null;

  // Game effects state
  const activeBullets = [];
  const activeParticles = [];
  const cameraShake = new THREE.Vector3();
  let recoilX = 0;
  let recoilY = 0;
  let recoilTimer = 0;
  let muzzleFlashIntensity = 0;
  const particleGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
  const shockwaveGeo = new THREE.SphereGeometry(0.1, 12, 12);

  // Muzzle flash point light
  const muzzleLight = new THREE.PointLight(0xff9922, 0.0, 4.0, 1.5);
  group.add(muzzleLight);

  // Score display element
  const scoreEl = document.getElementById('shootScore');
  const timerEl = document.getElementById('shootTimer');
  const crosshairEl = document.getElementById('crosshair');

  // Controller API
  group.userData.controller = {
    get score() { return score; },
    get timer() { return timer; },
    get aimMode() { return aimMode; },
    enterAimMode() {
      if (aimMode || isTransitioning) return;
      isTransitioning = true;
      preAimPos = camera.position.clone();
      preAimTarget = controls ? controls.target.clone() : new THREE.Vector3();

      // Position camera above the gun barrel, slightly tilted down
      const camPos = new THREE.Vector3(0, 2.7, 5.5);
      group.localToWorld(camPos);
      const lookPos = new THREE.Vector3(0, 1.3, -2.0);
      group.localToWorld(lookPos);

      if (window.__lp && window.__lp.cameraManager) {
        window.__lp.cameraManager.flyToPosition(camPos, lookPos, () => {
          isTransitioning = false;
          group.userData.controller._startAiming();
        });
      } else {
        isTransitioning = false;
        camera.position.copy(camPos);
        camera.lookAt(lookPos);
        group.userData.controller._startAiming();
      }
    },
    _startAiming() {
      if (document.pointerLockElement === renderer.domElement) return;
      aimMode = true;
      score = 0;
      timer = 30;

      // Reset targets
      for (const t of targets) {
        t.hit = false;
        t.hitTime = 0;
        t.omega = 0;
        t.group.rotation.x = 0;
        for (const m of t.meshes) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach(mat => {
            if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = 0;
          });
        }
      }

      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      aimYaw = euler.y;
      aimPitch = euler.x;
      group.userData.controller.centerYaw = aimYaw;

      // Hide cowboy, show FPS gun
      if (cowboyWrapper) cowboyWrapper.visible = false;
      if (fpsGun) {
        fpsGun.visible = true;
        // Reset rotation to face targets
        fpsGun.rotation.set(0, Math.PI, 0);
      }

      if (scoreEl) scoreEl.style.display = 'block';
      if (timerEl) timerEl.style.display = 'block';
      if (crosshairEl) crosshairEl.style.display = 'block';

      if (controls) controls.enabled = false;
      renderer.domElement.requestPointerLock();
    },
    exitAimMode() {
      if (!aimMode) return;
      aimMode = false;
      isTransitioning = false;

      // Clean up active bullets
      for (const b of activeBullets) {
        group.remove(b.mesh);
      }
      activeBullets.length = 0;

      // Clean up active particles
      for (const p of activeParticles) {
        group.remove(p.mesh);
      }
      activeParticles.length = 0;

      // Show cowboy, hide FPS gun
      if (cowboyWrapper) cowboyWrapper.visible = true;
      if (fpsGun) fpsGun.visible = false;
      
      // Reset muzzle light
      if (muzzleLight) muzzleLight.intensity = 0.0;

      // Release pointer lock
      document.exitPointerLock();

      // Hide UI
      if (scoreEl) scoreEl.style.display = 'none';
      if (timerEl) timerEl.style.display = 'none';
      if (crosshairEl) crosshairEl.style.display = 'none';

      // Restore controls
      if (controls) controls.enabled = true;

      // Fly back
      if (window.__lp && window.__lp.cameraManager && preAimPos && preAimTarget) {
        window.__lp.cameraManager.flyToPosition(preAimPos, preAimTarget);
      }
    },
  };

  // Pointer lock change handler
  const onPointerLockChange = () => {
    if (document.pointerLockElement !== renderer.domElement && aimMode) {
      group.userData.controller.exitAimMode();
    }
  };
  document.addEventListener('pointerlockchange', onPointerLockChange);

  // Mouse move for aim
  const onMouseMove = (e) => {
    if (!aimMode) return;
    const sensitivity = 0.0025;
    aimYaw -= e.movementX * sensitivity;
    aimPitch -= e.movementY * sensitivity;
    
    // Clamp pitch (vertical rotation)
    aimPitch = Math.max(-0.2, Math.min(0.25, aimPitch));

    // Clamp yaw (horizontal rotation) relative to gallery center direction
    const centerYaw = group.userData.controller.centerYaw !== undefined ? group.userData.controller.centerYaw : (group.rotation.y + Math.PI);
    let diffYaw = aimYaw - centerYaw;
    diffYaw = Math.atan2(Math.sin(diffYaw), Math.cos(diffYaw));
    diffYaw = Math.max(-0.55, Math.min(0.55, diffYaw));
    aimYaw = centerYaw + diffYaw;
  };
  document.addEventListener('mousemove', onMouseMove);

  // Click to shoot
  const raycaster = new THREE.Raycaster();
  const _shootDir = new THREE.Vector3();

  const onClick = (e) => {
    if (!aimMode || e.button !== 0) return;

    // Recoil and muzzle flash parameters
    recoilX = 0.22;
    recoilY = (Math.random() - 0.5) * 0.08;
    recoilTimer = 0.12;
    muzzleFlashIntensity = 12.0;

    // Trigger visual muzzle flash visibility directly for instant feedback
    if (fpsGun && fpsGun.userData.flashGroup) {
      fpsGun.userData.flashGroup.visible = true;
      if (fpsGun.userData.flashMat) fpsGun.userData.flashMat.opacity = 1.0;
      fpsGun.userData.flashGroup.scale.setScalar(1.5 + Math.random() * 0.8); // Dynamic burst size
      if (fpsGun.userData.flashSprite) fpsGun.userData.flashSprite.material.rotation = Math.random() * Math.PI;
    }

    cameraShake.set(
      (Math.random() - 0.5) * 0.06,
      (Math.random() * 0.03 + 0.03), // recoil kick upwards
      (Math.random() - 0.5) * 0.06
    );

    // Locate gun muzzle position in local coordinates of group
    const muzzleLocalInGroup = new THREE.Vector3();
    if (aimMode && fpsGun) {
      // Get the muzzle's local position in fpsGunModel's space, then transform to group space
      const tempMuzzle = new THREE.Vector3(0.18, 0.13, 0);
      if (fpsGun.children[0]) {
        fpsGun.children[0].updateMatrix();
        tempMuzzle.applyMatrix4(fpsGun.children[0].matrix);
      }
      fpsGun.updateMatrix();
      tempMuzzle.applyMatrix4(fpsGun.matrix);
      muzzleLocalInGroup.copy(tempMuzzle);
    } else {
      const tempWorld = camera.position.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), 0.5);
      muzzleLocalInGroup.copy(tempWorld);
      group.worldToLocal(muzzleLocalInGroup);
    }

    // Raycast from camera center to find target impact point
    _shootDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, _shootDir);

    const targetMeshes = [];
    for (const t of targets) {
      if (!t.hit) {
        for (const m of t.meshes) targetMeshes.push(m);
      }
    }

    const intersectObjects = [...targetMeshes];
    if (boothModel) {
      intersectObjects.push(boothModel);
    }

    const hits = raycaster.intersectObjects(intersectObjects, true);
    const impactPointLocal = new THREE.Vector3();
    let hitObject = null;

    if (hits.length > 0) {
      impactPointLocal.copy(hits[0].point);
      group.worldToLocal(impactPointLocal);
      hitObject = hits[0].object;
    } else {
      // Default fallback plane
      impactPointLocal.set(0, 1.8, -2.0);
    }

    // Spawn visible glowing tracer mesh (elongated cylinder) instead of a tiny bullet model
    // Offset geometry so it extends FORWARD from the spawn point rather than crossing it backwards
    const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8); // 2.5m long thick tracer
    tracerGeo.rotateX(Math.PI / 2);
    tracerGeo.translate(0, 0, 1.25); 
    const tracerMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    let tracer = new THREE.Mesh(tracerGeo, tracerMat);
    
    // Glow halo
    const glowGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
    glowGeo.rotateX(Math.PI / 2);
    glowGeo.translate(0, 0, 1.25);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    tracer.add(new THREE.Mesh(glowGeo, glowMat));

    // Add original bullet model at the tip of the tracer
    if (bulletGltf) {
      const model = bulletGltf.scene.clone();
      sanitizeMaterials(model);
      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          o.material = new THREE.MeshBasicMaterial({ color: 0xffeedd }); // Bright yellow/white
        }
      });
      model.scale.setScalar(0.015); // proper scale
      model.rotation.y = Math.PI / 2;
      model.position.z = 2.5; // Place precisely at the front tip of the tracer tail
      tracer.add(model);
    }

    tracer.position.copy(muzzleLocalInGroup);
    group.add(tracer);

    // Store bullet
    const speed = 70.0; // Slightly slower so the tracer stays on-screen for a few more frames
    const velocity = new THREE.Vector3().subVectors(impactPointLocal, muzzleLocalInGroup).normalize().multiplyScalar(speed);
    const distanceToTarget = muzzleLocalInGroup.distanceTo(impactPointLocal);


    activeBullets.push({
      mesh: tracer,
      startPos: muzzleLocalInGroup.clone(),
      endPos: impactPointLocal.clone(),
      velocity,
      distanceTravelled: 0,
      totalDistance: distanceToTarget,
      hitObject
    });
  };
  document.addEventListener('mousedown', onClick);

  // Bullet impact handling
  const handleBulletImpact = (bullet) => {
    const impactPoint = bullet.endPos;
    const hitObject = bullet.hitObject;

    // Intense Flash core for shockwave
    const sMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sMesh = new THREE.Mesh(shockwaveGeo, sMat);
    sMesh.position.copy(impactPoint);
    group.add(sMesh);

    // Outer glow halo
    const gMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const gMesh = new THREE.Mesh(shockwaveGeo, gMat);
    sMesh.add(gMesh);

    activeParticles.push({
      mesh: sMesh,
      mat: sMat,
      gMat: gMat, // stored to fade it out
      type: 'shockwave',
      age: 0,
      lifetime: 0.2
    });

    // High-energy Spark splash streaks
    const particleCount = 35;
    const colors = [0xffdd44, 0xff8800, 0xff2200, 0xffffff];
    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      // use long thin boxes for fast-moving spark streaks
      const pGeo = new THREE.BoxGeometry(0.015, 0.015, 0.15 + Math.random() * 0.3);
      const pMat = new THREE.MeshBasicMaterial({ 
        color, 
        transparent: true, 
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false 
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(impactPoint);
      
      // Random direction outward from impact
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();
      
      // Look at direction of travel for streaks to align perfectly
      pMesh.lookAt(pMesh.position.clone().add(dir));

      const speed = 5.0 + Math.random() * 10.0;
      const vel = dir.multiplyScalar(speed);
      vel.y += 2.0; // slight upward bias
      
      group.add(pMesh);

      activeParticles.push({
        mesh: pMesh,
        mat: pMat,
        velocity: vel,
        type: 'spark',
        age: 0,
        lifetime: 0.15 + Math.random() * 0.25
      });
    }

    // Check hit target
    if (hitObject) {
      for (const t of targets) {
        if (t.meshes.includes(hitObject)) {
          const meshIdx = t.meshes.indexOf(hitObject);
          const points = t.points[meshIdx] * t.multiplier;
          score += points;
          t.hit = true;
          t.hitTime = performance.now() / 1000;
          t.omega = -45.0;

          // Flash target
          const mats = Array.isArray(hitObject.material) ? hitObject.material : [hitObject.material];
          mats.forEach(mat => {
            if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = 8.0;
          });

          // Camera hit punch
          cameraShake.set(
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12
          );
          break;
        }
      }
    }
  };

  // ESC to exit
  const onKeyDown = (e) => {
    if (e.code === 'Escape' && aimMode) {
      group.userData.controller.exitAimMode();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Cleanup on dispose
  group.userData.dispose = () => {
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onClick);
    document.removeEventListener('keydown', onKeyDown);

    for (const b of activeBullets) group.remove(b.mesh);
    for (const p of activeParticles) group.remove(p.mesh);
    if (muzzleLight) group.remove(muzzleLight);
    particleGeo.dispose();
    shockwaveGeo.dispose();
  };

  // Tick
  group.userData.tick = (delta, time) => {
    const dt = Math.min(delta, 0.05);

    // 1. Muzzle light & recoil updates
    if (aimMode) {
      muzzleFlashIntensity = Math.max(0, muzzleFlashIntensity - dt * 65);
      if (muzzleLight) {
        muzzleLight.intensity = muzzleFlashIntensity;
        if (fpsGun) {
          // Position at the muzzle of the FPS gun (in group local space)
          const mPos = new THREE.Vector3(0.18, 0.13, 0);
          if (fpsGun.children[0]) {
            mPos.applyMatrix4(fpsGun.children[0].matrix);
          }
          mPos.applyMatrix4(fpsGun.matrix);
          muzzleLight.position.copy(mPos);
        } else if (operator) {
          const gunModel = operator.fig.getObjectByName('Sketchfab_Scene');
          if (gunModel) {
            const mPos = new THREE.Vector3(0.18, 0.13, 0);
            gunModel.localToWorld(mPos);
            group.worldToLocal(mPos);
            muzzleLight.position.copy(mPos);
          }
        }
      }

      // Update visual muzzle flash scale and opacity on the FPS gun
      if (fpsGun && fpsGun.userData.flashGroup) {
        const scale = 1.0 + (muzzleFlashIntensity / 12.0) * 1.5;
        const opacity = muzzleFlashIntensity / 12.0;
        fpsGun.userData.flashGroup.visible = (muzzleFlashIntensity > 0.01);
        fpsGun.userData.flashGroup.scale.setScalar(scale);
        if (fpsGun.userData.flashMat) fpsGun.userData.flashMat.opacity = opacity;
      }

      cameraShake.multiplyScalar(Math.max(0, 1 - dt * 10));

      if (recoilTimer > 0) {
        recoilTimer -= dt;
      } else {
        recoilX = THREE.MathUtils.lerp(recoilX, 0, dt * 8);
        recoilY = THREE.MathUtils.lerp(recoilY, 0, dt * 8);
      }
    }

    // 2. Update Bullets
    for (let i = activeBullets.length - 1; i >= 0; i--) {
      const b = activeBullets[i];
      b.distanceTravelled += b.velocity.length() * dt;
      b.mesh.position.addScaledVector(b.velocity, dt);

      // Rotate tracer to face flight direction (using world coordinates since lookAt expects world space)
      const lookAtTargetLocal = b.mesh.position.clone().add(b.velocity);
      const lookAtTargetWorld = lookAtTargetLocal.clone();
      group.localToWorld(lookAtTargetWorld);
      b.mesh.lookAt(lookAtTargetWorld);

      if (b.distanceTravelled >= b.totalDistance) {
        handleBulletImpact(b);
        group.remove(b.mesh);
        activeBullets.splice(i, 1);
      }
    }

    // 3. Update Particles
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.age += dt;
      if (p.age >= p.lifetime) {
        group.remove(p.mesh);
        activeParticles.splice(i, 1);
      } else {
        const progress = p.age / p.lifetime;
        if (p.type === 'shockwave') {
          p.mesh.scale.setScalar(0.1 + progress * 6.0); // Big fiery explosion expansion
          p.mat.opacity = 1.0 - Math.pow(progress, 2);
          if (p.gMat) {
            p.gMat.opacity = 0.8 * (1.0 - progress);
            // Note: materials do not have scale, the parent mesh handles scaling
          }
        } else {
          // Laser sparks don't use much gravity
          p.mesh.position.addScaledVector(p.velocity, dt);
          p.mat.opacity = 1.0 - progress;
          // Scale down length as they age to look like dissipating streaks
          p.mesh.scale.setScalar(1.0 - progress * 0.8);
        }
      }
    }

    // 4. Operator animation
    if (operator) {
      updateRider(operator, time);
      const B = operator.bones;
      if (B && B.UpperArmR && B.LowerArmR && B.Torso && B.Head) {
        // Normal idle animation
        const cycle = time * 0.7 + operator.phase;
        const sweep = Math.sin(cycle);
        pose(B, 'Torso', 0.15 + Math.sin(time * 2.0) * 0.02, 0.35 + sweep * 0.15, 0);
        pose(B, 'Head', 0.1, -0.3, 0);
        pose(B, 'UpperArmR', 0.1 + Math.sin(time * 4.0) * 0.02, 1.45 + sweep * 0.05, -0.15);
        pose(B, 'LowerArmR', 0.2, 0, 0);

        if (B.UpperArmL && B.LowerArmL) {
          pose(B, 'UpperArmL', 0.2, -0.3, 0.3);
          pose(B, 'LowerArmL', 1.1, 0, 0);
        }
      }
    }

    // 5. Animate gallery lights – gentle pulsing
    for (const gl of galleryLights) {
      const pulse = 1.0 + 0.18 * Math.sin(time * 2.5 + gl.phase);
      if (gl.mesh && gl.mesh.material) {
        gl.mesh.material.emissiveIntensity = gl.baseIntensity * pulse;
      }
      if (gl.light) {
        gl.light.intensity = gl.baseIntensity * pulse;
      }
    }

    // 6. Update target movement and animations
    const now = performance.now() / 1000;
    const bound = 2.8;

    for (const t of targets) {
      t.group.position.x += t.speed * dt * t.direction;
      let wrapped = false;
      if (t.direction > 0 && t.group.position.x > bound) {
        t.group.position.x = -bound;
        wrapped = true;
      } else if (t.direction < 0 && t.group.position.x < -bound) {
        t.group.position.x = bound;
        wrapped = true;
      }
      if (wrapped) {
        t.hit = false;
        t.hitTime = 0;
        t.omega = 0;
        t.group.rotation.x = 0;
        for (const m of t.meshes) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach(mat => {
            if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = 0;
          });
        }
      }

      if (t.hit) {
        const substeps = 4;
        const subDt = dt / substeps;
        const g = 15.0;
        const damping = 2.0;

        for (let step = 0; step < substeps; step++) {
          const theta = t.group.rotation.x;
          const alpha = -g * Math.sin(theta) - damping * t.omega;
          t.omega += alpha * subDt;
          t.group.rotation.x += t.omega * subDt;
        }

        const elapsed = now - t.hitTime;
        for (const m of t.meshes) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach(mat => {
            if (mat && 'emissiveIntensity' in mat) {
              mat.emissiveIntensity = Math.max(0, 8.0 - elapsed * 25);
            }
          });
        }

        const angleFromUpright = Math.abs(Math.atan2(Math.sin(t.group.rotation.x), Math.cos(t.group.rotation.x)));
        if (Math.abs(t.omega) < 0.2 && angleFromUpright < 0.05) {
          t.hit = false;
          t.hitTime = 0;
          t.omega = 0;
          t.group.rotation.x = 0;
          for (const m of t.meshes) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach(mat => {
              if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = 0;
            });
          }
        }
      }
    }

    if (!aimMode) return;

    // Update timer
    timer -= dt;
    if (timer <= 0) {
      timer = 0;
      group.userData.controller.exitAimMode();
      return;
    }

    // 7. Update FPS gun rotation to follow aim direction
    if (fpsGun) {
      // The gun base rotation is PI (facing -Z toward targets).
      // We add relative yaw/pitch from mouse movement.
      const baseYaw = Math.PI;
      const relYaw = aimYaw - group.userData.controller.centerYaw;
      fpsGun.rotation.set(-aimPitch, baseYaw + relYaw, 0, 'YXZ');

      // Apply recoil kick
      fpsGun.rotation.x += recoilX;
    }

    // 8. Update camera position: above the gun barrel, slightly tilted down
    const camPos = new THREE.Vector3(0, 2.7, 5.5);
    group.localToWorld(camPos);
    camPos.add(cameraShake);
    camera.position.copy(camPos);
    camera.quaternion.setFromEuler(new THREE.Euler(aimPitch, aimYaw, 0, 'YXZ'));

    // Update UI
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (timerEl) timerEl.textContent = `Time: ${Math.ceil(timer)}s`;
  };

  return group;
}
