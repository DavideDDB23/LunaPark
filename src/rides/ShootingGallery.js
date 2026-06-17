import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';

export async function buildShootingGallery({ camera, renderer, controls }) {
  const group = new THREE.Group();
  group.name = 'shootingGallery';

  // ── Load prize models asynchronously ──
  let duckGltf, bearGltf, bunnyGltf, rabbitGltf;
  try {
    [duckGltf, bearGltf, bunnyGltf, rabbitGltf] = await Promise.all([
      loadGLB('assets/models/prizes/duck_plush.glb'),
      loadGLB('assets/models/prizes/low_poly_asset_teddy_bear.glb'),
      loadGLB('assets/models/prizes/low_poly_bunny_plush_toy.glb'),
      loadGLB('assets/models/prizes/rabbit_plush__conejo_peluche.glb')
    ]);
  } catch (err) {
    console.warn("Failed to load prize models", err);
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
      
      const tubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: nc,
        emissive: nc,
        emissiveIntensity: 5.0,
        roughness: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      // Attached to the side walls, midway into the stall
      tube.position.set(nx, 2.0, -1.2);
      group.add(tube);
      galleryLights.push({ mesh: tube, baseIntensity: 5.0, phase: i * Math.PI });

      const neonPL = new THREE.PointLight(nc, 2.5, 5.0, 1.5);
      neonPL.position.set(nx > 0 ? nx - 0.2 : nx + 0.2, 2.0, -1.2);
      group.add(neonPL);
      galleryLights.push({ light: neonPL, baseIntensity: 2.5, phase: i * Math.PI });
    }
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

      const camPos = new THREE.Vector3(0, 2.5, 5.0);
      group.localToWorld(camPos);
      const lookPos = new THREE.Vector3(0, 2.0, -3.0);
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
        for (const m of t.meshes) m.material.emissiveIntensity = 0;
      }

      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      aimYaw = euler.y;
      aimPitch = euler.x;

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
    const sensitivity = 0.002;
    aimYaw -= e.movementX * sensitivity;
    aimPitch -= e.movementY * sensitivity;
    aimPitch = Math.max(-0.3, Math.min(0.3, aimPitch)); // ±17° pitch limit
  };
  document.addEventListener('mousemove', onMouseMove);

  // Click to shoot
  const raycaster = new THREE.Raycaster();
  const _shootDir = new THREE.Vector3();

  const onClick = (e) => {
    if (!aimMode || e.button !== 0) return;

    // Raycast from camera center
    _shootDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, _shootDir);

    // Check target hits
    const targetMeshes = [];
    for (const t of targets) {
      if (!t.hit) {
        for (const m of t.meshes) targetMeshes.push(m);
      }
    }

    const hits = raycaster.intersectObjects(targetMeshes, false);
    if (hits.length > 0) {
      // Find which target was hit
      const hitMesh = hits[0].object;
      for (const t of targets) {
        if (t.meshes.includes(hitMesh)) {
          const meshIdx = t.meshes.indexOf(hitMesh);
          const points = t.points[meshIdx] * t.multiplier;
          score += points;
          t.hit = true;
          t.hitTime = performance.now() / 1000;
          t.omega = -45.0; // Spin velocity (radians/sec)

          // Flash effect
          hitMesh.material.emissiveIntensity = 5;

          // Camera shake
          camera.position.x += (Math.random() - 0.5) * 0.1;
          camera.position.y += (Math.random() - 0.5) * 0.05;

          break;
        }
      }
    }
  };
  document.addEventListener('mousedown', onClick);

  // ESC to exit
  const onKeyDown = (e) => {
    if (e.code === 'Escape' && aimMode) {
      group.userData.controller.exitAimMode();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Cleanup on dispose (if needed)
  group.userData.dispose = () => {
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onClick);
    document.removeEventListener('keydown', onKeyDown);
  };

  // Tick
  group.userData.tick = (delta, time) => {
    const dt = Math.min(delta, 0.05);

    // Animate gallery lights – gentle pulsing
    for (const gl of galleryLights) {
      const pulse = 1.0 + 0.18 * Math.sin(time * 2.5 + gl.phase);
      if (gl.mesh && gl.mesh.material) {
        gl.mesh.material.emissiveIntensity = gl.baseIntensity * pulse;
      }
      if (gl.light) {
        gl.light.intensity = gl.baseIntensity * pulse;
      }
    }

    // Always update target movement and animations (so targets move in/out of aimMode)
    const now = performance.now() / 1000;
    const bound = 2.8;

    for (const t of targets) {
      // Horizontal movement
      t.group.position.x += t.speed * dt * t.direction;

      // Wrap-around checking
      let wrapped = false;
      if (t.direction > 0 && t.group.position.x > bound) {
        t.group.position.x = -bound;
        wrapped = true;
      } else if (t.direction < 0 && t.group.position.x < -bound) {
        t.group.position.x = bound;
        wrapped = true;
      }

      if (wrapped) {
        // Reset hit state strictly on wrap-around
        t.hit = false;
        t.hitTime = 0;
        t.omega = 0;
        t.group.rotation.x = 0;
        for (const m of t.meshes) {
          m.material.emissiveIntensity = 0;
        }
      }

      // Tip/spin animation when hit
      if (t.hit) {
        const substeps = 4;
        const subDt = dt / substeps;
        const g = 15.0; // gravity force pulling it upright (0)
        const damping = 2.0; // air resistance

        for (let step = 0; step < substeps; step++) {
          const theta = t.group.rotation.x;
          const alpha = -g * Math.sin(theta) - damping * t.omega;
          t.omega += alpha * subDt;
          t.group.rotation.x += t.omega * subDt;
        }

        const elapsed = now - t.hitTime;
        // Fade emissive flash
        for (const m of t.meshes) {
          m.material.emissiveIntensity = Math.max(0, 5 - elapsed * 25);
        }

        // Check if it has come to rest near upright (multiple of 2PI)
        const angleFromUpright = Math.abs(Math.atan2(Math.sin(t.group.rotation.x), Math.cos(t.group.rotation.x)));
        if (Math.abs(t.omega) < 0.2 && angleFromUpright < 0.05) {
          t.hit = false;
          t.hitTime = 0;
          t.omega = 0;
          t.group.rotation.x = 0;
          for (const m of t.meshes) {
            m.material.emissiveIntensity = 0;
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

    // Update camera rotation from aim
    camera.quaternion.setFromEuler(new THREE.Euler(aimPitch, aimYaw, 0, 'YXZ'));

    // Update UI
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (timerEl) timerEl.textContent = `Time: ${Math.ceil(timer)}s`;
  };

  return group;
}
