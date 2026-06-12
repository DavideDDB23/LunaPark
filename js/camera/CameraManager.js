import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const PRESETS = {

  1: { pos: [70, 60, 70],   target: [0, 0, 0] },     // overview
  2: { pos: [-10, 25, -10], target: [-50, 22, -50] }, // ferris wheel
  3: { pos: [15, 18, -15],  target: [40, 5, -40] },   // carousel
  4: { pos: [14, 24, 12],   target: [52, 10, 54] },   // roller coaster
  5: { pos: [-15, 18, 15],  target: [-40, 0, 40] },   // tagada
  6: { pos: [0, 14, -58],   target: [0, 4, -88] },    // stage
};

const FLY_DURATION = 1.2;
const FPV_OFFSET = new THREE.Vector3(0, 1.5, 0);
const WALK_SPEED = 10;
const SPRINT_SPEED = 22;
const EYE_HEIGHT = 1.7;
const COLLISION_BUFFER = 0.3;
const DEBOUNCE_MS = 200;
const BACKWARD_MULTIPLIER = 0.7;
const smoothstep = (t) => t * t * (3 - 2 * t);

export class CameraManager {
  constructor(camera, scene, controls, renderer, getRides, interactiveObjects = []) {
    this.camera = camera;
    this.scene = scene;
    this.controls = controls;
    this.renderer = renderer;
    this.getRides = getRides;
    this.interactiveObjects = interactiveObjects;
    this.state = 'orbit';
    this._flyFrom = new THREE.Vector3();
    this._flyTo = new THREE.Vector3();
    this._lookFrom = new THREE.Vector3();
    this._lookTo = new THREE.Vector3();
    this._flyProgress = 0;
    this._fpvTarget = null;
    this._fpvOffset = FPV_OFFSET.clone();
    this._fpvRide = null;
    this._preFpvPos = null;
    this._preFpvTarget = null;
    this._hiddenRiders = [];
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpForward = new THREE.Vector3();
    this._clickStart = { x: 0, y: 0 };
    this._hasMoved = false;
    this._lastHoverTime = 0;
    this._hoverThrottleMs = 50;
    this._preFpvMode = null;
    this._walkKeys = { w: false, a: false, s: false, d: false, shift: false };
    this._walkDirection = new THREE.Vector3();
    this._walkRay = new THREE.Raycaster();
    this._walkCollisionRay = new THREE.Raycaster();
    this._collidableMeshes = [];
    this._groundTarget = null;
    this._lastVToggle = 0;
    this._pointerLockControls = null;
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWalkKeyDown = this._onWalkKeyDown.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onPointerLockError = this._onPointerLockError.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerHover = this._onPointerHover.bind(this);
    this._bindEvents();
  }

  flyToPreset(index) {
    const preset = PRESETS[index];
    if (!preset) return;
    this._startFlight(
      this.camera.position.clone(),
      new THREE.Vector3(...preset.pos),
      this.controls.target.clone(),
      new THREE.Vector3(...preset.target)
    );
  }

  flyToWorldPoint(targetPos) {
    const fixedHeight = 12;
    const distance = 22;
    const dir = this.camera.position.clone().sub(targetPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) {
      dir.set(0, 0, 1);
    } else {
      dir.normalize();
    }
    const flyTo = targetPos.clone().add(dir.multiplyScalar(distance));
    flyTo.y = fixedHeight;
    this._startFlight(
      this.camera.position.clone(),
      flyTo,
      this.controls.target.clone(),
      targetPos.clone()
    );
  }

  enterWalkMode() {
    if (this.state !== 'orbit') return;
    const now = Date.now();
    if (now - this._lastVToggle < DEBOUNCE_MS) return;
    this._lastVToggle = now;

    this._walkRay.set(this.camera.position, new THREE.Vector3(0, -1, 0));
    const hits = this._walkRay.intersectObjects(this._collidableMeshes, false);
    let groundY = 0;
    for (const hit of hits) {
      const obj = hit.object;
      if (obj.name === 'sky' || obj.name === 'water' || obj.userData.transparent) continue;
      groundY = hit.point.y;
      break;
    }
    this.camera.position.y = groundY + EYE_HEIGHT;
    this._groundTarget = groundY;

    this._preFpvMode = null;
    this.state = 'walk';
    this.controls.enabled = false;

    this._pointerLockControls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.renderer.domElement.requestPointerLock();

    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);
    window.addEventListener('keydown', this._onWalkKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  exitWalkMode() {
    if (this.state !== 'walk') return;

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    if (this._pointerLockControls) {
      this._pointerLockControls.dispose();
      this._pointerLockControls = null;
    }

    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('pointerlockerror', this._onPointerLockError);
    window.removeEventListener('keydown', this._onWalkKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);

    this._walkKeys.w = false;
    this._walkKeys.a = false;
    this._walkKeys.s = false;
    this._walkKeys.d = false;
    this._walkKeys.shift = false;

    this.controls.target.set(
      this.camera.position.x,
      this.camera.position.y - 1,
      this.camera.position.z - 5
    );
    this.controls.enabled = true;
    this.state = 'orbit';
  }

  buildCollidableMeshes() {
    this._collidableMeshes = [];
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      if (obj.name === 'sky' || obj.name === 'water') return;
      if (obj.userData.transparent) return;
      if (obj.isLight || obj.isHelper) return;
      this._collidableMeshes.push(obj);
    });
  }

  initCollidableMeshes() {
    this.buildCollidableMeshes();
    if (this._collidableMeshes.length === 0) {
      setTimeout(() => this.buildCollidableMeshes(), 2000);
    }
  }

  _checkCollision(position, direction, distance) {
    this._walkCollisionRay.set(position, direction);
    const hits = this._walkCollisionRay.intersectObjects(this._collidableMeshes, false);
    for (const hit of hits) {
      const obj = hit.object;
      if (obj.name === 'sky' || obj.name === 'water' || obj.userData.transparent) continue;
      if (hit.distance < distance) {
        return Math.max(0, hit.distance - COLLISION_BUFFER);
      }
    }
    return distance;
  }

  _tickWalk(delta) {
    if (!this._pointerLockControls) return;

    const baseSpeed = this._walkKeys.shift ? SPRINT_SPEED : WALK_SPEED;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    this._walkDirection.set(0, 0, 0);
    if (this._walkKeys.w) this._walkDirection.add(forward);
    if (this._walkKeys.s) this._walkDirection.sub(forward);
    if (this._walkKeys.d) this._walkDirection.add(right);
    if (this._walkKeys.a) this._walkDirection.sub(right);

    if (this._walkDirection.lengthSq() > 0) {
      this._walkDirection.normalize();

      let effectiveSpeed = baseSpeed;
      const dot = this._walkDirection.dot(forward);
      if (dot < -0.5) {
        effectiveSpeed *= BACKWARD_MULTIPLIER;
      }

      const moveX = this._walkDirection.x * effectiveSpeed * delta;
      const moveZ = this._walkDirection.z * effectiveSpeed * delta;

      const dirX = new THREE.Vector3(Math.sign(moveX), 0, 0);
      const safeX = this._checkCollision(this.camera.position, dirX, Math.abs(moveX));
      this.camera.position.x += Math.sign(moveX) * safeX;

      const dirZ = new THREE.Vector3(0, 0, Math.sign(moveZ));
      const safeZ = this._checkCollision(this.camera.position, dirZ, Math.abs(moveZ));
      this.camera.position.z += Math.sign(moveZ) * safeZ;
    }

    this._updateGroundFollowing(delta);
  }

  _updateGroundFollowing(delta) {
    const origin = this.camera.position.clone();
    origin.y += 5;
    this._walkRay.set(origin, new THREE.Vector3(0, -1, 0));
    const hits = this._walkRay.intersectObjects(this._collidableMeshes, false);
    let groundY = 0;
    for (const hit of hits) {
      const obj = hit.object;
      if (obj.name === 'sky' || obj.name === 'water' || obj.userData.transparent) continue;
      groundY = hit.point.y;
      break;
    }
    const targetY = groundY + EYE_HEIGHT;
    this.camera.position.y += (targetY - this.camera.position.y) * Math.min(delta * 10, 1);
  }

  _onWalkKeyDown(ev) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    const key = ev.key.toLowerCase();
    if (key === 'w') this._walkKeys.w = true;
    else if (key === 'a') this._walkKeys.a = true;
    else if (key === 's') this._walkKeys.s = true;
    else if (key === 'd') this._walkKeys.d = true;
    else if (key === 'shift') this._walkKeys.shift = true;
  }

  _onKeyUp(ev) {
    const key = ev.key.toLowerCase();
    if (key === 'w') this._walkKeys.w = false;
    else if (key === 'a') this._walkKeys.a = false;
    else if (key === 's') this._walkKeys.s = false;
    else if (key === 'd') this._walkKeys.d = false;
    else if (key === 'shift') this._walkKeys.shift = false;
  }

  _onPointerLockChange() {
    if (document.pointerLockElement !== this.renderer.domElement) {
      if (this.state === 'walk') {
        this._walkKeys.w = false;
        this._walkKeys.a = false;
        this._walkKeys.s = false;
        this._walkKeys.d = false;
        this._walkKeys.shift = false;
      }
    }
  }

  _onPointerLockError(err) {
    console.error('Pointer lock error:', err);
    if (this.state === 'walk') this.exitWalkMode();
  }

  enterFPV() {
    if (this.state === 'fpv') return;
    const rides = this.getRides();
    if (!rides || rides.length === 0) return;

    this._preFpvMode = this.state;

    const referencePos = (this.state === 'flying') ? this._flyTo : this.camera.position;

    let closestRide = null;
    let closestDist = Infinity;
    for (const ride of rides) {
      ride.group.getWorldPosition(this._tmpVec);
      const dist = referencePos.distanceTo(this._tmpVec);
      if (dist < 80 && dist < closestDist) {
        closestDist = dist;
        closestRide = ride;
      }
    }
    if (!closestRide) return;

    const target = closestRide.getFpvTarget();
    if (!target) return;

    // Save camera position and target before entering FPV
    if (this.state === 'flying') {
      this._preFpvPos = this._flyTo.clone();
      this._preFpvTarget = this._lookTo.clone();
    } else {
      this._preFpvPos = this.camera.position.clone();
      this._preFpvTarget = this.controls.target.clone();
    }

    this._fpvTarget = target;
    this._fpvRide = closestRide;
    this._fpvOffset.copy(closestRide.getFpvOffset());

    // Hide riders of this ride to prevent clipping
    this._hiddenRiders = [];
    if (closestRide.getRiders) {
      const riders = closestRide.getRiders();
      if (riders && riders.length > 0) {
        for (const rider of riders) {
          if (rider && rider.pivot) {
            rider.pivot.visible = false;
            this._hiddenRiders.push(rider);
          }
        }
      }
    }

    this.state = 'fpv';
    this.controls.enabled = false;
  }

  exitFPV() {
    if (this.state !== 'fpv') return;

    const prePos = this._preFpvPos;
    const preTarget = this._preFpvTarget;
    const preMode = this._preFpvMode;
    const fpvRide = this._fpvRide;

    this._preFpvPos = null;
    this._preFpvTarget = null;
    this._preFpvMode = null;

    this._cleanupFPV();

    if (preMode === 'walk') {
      this.state = 'orbit';
      this.controls.enabled = true;
      this.enterWalkMode();
      return;
    }

    if (prePos && preTarget) {
      this._tmpQuat.copy(this.camera.quaternion);
      this._tmpForward.set(0, 0, -1).applyQuaternion(this._tmpQuat);
      const currentLookTarget = this.camera.position.clone().add(this._tmpForward.multiplyScalar(20));

      this._startFlight(
        this.camera.position.clone(),
        prePos,
        currentLookTarget,
        preTarget
      );
    } else {
      this.state = 'orbit';
      if (fpvRide) {
        fpvRide.group.getWorldPosition(this._tmpVec);
        this.controls.target.copy(this._tmpVec);
      }
      this.controls.enabled = true;
    }
  }

  _cleanupFPV() {
    this._fpvTarget = null;
    this._fpvRide = null;
    if (this._hiddenRiders && this._hiddenRiders.length > 0) {
      for (const rider of this._hiddenRiders) {
        if (rider && rider.pivot) {
          rider.pivot.visible = true;
        }
      }
      this._hiddenRiders = [];
    }
  }

  get isFPV() { return this.state === 'fpv'; }

  setInteractiveObjects(objects) {
    this.interactiveObjects = objects;
  }

  tick(delta) {
    if (this.state === 'flying') this._tickFlight(delta);
    else if (this.state === 'fpv') this._tickFPV();
    else if (this.state === 'walk') this._tickWalk(delta);
  }

  destroy() {
    if (this.state === 'walk') this.exitWalkMode();
    window.removeEventListener('keydown', this._onKeyDown);
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerHover);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
  }

  _startFlight(fromPos, toPos, fromLook, toLook) {
    this.state = 'flying';
    this.controls.enabled = false;
    this._cleanupFPV();

    // Reset OrbitControls momentum/delta to prevent jumps upon landing
    if (this.controls._sphericalDelta) {
      this.controls._sphericalDelta.set(0, 0, 0);
    }
    if (this.controls._panOffset) {
      this.controls._panOffset.set(0, 0, 0);
    }

    this._flyFrom.copy(fromPos);
    this._flyTo.copy(toPos);
    this._lookFrom.copy(fromLook);
    this._lookTo.copy(toLook);
    this._flyProgress = 0;
  }

  _tickFlight(delta) {
    this._flyProgress += delta / FLY_DURATION;
    if (this._flyProgress >= 1) {
      this._flyProgress = 1;
      this.camera.position.copy(this._flyTo);
      this.controls.target.copy(this._lookTo);
      
      // Reset OrbitControls momentum/delta again to be absolutely sure
      if (this.controls._sphericalDelta) {
        this.controls._sphericalDelta.set(0, 0, 0);
      }
      if (this.controls._panOffset) {
        this.controls._panOffset.set(0, 0, 0);
      }

      this.controls.update();

      // Save the target state so future resets/restores refer to this stable landing pose
      this.controls.saveState();

      this.controls.enabled = true;
      this.state = 'orbit';
      return;
    }
    const t = smoothstep(this._flyProgress);
    this.camera.position.lerpVectors(this._flyFrom, this._flyTo, t);
    this.controls.target.lerpVectors(this._lookFrom, this._lookTo, t);
    this.camera.lookAt(this.controls.target);
  }

  _tickFPV() {
    if (!this._fpvRide || !this._fpvTarget) { this.exitFPV(); return; }

    if (this._fpvRide.getFpvCameraPos) {
      this._fpvRide.getFpvCameraPos(this._fpvTarget, this.camera.position);
    } else {
      this._fpvTarget.getWorldPosition(this._tmpVec);
      this.camera.position.copy(this._tmpVec).add(this._fpvOffset);
    }

    if (this._fpvRide.getFpvLookTarget) {
      this._fpvRide.getFpvLookTarget(this._fpvTarget, this._lookTo);
      this.camera.lookAt(this._lookTo);
    } else {
      this._fpvTarget.getWorldPosition(this._tmpVec);
      this._fpvTarget.getWorldQuaternion(this._tmpQuat);
      this._tmpForward.set(0, 0, -1).applyQuaternion(this._tmpQuat);
      this._lookTo.copy(this._tmpVec).add(this._tmpForward);
      this.camera.lookAt(this._lookTo);
    }
  }

  _onKeyDown(ev) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    const key = ev.key;

    if (key === 'v' || key === 'V') {
      if (this.state === 'walk') {
        this.exitWalkMode();
      } else if (this.state === 'orbit') {
        this.enterWalkMode();
      }
      return;
    }

    if (this.state === 'walk') {
      if (key === 'c' || key === 'C') {
        if (this.state === 'walk') this.enterFPV();
      }
      return;
    }

    if (key >= '1' && key <= '6') {
      this.flyToPreset(parseInt(key));
    } else if (key === 'c' || key === 'C') {
      if (this.state === 'fpv') { this.exitFPV(); }
      else if (this.state === 'orbit' || this.state === 'flying') { this.enterFPV(); }
    } else if (key === 'Escape') {
      if (this.state === 'fpv') this.exitFPV();
      else if (this.state === 'flying') {
        this.camera.position.copy(this._flyTo);
        this.controls.target.copy(this._lookTo);

        if (this.controls._sphericalDelta) {
          this.controls._sphericalDelta.set(0, 0, 0);
        }
        if (this.controls._panOffset) {
          this.controls._panOffset.set(0, 0, 0);
        }

        this.controls.update();
        this.controls.saveState();

        this.controls.enabled = true;
        this.state = 'orbit';
      }
    }
  }

  _onPointerDown(ev) {
    if (ev.button !== 0 || this.state !== 'orbit') return;
    if (ev.target !== this.renderer.domElement) return;
    this._clickStart.x = ev.clientX;
    this._clickStart.y = ev.clientY;
    this._hasMoved = false;
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  _onPointerMove(ev) {
    const dx = Math.abs(ev.clientX - this._clickStart.x);
    const dy = Math.abs(ev.clientY - this._clickStart.y);
    if (dx > 5 || dy > 5) {
      this._hasMoved = true;
    }
  }

  _onPointerUp(ev) {
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);

    if (ev.button !== 0 || this.state !== 'orbit') return;
    if (this._hasMoved) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._ray.setFromCamera(this._ndc, this.camera);

    // Overriding click-to-fly when clicking interactive objects (control panel, lamppost)
    const intersects = this._ray.intersectObjects(this.interactiveObjects, true);
    let hitInteractive = false;
    for (const hit of intersects) {
      let obj = hit.object;
      while (obj) {
        if (obj.name === 'controlPanel' || obj.userData.lampId) {
          hitInteractive = true;
          break;
        }
        obj = obj.parent;
      }
      if (hitInteractive) break;
    }
    if (hitInteractive) return;

    const hit = new THREE.Vector3();
    if (this._ray.ray.intersectPlane(this._groundPlane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -95, 95);
      hit.z = THREE.MathUtils.clamp(hit.z, -95, 95);
      this.flyToWorldPoint(hit);
    }
  }

  _onPointerHover(ev) {
    if (this.state !== 'orbit') return;
    const now = Date.now();
    if (now - this._lastHoverTime < this._hoverThrottleMs) return;
    this._lastHoverTime = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._ray.setFromCamera(this._ndc, this.camera);
    const intersects = this._ray.intersectObjects(this.interactiveObjects, true);
    
    let hitInteractive = false;
    for (const hit of intersects) {
      let obj = hit.object;
      while (obj) {
        if (obj.name === 'controlPanel' || obj.userData.lampId) {
          hitInteractive = true;
          break;
        }
        obj = obj.parent;
      }
      if (hitInteractive) break;
    }

    if (hitInteractive) {
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      if (this.renderer.domElement.style.cursor === 'pointer') {
        this.renderer.domElement.style.cursor = '';
      }
    }
  }

  _bindEvents() {
    window.addEventListener('keydown', this._onKeyDown);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this._onPointerHover);
  }
}
