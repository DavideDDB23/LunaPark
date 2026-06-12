import * as THREE from 'three';
import { ControlPanel } from './ControlPanel.js';
import { eventBus } from '../utils/EventBus.js';

export async function buildShootingGallery({ camera, renderer, controls }) {
  const group = new THREE.Group();
  group.name = 'shootingGallery';

  // ── Build booth structure ──
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.8, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });

  // Counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 1.5), woodMat);
  counter.position.set(0, 0.5, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  // Back wall (targets mount here)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.3), woodMat);
  backWall.position.set(0, 2, -0.9);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  // Roof (2 angled panels)
  for (const [rx, rz] of [[-1.5, -0.5], [1.5, -0.5]]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 2.5), canvasMat);
    roof.position.set(rx, 3.5, rz);
    roof.rotation.x = -0.15;
    roof.castShadow = true;
    group.add(roof);
  }

  // Roof supports (4 poles)
  for (const [px, pz] of [[-2.8, -1], [2.8, -1], [-2.8, 0.5], [2.8, 0.5]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), poleMat);
    pole.position.set(px, 1.5, pz);
    pole.castShadow = true;
    group.add(pole);
  }

  // Side walls (partial)
  for (const sx of [-2.9, 2.9]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 1.5), woodMat);
    side.position.set(sx, 1.75, -0.25);
    side.castShadow = true;
    group.add(side);
  }

  // ── Targets (10) ──
  const targets = [];
  const targetLayout = [
    // Row 1 (back, 4 targets)
    [-2, 2.5, -0.7], [-0.7, 2.5, -0.7], [0.7, 2.5, -0.7], [2, 2.5, -0.7],
    // Row 2 (middle, 3 targets)
    [-1.3, 1.8, -0.7], [0, 1.8, -0.7], [1.3, 1.8, -0.7],
    // Row 3 (front, 3 targets)
    [-1.3, 1.1, -0.7], [0, 1.1, -0.7], [1.3, 1.1, -0.7],
  ];

  for (let i = 0; i < targetLayout.length; i++) {
    const [tx, ty, tz] = targetLayout[i];
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
    });
  }

  // ─ State ──
  let score = 0;
  let timer = 30;
  let aimMode = false;
  let aimYaw = 0;
  let aimPitch = 0;

  // Score display element
  const scoreEl = document.getElementById('shootScore');
  const timerEl = document.getElementById('shootTimer');
  const crosshairEl = document.getElementById('crosshair');

  // ── Control Panel ──
  const panel = new ControlPanel({
    initialRunning: false,
    onToggle: (running) => {
      if (running) {
        group.userData.controller.enterAimMode();
      } else {
        group.userData.controller.exitAimMode();
      }
    },
    rampUp: 0.5,
    rampDown: 0.5,
  });
  group.add(panel.group);

  // Controller API
  group.userData.controller = {
    panel: panel.group,
    get score() { return score; },
    get timer() { return timer; },
    get aimMode() { return aimMode; },
    enterAimMode() {
      if (aimMode) return;
      aimMode = true;
      score = 0;
      timer = 30;

      // Reset targets
      for (const t of targets) {
        t.hit = false;
        t.hitTime = 0;
        t.group.rotation.x = 0;
        for (const m of t.meshes) m.material.emissiveIntensity = 0;
      }

      // Set camera position
      camera.position.set(30, 2.5, 30);
      camera.lookAt(30, 2, 22);

      // Store initial yaw/pitch
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      aimYaw = euler.y;
      aimPitch = euler.x;

      // Show UI
      if (scoreEl) scoreEl.style.display = 'block';
      if (timerEl) timerEl.style.display = 'block';
      if (crosshairEl) crosshairEl.style.display = 'block';

      // Request pointer lock
      renderer.domElement.requestPointerLock();
    },
    exitAimMode() {
      if (!aimMode) return;
      aimMode = false;

      // Release pointer lock
      document.exitPointerLock();

      // Hide UI
      if (scoreEl) scoreEl.style.display = 'none';
      if (timerEl) timerEl.style.display = 'none';
      if (crosshairEl) crosshairEl.style.display = 'none';

      // Restore controls
      if (controls) controls.enabled = true;
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
          const points = t.points[meshIdx];
          score += points;
          t.hit = true;
          t.hitTime = performance.now() / 1000;

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
    if (!aimMode) return;

    const dt = Math.min(delta, 0.05);

    // Update timer
    timer -= dt;
    if (timer <= 0) {
      timer = 0;
      group.userData.controller.exitAimMode();
      return;
    }

    // Update camera rotation from aim
    camera.quaternion.setFromEuler(new THREE.Euler(aimPitch, aimYaw, 0, 'YXZ'));

    // Update target animations
    const now = performance.now() / 1000;
    for (const t of targets) {
      if (t.hit) {
        const elapsed = now - t.hitTime;
        // Tip backward over 0.3s
        const tipProgress = Math.min(1, elapsed / 0.3);
        t.group.rotation.x = -Math.PI / 2 * tipProgress;

        // Fade emissive
        for (const m of t.meshes) {
          m.material.emissiveIntensity = Math.max(0, 5 - elapsed * 25);
        }

        // Reset after 2s
        if (elapsed > 2) {
          t.hit = false;
          t.hitTime = 0;
          t.group.rotation.x = 0;
          for (const m of t.meshes) m.material.emissiveIntensity = 0;
        }
      }
    }

    // Update UI
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (timerEl) timerEl.textContent = `Time: ${Math.ceil(timer)}s`;
  };

  return group;
}
