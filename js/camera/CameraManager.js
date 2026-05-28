import * as THREE from 'three';

const PRESETS = {
  1: { pos: [70, 60, 70],   target: [0, 0, 0] },
  2: { pos: [-60, 30, -40], target: [-50, 25, -50] },
  3: { pos: [50, 18, -30],  target: [40, 5, -40] },
  4: { pos: [50, 15, 45],   target: [40, 0, 40] },
  5: { pos: [-30, 18, 50],  target: [-40, 0, 40] },
  6: { pos: [0, 12, 25],    target: [0, 4, 0] },
};

const FLY_DURATION = 1.2;
const FPV_OFFSET = new THREE.Vector3(0, 1.5, 0);
const smoothstep = (t) => t * t * (3 - 2 * t);

export class CameraManager {
  constructor(camera, controls, renderer, getRides) {
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.getRides = getRides;
    this.state = 'orbit';
    this._flyFrom = new THREE.Vector3();
    this._flyTo = new THREE.Vector3();
    this._lookFrom = new THREE.Vector3();
    this._lookTo = new THREE.Vector3();
    this._flyProgress = 0;
    this._fpvTarget = null;
    this._fpvOffset = FPV_OFFSET.clone();
    this._fpvRide = null;
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpForward = new THREE.Vector3();
    this._lookAtInterp = new THREE.Vector3();
    this._clickStart = { x: 0, y: 0 };
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
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
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const flyTo = targetPos.clone().add(dir.multiplyScalar(8));
    flyTo.y = Math.max(flyTo.y, targetPos.y + 3);
    this._startFlight(
      this.camera.position.clone(),
      flyTo,
      this.controls.target.clone(),
      targetPos.clone()
    );
  }

  enterFPV() {
    if (this.state === 'fpv') return;
    const rides = this.getRides();
    if (!rides || rides.length === 0) return;

    let closestRide = null;
    let closestDist = Infinity;
    for (const ride of rides) {
      ride.group.getWorldPosition(this._tmpVec);
      const dist = this.camera.position.distanceTo(this._tmpVec);
      if (dist < 60 && dist < closestDist) {
        closestDist = dist;
        closestRide = ride;
      }
    }
    if (!closestRide) return;

    const target = closestRide.getFpvTarget();
    if (!target) return;

    this._fpvTarget = target;
    this._fpvRide = closestRide;
    this._fpvOffset.copy(closestRide.getFpvOffset());
    this.state = 'fpv';
    this.controls.enabled = false;
  }

  exitFPV() {
    if (this.state !== 'fpv') return;
    this.state = 'orbit';
    this._fpvTarget = null;
    if (this._fpvRide) {
      this._fpvRide.group.getWorldPosition(this._tmpVec);
      this.controls.target.copy(this._tmpVec);
    }
    this._fpvRide = null;
    this.controls.enabled = true;
  }

  get isFPV() { return this.state === 'fpv'; }

  tick(delta) {
    if (this.state === 'flying') this._tickFlight(delta);
    else if (this.state === 'fpv') this._tickFPV();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
  }

  _startFlight(fromPos, toPos, fromLook, toLook) {
    this.state = 'flying';
    this.controls.enabled = false;
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
      this.controls.enabled = true;
      this.state = 'orbit';
      return;
    }
    const t = smoothstep(this._flyProgress);
    const ROTATION_PHASE = 0.4;

    if (t < ROTATION_PHASE) {
      const re = smoothstep(t / ROTATION_PHASE);
      this.camera.position.copy(this._flyFrom);
      this._lookAtInterp.lerpVectors(this._lookFrom, this._lookTo, re * 0.3);
      this.camera.lookAt(this._lookAtInterp);
    } else {
      const se = smoothstep((t - ROTATION_PHASE) / (1 - ROTATION_PHASE));
      this.camera.position.lerpVectors(this._flyFrom, this._flyTo, se);
      this._lookAtInterp.lerpVectors(this._lookFrom, this._lookTo, 0.3 + se * 0.7);
      this.camera.lookAt(this._lookAtInterp);
    }
  }

  _tickFPV() {
    if (!this._fpvTarget) { this.exitFPV(); return; }
    this._fpvTarget.getWorldPosition(this._tmpVec);
    this.camera.position.copy(this._tmpVec).add(this._fpvOffset);
    this._fpvTarget.getWorldQuaternion(this._tmpQuat);
    this._tmpForward.set(0, 0, -1).applyQuaternion(this._tmpQuat);
    this._lookTo.copy(this._tmpVec).add(this._tmpForward);
    this.camera.lookAt(this._lookTo);
  }

  _onKeyDown(ev) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    const key = ev.key;
    if (key >= '1' && key <= '6') {
      this.flyToPreset(parseInt(key));
    } else if (key === 'c' || key === 'C') {
      if (this.state === 'fpv') { this.exitFPV(); }
      else if (this.state === 'orbit') { this.enterFPV(); }
    } else if (key === 'Escape') {
      if (this.state === 'fpv') this.exitFPV();
      else if (this.state === 'flying') {
        this.camera.position.copy(this._flyTo);
        this.controls.target.copy(this._lookTo);
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
  }

  _onPointerUp(ev) {
    if (ev.button !== 0 || this.state !== 'orbit') return;
    if (ev.target !== this.renderer.domElement) return;
    const dx = Math.abs(ev.clientX - this._clickStart.x);
    const dy = Math.abs(ev.clientY - this._clickStart.y);
    if (dx >= 5 || dy >= 5) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this._ray.ray.intersectPlane(this._groundPlane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -95, 95);
      hit.z = THREE.MathUtils.clamp(hit.z, -95, 95);
      this.flyToWorldPoint(hit);
    }
  }

  _bindEvents() {
    window.addEventListener('keydown', this._onKeyDown);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }
}
