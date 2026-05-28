import * as THREE from 'three';
import { eventBus } from './EventBus.js';

export class InteractionManager {
  constructor(camera, renderer, scene) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveObjects = [];
    this.rideObjects = [];

    this.lastMoveTime = 0;
    this.throttleMs = 50;

    this.initListeners();
  }

  registerClickable(object) {
    this.interactiveObjects.push(object);
  }

  registerRide(object) {
    this.rideObjects.push(object);
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

      const hits = this.raycaster.intersectObjects(this.rideObjects, true);
      if (hits.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Find root ride object with controller
        let curr = hits[0].object;
        while (curr && !curr.userData.controller) {
          curr = curr.parent;
        }
        if (curr && curr.userData.controller) {
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          eventBus.emit('speed-scroll', { rideId: curr.name, delta });
        }
      }
    };

    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('wheel', onWheel, { passive: false, capture: true });

    // Mobile Touch Events
    dom.addEventListener('touchmove', onMove);
    dom.addEventListener('touchstart', onDown);
  }

  updateNDC(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }
}
