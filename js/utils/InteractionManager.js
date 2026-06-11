import * as THREE from 'three';
import { eventBus } from './EventBus.js';

export class InteractionManager {
  constructor(camera, renderer, scene, controls) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;
    this.controls = controls;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveObjects = [];

    this.lastMoveTime = 0;
    this.throttleMs = 50;

    this.initListeners();
  }

  registerClickable(object) {
    this.interactiveObjects.push(object);
  }

  initListeners() {
    const dom = this.renderer.domElement;

    const onMove = (e) => {
      const now = Date.now();
      if (now - this.lastMoveTime < this.throttleMs) return;
      this.lastMoveTime = now;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      this.updateNDC(clientX, clientY);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const hits = this.raycaster.intersectObjects(this.interactiveObjects, true);
      if (hits.length > 0) {
        dom.style.cursor = 'pointer';
      } else {
        dom.style.cursor = 'default';
      }
    };

    const onDown = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      this.updateNDC(clientX, clientY);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const hits = this.raycaster.intersectObjects(this.interactiveObjects, true);
      if (hits.length > 0) {
        eventBus.emit('interact-click', { object: hits[0].object, point: hits[0].point });
      }
    };

    const onWheel = (e) => {
      this.updateNDC(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const hits = this.raycaster.intersectObjects(this.interactiveObjects, true);
      if (hits.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (this.controls) this.controls.enableZoom = false;
        // Find root ride object with controller
        let curr = hits[0].object;
        while (curr && !curr.userData.controller) {
          curr = curr.parent;
        }
        if (curr && curr.userData.controller) {
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          eventBus.emit('speed-scroll', { rideId: curr.name, delta });
        }
      } else {
        if (this.controls) this.controls.enableZoom = true;
      }
    };

    // Pointer Events already cover mouse, touch and pen — registering the
    // legacy touch* events as well made every tap fire onDown twice (the ride
    // toggled on+off instantly and the panel appeared dead on touch screens).
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('wheel', onWheel, { passive: false, capture: true });
  }

  updateNDC(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }
}
