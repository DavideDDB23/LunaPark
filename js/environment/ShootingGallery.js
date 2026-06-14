import * as THREE from 'three';
import { ControlPanel } from './ControlPanel.js';
import { eventBus } from '../utils/EventBus.js';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';

export async function buildShootingGallery({ camera, renderer, controls }) {
  const group = new THREE.Group();
  group.name = 'shootingGallery';

  // ── Build booth structure ──
  let boothModel;
  try {
    const gltf = await loadGLB('assets/models/stylized_carnival_booth.glb');
    boothModel = gltf.scene;
    sanitizeMaterials(boothModel);
    
    // Scale and position the booth
    const bbox = new THREE.Box3().setFromObject(boothModel);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    const targetHeight = 4.5;
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    boothModel.scale.setScalar(scale);
    
    // Rotate 180 degrees so it opens towards +Z (the player)
    boothModel.rotation.y = Math.PI;
    
    // Center the booth at (0, 0, 0)
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    boothModel.position.set(center.x * scale, -bbox.min.y * scale, center.z * scale);
    
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

  // ── Targets (Option A: Moving Targets) ──
  const targets = [];
  const rows = [
    { z: 1.0, y: 1.0, speed: 0.8, direction: 1, multiplier: 1, count: 3 },  // Front row (left-to-right)
    { z: 0.5, y: 1.4, speed: 1.4, direction: -1, multiplier: 2, count: 4 }, // Middle row (right-to-left)
    { z: 0.0, y: 1.8, speed: 2.0, direction: 1, multiplier: 3, count: 4 }   // Back row (left-to-right)
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

      const worldPos = new THREE.Vector3();
      group.getWorldPosition(worldPos);
      const camPos = new THREE.Vector3(worldPos.x, worldPos.y + 2.5, worldPos.z + 5.0);
      const lookPos = new THREE.Vector3(worldPos.x, worldPos.y + 2.0, worldPos.z - 3.0);

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
