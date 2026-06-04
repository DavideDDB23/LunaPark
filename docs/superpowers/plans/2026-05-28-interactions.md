# Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a centralized interaction system with throttled raycasting, touch support, a decoupled EventBus, speed multiplier scroll modifiers, and an HTML color picker overlay.

**Architecture:** Use a central EventBus singleton to publish inputs and state transitions. Replace scattered event listeners inside ride and environment scripts with a unified InteractionManager.

**Tech Stack:** Three.js, Vanilla HTML5/CSS3, ES6 Modules.

---

### Task 1: Create the EventBus

**Files:**
- Create: `js/utils/EventBus.js`

- [ ] **Step 1: Write EventBus implementation**
  Create the EventBus class as a lightweight pub/sub module:
  ```javascript
  export class EventBus {
    constructor() {
      this.listeners = {};
    }

    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    off(event, callback) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
      if (!this.listeners[event]) return;
      for (const cb of this.listeners[event]) {
        cb(data);
      }
    }
  }

  export const eventBus = new EventBus();
  ```

- [ ] **Step 2: Verify in browser console**
  Verify that the file loads and works correctly by testing in the browser console.
  Expected: Command outputs `'received payload'` without error.
  ```javascript
  import { eventBus } from './js/utils/EventBus.js';
  eventBus.on('test', (data) => console.log('received', data));
  eventBus.emit('test', 'payload');
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add js/utils/EventBus.js
  git commit -m "feat: add event bus module"
  ```

---

### Task 2: Create the InteractionManager

**Files:**
- Create: `js/utils/InteractionManager.js`

- [ ] **Step 1: Write InteractionManager base structure**
  Add class handling throttled pointer/touch raycasting and wheel listening:
  ```javascript
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
      dom.addEventListener('wheel', onWheel, { passive: false });

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
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add js/utils/InteractionManager.js
  git commit -m "feat: add interaction manager with touch and throttled raycasting"
  ```

---

### Task 3: Refactor Rides to Support Decoupled Inputs and speedMultiplier

**Files:**
- Modify: `js/environment/FerrisWheel.js`
- Modify: `js/environment/Carousel.js`

- [ ] **Step 1: Update FerrisWheel speedMultiplier and remove local raycasting**
  Remove pointermove/pointerdown handlers from `buildFerrisWheel` and support speedMultiplier:
  ```diff
  @@ -248,3 +248,4 @@
       panel: controlPanel.group,
  +    speedMultiplier: 1.0,
       get running() { return controlPanel.running; },
  @@ -265,3 +266,4 @@
       const ease = controlPanel.tick(delta);
  -    controller.angle += controller.maxSpeed * ease * delta;
  +    const speedMult = controller.speedMultiplier !== undefined ? controller.speedMultiplier : 1.0;
  +    controller.angle += controller.maxSpeed * ease * speedMult * delta;
       wheelSpin.rotation.z = controller.angle;
  @@ -282,19 +284,4 @@
  -  // ── Click-to-toggle via raycasting on the panel. ──
  -  if (camera && renderer) {
  -    const ray = new THREE.Raycaster();
  -    const ndc = new THREE.Vector2();
  -    const dom = renderer.domElement;
  -    const pick = (ev) => {
  -      const r = dom.getBoundingClientRect();
  -      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  -      ray.setFromCamera(ndc, camera);
  -      return ray.intersectObject(controlPanel.group, true).length > 0;
  -    };
  -    dom.addEventListener('pointerdown', (ev) => { if (pick(ev)) controller.toggle(); });
  -    dom.addEventListener('pointermove', (ev) => {
  -      if (pick(ev)) dom.style.cursor = 'pointer';
  -      else if (dom.style.cursor === 'pointer') dom.style.cursor = '';
  -    });
  -  }
  +  // EventBus Speed / Toggle wiring:
  +  // Reset speed on complete stop
  +  if (ease === 0) {
  +    controller.speedMultiplier = 1.0;
  +  }
  ```

- [ ] **Step 2: Update Carousel speedMultiplier and remove local raycasting**
  Remove local listeners from `buildCarousel` and support speedMultiplier:
  ```diff
  @@ -298,3 +298,4 @@
       panel: controlPanel.group,
  +    speedMultiplier: 1.0,
       get running() { return controlPanel.running; },
  @@ -311,3 +312,4 @@
       // 1. Platform rotation
  -    controller.angle += controller.maxSpeed * ease * delta;
  +    const speedMult = controller.speedMultiplier !== undefined ? controller.speedMultiplier : 1.0;
  +    controller.angle += controller.maxSpeed * ease * speedMult * delta;
       rotatingAssembly.rotation.y = - controller.angle;
  @@ -357,21 +359,4 @@
  -  // ── Raycast Toggle Handler ──
  -  if (camera && renderer) {
  -    const ray = new THREE.Raycaster();
  -    const ndc = new THREE.Vector2();
  -    const dom = renderer.domElement;
  -
  -    const pick = (ev) => {
  -      const r = dom.getBoundingClientRect();
  -      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  -      ray.setFromCamera(ndc, camera);
  -      return ray.intersectObject(controlPanel.group, true).length > 0;
  -    };
  -
  -    dom.addEventListener('pointerdown', (ev) => {
  -      if (pick(ev)) controller.toggle();
  -    });
  -
  -    dom.addEventListener('pointermove', (ev) => {
  -      if (pick(ev)) dom.style.cursor = 'pointer';
  -      else if (dom.style.cursor === 'pointer') dom.style.cursor = '';
  -    });
  -  }
  +  // EventBus Speed / Toggle wiring:
  +  // Reset speed on complete stop
  +  if (ease === 0) {
  +    controller.speedMultiplier = 1.0;
  +  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add js/environment/FerrisWheel.js js/environment/Carousel.js
  git commit -m "refactor: add speedMultiplier to rides and remove local raycasting listeners"
  ```

---

### Task 4: Integrate Lampposts with Easing and EventBus

**Files:**
- Modify: `js/environment/Lampposts.js`
- Modify: `js/lighting/DayNightCycle.js`

- [ ] **Step 1: Add ticking and EventBus listener to Lampposts**
  Update `buildLampposts` in `js/environment/Lampposts.js` to perform linear interpolation of PointLight intensity in `userData.tick`:
  ```javascript
  import { eventBus } from '../utils/EventBus.js';
  // Inside buildLampposts:
  for (const [id, x, z] of POSITIONS) {
    // ... setup lampRoot ...
    lampRoot.userData.isManual = false;
    lampRoot.userData.targetOn = false;
    lampRoot.userData.targetIntensity = 0;
  }

  // Hook day/night automatic cycle updates via event bus instead of direct value updates
  eventBus.on('time-phase-change', (data) => {
    const isNight = data.isNight;
    const nightFactor = data.nightFactor;
    
    for (const lampRoot of group.children) {
      // Reset manual override on sunrise/sunset boundary
      const wasManual = lampRoot.userData.isManual;
      if (wasManual) {
        lampRoot.userData.isManual = false;
      }
      lampRoot.userData.targetOn = isNight;
      lampRoot.userData.nightFactor = nightFactor;
    }
  });

  group.userData.tick = (delta, time) => {
    for (const lampRoot of group.children) {
      const pl = lampRoot.userData.pointLight;
      if (!pl) continue;

      let targetIntensity = 0;
      if (lampRoot.userData.targetOn) {
        if (lampRoot.userData.isManual) {
          targetIntensity = 14;
        } else {
          const nf = lampRoot.userData.nightFactor !== undefined ? lampRoot.userData.nightFactor : 1.0;
          targetIntensity = nf * 14;
        }
      }

      // Smooth transition (0.8s) -> Rate = 14 / 0.8 = 17.5 units per second
      const rate = 17.5 * delta;
      const diff = targetIntensity - pl.intensity;
      if (Math.abs(diff) > 0.01) {
        pl.intensity += Math.sign(diff) * Math.min(rate, Math.abs(diff));
      } else {
        pl.intensity = targetIntensity;
      }
    }
  };
  ```

- [ ] **Step 2: Update DayNightCycle to emit phase change and nightFactor**
  Replace direct lamppost updates in `DayNightCycle.js` with `eventBus.emit`:
  ```javascript
  // Remove lamppost direct setting inside _apply() in DayNightCycle.js:
  // Instead, emit event:
  const isNight = sunHeight < 0.25;
  eventBus.emit('time-phase-change', { isNight, nightFactor });
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add js/environment/Lampposts.js js/lighting/DayNightCycle.js
  git commit -m "feat: integrate lampposts with EventBus and smooth easing"
  ```

---

### Task 5: Enhance index.html with HTML Color Picker and Keyboard Help Overlay

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add HTML Color Picker and Toggle elements in `#hud`**
  Modify index.html to include:
  - Auto-advance checkbox/toggle
  - Ride decoration light color picker
  - "?" Button that toggles keyboard help details
  ```html
  <!-- Inside #hud -->
  <label style="pointer-events: auto;">
    Auto: <input id="autoTime" type="checkbox" checked style="vertical-align: middle;" />
  </label>
  <label style="pointer-events: auto; margin-left: 10px;">
    Lights Color: <input id="lightColor" type="color" value="#ffdd88" style="vertical-align: middle; border: none; height: 20px; width: 40px; background: none; cursor: pointer;" />
  </label>
  <button id="helpBtn" style="pointer-events: auto; margin-left: 10px; background: #333; border: 1px solid #555; color: #fff; cursor: pointer; border-radius: 4px; padding: 2px 6px;">?</button>
  
  <div id="helpPanel" style="display: none; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px;">
    <strong>Controls:</strong><br />
    Space: Play/Pause Time Cycle<br />
    Scroll on Ride: Alter Speed (0.2x - 3.0x)<br />
    Click Lamp: Toggle Light On/Off
  </div>
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add index.html
  git commit -m "feat: add color picker and help UI controls to HTML HUD"
  ```

---

### Task 6: Hook Up InteractionManager and EventBus in Main App Loop

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Wire all events in main.js**
  Import `eventBus` and `InteractionManager`. Register clickables and rides. Wire UI elements to Events.
  ```javascript
  import { eventBus } from './utils/EventBus.js';
  import { InteractionManager } from './utils/InteractionManager.js';

  // Inside init():
  const interactionManager = new InteractionManager(camera, renderer, scene);

  // Register interactive lamppost objects
  lamps.children.forEach(lamp => {
    interactionManager.registerClickable(lamp);
  });

  // Register interactive control panels
  interactionManager.registerClickable(ferrisWheel.userData.controller.panel);
  interactionManager.registerClickable(carousel.userData.controller.panel);

  // Register rides for speed scrolling
  interactionManager.registerRide(ferrisWheel);
  interactionManager.registerRide(carousel);

  // Wire Interaction events:
  eventBus.on('interact-click', ({ object }) => {
    // 1. Check if lamppost clicked
    let curr = object;
    while (curr && !curr.userData.lampId) {
      curr = curr.parent;
    }
    if (curr && curr.userData.lampId) {
      curr.userData.isManual = true;
      curr.userData.targetOn = !curr.userData.targetOn;
      return;
    }

    // 2. Check if control panel clicked
    curr = object;
    while (curr && curr.name !== 'controlPanel') {
      curr = curr.parent;
    }
    if (curr) {
      // Find associated ride controller
      if (ferrisWheel.userData.controller.panel === curr) ferrisWheel.userData.controller.toggle();
      if (carousel.userData.controller.panel === curr) carousel.userData.controller.toggle();
    }
  });

  // Wire speed multiplier updates:
  eventBus.on('speed-scroll', ({ rideId, delta }) => {
    let controller = null;
    if (rideId === 'ferrisWheel') controller = ferrisWheel.userData.controller;
    if (rideId === 'carousel') controller = carousel.userData.controller;

    if (controller) {
      controller.speedMultiplier = Math.max(0.2, Math.min(3.0, controller.speedMultiplier + delta));
    }
  });

  // Wire Color Picker:
  const colorInput = document.getElementById('lightColor');
  if (colorInput) {
    colorInput.addEventListener('input', () => {
      eventBus.emit('color-change', colorInput.value);
    });
    // Set initial color
    eventBus.emit('color-change', colorInput.value);
  }

  // Listen for Carousel light color change
  const carouselBulbsMat = carousel.getObjectByName('rotatingAssembly')?.children
    .find(c => c.material && c.material.emissive !== undefined)?.material;
  if (carouselBulbsMat) {
    eventBus.on('color-change', (hex) => {
      carouselBulbsMat.color.set(hex);
      carouselBulbsMat.emissive.set(hex);
    });
  }

  // Wire UI Toggle and Space Bar for Auto-Advance:
  let autoAdvance = true;
  const autoCheckbox = document.getElementById('autoTime');
  if (autoCheckbox) {
    autoCheckbox.addEventListener('change', () => {
      autoAdvance = autoCheckbox.checked;
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      // Check if user is focusing a button or textbox
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'BUTTON')) {
        return;
      }
      autoAdvance = !autoAdvance;
      if (autoCheckbox) autoCheckbox.checked = autoAdvance;
    }
  });

  // Help button listener:
  const helpBtn = document.getElementById('helpBtn');
  const helpPanel = document.getElementById('helpPanel');
  if (helpBtn && helpPanel) {
    helpBtn.addEventListener('click', () => {
      helpPanel.style.display = helpPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Inside animate() loop, update time if autoAdvance is on:
  if (autoAdvance && dayNight) {
    const hoursPerSec = 0.4;
    let nextHour = dayNight.t * 24 + hoursPerSec * delta;
    if (nextHour >= 24) nextHour -= 24;
    dayNight.setHour(nextHour);

    const timeInput = document.getElementById('timeOfDay');
    const timeVal = document.getElementById('timeVal');
    if (timeInput) timeInput.value = nextHour;
    if (timeVal) {
      const h = Math.floor(nextHour);
      const m = Math.floor((nextHour - h) * 60);
      timeVal.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // Tick lampposts group:
  if (lamps && lamps.userData.tick) {
    lamps.userData.tick(delta, time);
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add js/main.js
  git commit -m "feat: integrate InteractionManager, EventBus and UI elements in main application loop"
  ```
