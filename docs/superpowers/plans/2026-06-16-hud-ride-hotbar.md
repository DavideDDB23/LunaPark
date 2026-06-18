# HUD Ride Hotbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the keyboard `C` FPV activation (which auto-picks the nearest ride) with a permanent bottom hotbar containing 6 explicit ride buttons, so the user always enters the FPV of the ride they intend.

**Architecture:** Three layers — (1) a new pure-UI component `RideHotbar` renders 6 buttons in a fixed bottom bar, (2) `CameraManager` gains an `enterFPVById(rideId)` method (the keyboard `C` handler is removed), (3) `Balloon.js` is refactored to expose the 3 sub-balloons as separate groups with independent bounding boxes (so they aren't visually squashed) and the first one is registered as a FPV ride. `App.js` wires all of these together: tags every ride with a `rideId`, registers the first balloon, and initializes the hotbar.

**Tech Stack:** Three.js r170, ESM modules, vanilla DOM/CSS, no new dependencies.

---

## File Map

| File | Type | Responsibility |
|---|---|---|
| `src/ui/RideHotbar.js` | NEW | Render bottom hotbar with 6 buttons. Pure view: takes `rides[]`, `onSelect(rideId, opts)`, `getActiveRideId()`. Updates the `.is-active` class each frame via rAF. |
| `src/rides/Balloon.js` | MODIFIED | Split the GLB's 3 balloons into 3 separate `THREE.Group`s, each with its own bbox-scaled mesh, own `PointLight`, own `tick`, own `userData.driftAngle`. Return `{ group, balloons: [b1, b2, b3] }`. |
| `src/controls/CameraManager.js` | MODIFIED | Remove the `c`/`C` key handler. Add `enterFPVById(rideId)`. |
| `src/App.js` | MODIFIED | Tag each of the 5 existing rides with `userData.rideId`. Register `balloons[0]` as a 6th ride with FPV getters. Init the hotbar. Update `world.balloons` and the animate loop. |
| `index.html` | MODIFIED | Replace the `<kbd>C</kbd>` help line. |
| `README.md` | MODIFIED | Replace the `C` row in the Controls table. |

No other files are touched. Render loop, day/night, visitors, other 4 rides, shooting gallery, stage, lampposts, fireworks: untouched.

---

## Task 1: `RideHotbar` component (NEW)

**Files:**
- Create: `src/ui/RideHotbar.js`

- [ ] **Step 1: Create the new file**

Create `src/ui/RideHotbar.js` with the following content:

```javascript
const CSS_TEXT = `
#rideHotbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(12, 15, 22, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  z-index: 6;
  pointer-events: none;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
.ride-btn {
  pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-width: 76px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px; font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.ride-btn:hover {
  border-color: rgba(255, 160, 28, 0.55);
  background: rgba(255, 160, 28, 0.08);
}
.ride-btn:active { transform: scale(0.97); }
.ride-btn.is-active {
  border-color: #ffa01c;
  background: rgba(255, 160, 28, 0.18);
  box-shadow: 0 0 12px rgba(255, 160, 28, 0.45);
  color: #ffd9a8;
}
.ride-btn-icon { width: 24px; height: 24px; display: block; line-height: 0; }
.ride-btn[disabled] { opacity: 0.4; cursor: not-allowed; }
.ride-btn[disabled]:hover { border-color: rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04); }
@media (max-width: 480px) {
  .ride-btn { min-width: 52px; padding: 6px 8px; }
  .ride-btn-label { font-size: 10px; }
}
`;

export function setupRideHotbar({ rides, onSelect, getActiveRideId }) {
  if (!Array.isArray(rides) || rides.length === 0) return { destroy() {} };
  if (typeof onSelect !== 'function') throw new Error('setupRideHotbar: onSelect must be a function');
  if (typeof getActiveRideId !== 'function') throw new Error('setupRideHotbar: getActiveRideId must be a function');

  const styleEl = document.createElement('style');
  styleEl.id = 'rideHotbarStyles';
  styleEl.textContent = CSS_TEXT;
  document.head.appendChild(styleEl);

  const root = document.createElement('div');
  root.id = 'rideHotbar';

  const btnById = new Map();
  for (const ride of rides) {
    const btn = document.createElement('button');
    btn.className = 'ride-btn';
    btn.type = 'button';
    btn.dataset.rideId = ride.id;

    const icon = document.createElement('span');
    icon.className = 'ride-btn-icon';
    icon.innerHTML = ride.icon;
    btn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'ride-btn-label';
    label.textContent = ride.name;
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      const isActive = getActiveRideId() === ride.id;
      onSelect(ride.id, { toggle: isActive });
    });

    root.appendChild(btn);
    btnById.set(ride.id, btn);
  }
  document.body.appendChild(root);

  let raf = 0;
  let lastActive = null;
  const sync = () => {
    const active = getActiveRideId();
    if (active === lastActive) {
      raf = requestAnimationFrame(sync);
      return;
    }
    lastActive = active;
    for (const [id, btn] of btnById) {
      btn.classList.toggle('is-active', id === active);
    }
    raf = requestAnimationFrame(sync);
  };
  raf = requestAnimationFrame(sync);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      styleEl.remove();
      root.remove();
    }
  };
}
```

- [ ] **Step 2: Verify the file parses**

Run: `node --check src/ui/RideHotbar.js`
Expected: exits 0 with no output. If a syntax error, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/ui/RideHotbar.js
git commit -m "feat(ui): add RideHotbar component for explicit FPV ride selection"
```

---

## Task 2: `CameraManager.enterFPVById` + remove `C` key

**Files:**
- Modify: `src/controls/CameraManager.js:319-321` (remove `C` handler)
- Modify: `src/controls/CameraManager.js` (add `enterFPVById` method after `enterFPV`)

- [ ] **Step 1: Remove the `C` key handler**

In `src/controls/CameraManager.js`, locate the `_onKeyDown` method. Find these lines (the second `else if` branch in the key dispatch chain):

```javascript
    } else if (key === 'c' || key === 'C') {
      if (this.state === 'fpv') { this.exitFPV(); }
      else if (this.state === 'orbit' || this.state === 'flying') { this.enterFPV(); }
    } else if (key === 'Escape') {
```

Delete the entire `else if (key === 'c' || key === 'C') { ... }` block. The result should leave just:

```javascript
    } else if (key === 'Escape') {
      if (this.state === 'fpv') this.exitFPV();
      else if (this.state === 'flying') this._finishFlight();
    }
```

- [ ] **Step 2: Add `enterFPVById` method**

In `src/controls/CameraManager.js`, add the following method immediately after the existing `enterFPV()` method (after its closing `}` around line 150):

```javascript
  enterFPVById(rideId) {
    const rides = this.getRides();
    if (!rides || rides.length === 0) return;

    const ride = rides.find(r => r.group?.userData?.rideId === rideId);
    if (!ride) {
      console.warn('[CameraManager] No ride with id', rideId);
      return;
    }

    if (this.state === 'fpv' && this._fpvRide === ride) {
      this.exitFPV();
      return;
    }

    if (this.state === 'fpv') {
      this._cleanupFPV();
    }

    const target = ride.getFpvTarget();
    if (!target) {
      console.warn('[CameraManager] Ride', rideId, 'has no FPV target');
      return;
    }

    this._fpvTarget = target;
    this._fpvRide = ride;
    this._fpvOffset.copy(ride.getFpvOffset());

    this._hiddenRiders = [];
    if (ride.getRiders) {
      const riders = ride.getRiders();
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
```

- [ ] **Step 3: Verify the file parses**

Run: `node --check src/controls/CameraManager.js`
Expected: exits 0 with no output.

- [ ] **Step 4: Visual sanity check (no behavior change yet)**

Open `http://localhost:8080`. Press `1`–`6` to confirm preset cameras still work. Press `ESC` during a flight — should still abort. Press `C` — should now do nothing (was the previous FPV toggle).
Expected: presets work, `ESC` aborts, `C` is a no-op.

- [ ] **Step 5: Commit**

```bash
git add src/controls/CameraManager.js
git commit -m "feat(camera): replace proximity-based C FPV with enterFPVById"
```

---

## Task 3: `Balloon.js` refactor — split 3 sub-balloons

**Files:**
- Modify: `src/rides/Balloon.js`

- [ ] **Step 1: Replace the file contents**

Replace the entire content of `src/rides/Balloon.js` with:

```javascript
import * as THREE from 'three';
import { loadGLB, sanitizeMaterials } from '../utils/loaders.js';
import { eventBus } from '../utils/EventBus.js';

const BALLOON_URL = 'assets/models/rides/balloon.glb';
const TARGET_HEIGHT = 14;
const SPAWN_RADIUS = 30;
const SPAWN_Y_MIN = 35;
const SPAWN_Y_MAX = 45;

function deterministicSeed(i) {
  return i * 137 * Math.PI / 180 + 5.7;
}

async function buildOneBalloon(model, index) {
  const node = model.getObjectByName('V1_HotAirBalloon_' + index);
  if (!node) {
    console.warn('[Balloon] GLB missing sub-root V1_HotAirBalloon_' + index);
    return null;
  }

  const bbox = new THREE.Box3().setFromObject(node);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
  node.scale.setScalar(scale);

  const scaledBbox = new THREE.Box3().setFromObject(node);
  const center = new THREE.Vector3();
  scaledBbox.getCenter(center);
  node.position.x -= center.x;
  node.position.z -= center.z;
  node.position.y -= scaledBbox.min.y;

  node.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const b = new THREE.Group();
  b.name = 'balloon_' + index;

  b.add(node);
  b.userData.fpvTarget = node;

  const seed = deterministicSeed(index);
  const angle = seed;
  const dist = ((index * 7.3) % 1) * SPAWN_RADIUS;
  const baseX = Math.cos(angle) * dist;
  const baseZ = Math.sin(angle) * dist;
  const baseY = SPAWN_Y_MIN + ((index * 3.1) % 1) * (SPAWN_Y_MAX - SPAWN_Y_MIN);
  b.position.set(baseX, baseY, baseZ);
  b.userData.baseY = baseY;

  const balloonLight = new THREE.PointLight(0xff8844, 0, 25, 1.5);
  balloonLight.position.set(0, TARGET_HEIGHT * 0.5, 0);
  b.add(balloonLight);

  let driftAngle = angle;
  let nightFactor = 0;
  b.userData.driftAngle = driftAngle;

  eventBus.on('time-phase-change', (data) => {
    nightFactor = data.nightFactor;
  });

  b.userData.tick = (delta, time, windSpeed = 1) => {
    const dt = Math.min(delta, 0.05);

    driftAngle += Math.sin(time * 0.02 + index) * 0.001 * windSpeed;
    b.userData.driftAngle = driftAngle;
    const driftSpeed = windSpeed * 1.5;
    b.position.x += Math.cos(driftAngle) * driftSpeed * dt;
    b.position.z += Math.sin(driftAngle) * driftSpeed * dt;

    const distFromCenter = Math.sqrt(b.position.x ** 2 + b.position.z ** 2);
    if (distFromCenter > 70) {
      const toCenterAngle = Math.atan2(-b.position.z, -b.position.x);
      driftAngle += (toCenterAngle - driftAngle) * 0.05;
    }

    b.position.y = baseY + Math.sin(time * 0.3 + index) * 1.5;
    b.rotation.z = Math.sin(time * 0.5 + windSpeed + index) * 0.08;
    b.rotation.x = Math.sin(time * 0.4 + windSpeed * 0.7 + index) * 0.05;

    balloonLight.intensity = nightFactor * 40;
  };

  return b;
}

export async function buildBalloon() {
  const group = new THREE.Group();
  group.name = 'balloon';

  let gltf;
  try {
    gltf = await loadGLB(BALLOON_URL);
  } catch (err) {
    console.error('[Balloon] Failed to load GLB:', err);
    return { group, balloons: [] };
  }
  const model = gltf.scene;
  sanitizeMaterials(model);

  const balloons = [];
  for (let i = 1; i <= 3; i++) {
    const b = await buildOneBalloon(model, i);
    if (b) {
      group.add(b);
      balloons.push(b);
    }
  }

  if (balloons[0]) {
    balloons[0].userData.rideId = 'balloon';
    balloons[0].userData.rideName = 'Mongolfiera';
  }

  return { group, balloons };
}
```

- [ ] **Step 2: Verify the file parses**

Run: `node --check src/rides/Balloon.js`
Expected: exits 0 with no output.

- [ ] **Step 3: Commit (the file change is broken until App.js is updated — DO NOT visually verify yet)**

```bash
git add src/rides/Balloon.js
git commit -m "feat(balloon): split GLB into 3 independent balloon groups"
```

Note: this commit will leave `src/App.js` broken (it still calls `await buildBalloon()` expecting a `THREE.Group`). The next task fixes that.

---

## Task 4: `App.js` — adopt new balloon return shape + add rideId tags + init hotbar

**Files:**
- Modify: `src/App.js` (8 distinct edits)

- [ ] **Step 1: Update the `buildBalloon` call site (lines 356-357)**

Find:

```javascript
  const balloon = await buildBalloon();
  environmentGroup.add(balloon);
```

Replace with:

```javascript
  const { group: balloonContainer, balloons } = await buildBalloon();
  environmentGroup.add(balloonContainer);
```

- [ ] **Step 2: Tag the 5 existing rides with `rideId` in their `userData`**

In `src/App.js`, find the `cameraManager = new CameraManager(...)` block (around lines 108-266). The factory results `fw`, `cr`, `tg`, `co`, `tr` are the `THREE.Group`s of each ride. We need to attach `userData.rideId` to each.

Just before the line `cameraManager = new CameraManager(...)`, add the following tagging block (right after `let fpvTmpVec = new THREE.Vector3();` and `const fpvTmpQuat = new THREE.Quaternion();`):

```javascript
  const fw = environmentGroup.getObjectByName('ferrisWheel');
  if (fw) { fw.userData.rideId = 'ferris'; fw.userData.rideName = 'Ruota'; }
  const cr = environmentGroup.getObjectByName('carousel');
  if (cr) { cr.userData.rideId = 'carousel'; cr.userData.rideName = 'Carosello'; }
  const tg = environmentGroup.getObjectByName('tagada');
  if (tg) { tg.userData.rideId = 'tagada'; tg.userData.rideName = 'Tagada'; }
  const co = environmentGroup.getObjectByName('coaster');
  if (co) { co.userData.rideId = 'coaster'; co.userData.rideName = 'Montagne Russe'; }
  const tr = environmentGroup.getObjectByName('train');
  if (tr) { tr.userData.rideId = 'train'; tr.userData.rideName = 'Brucomela'; }
```

Note: this declares `fw`, `cr`, `tg`, `co`, `tr` as local variables. The subsequent `if (fw) rides.push({...})` blocks can be left as-is (they reference the same names), or you may delete the duplicated `const fw = ...` lines that follow. **Keep the existing push blocks intact** — the declarations above only ADD `userData.rideId` to the same objects. Do not delete the `getRides()` callback body; just add the `userData` tags.

- [ ] **Step 3: Add the balloon #1 ride entry**

In `src/App.js`, locate the `getRides` callback passed to `CameraManager` (around line 264, just before `return rides;`). Add the following block as the last entry before `return rides;`:

```javascript
  if (balloons && balloons[0]) {
    const b1 = balloons[0];
    rides.push({
      group: b1,
      getFpvTarget: () => b1.userData.fpvTarget,
      getFpvOffset: () => new THREE.Vector3(0, 1.5, 0),
      getRiders: () => [],
      getFpvCameraPos: (fpvTarget, targetVec) => {
        fpvTmpVec.set(0, 1.8, 0);
        fpvTarget.localToWorld(fpvTmpVec);
        targetVec.copy(fpvTmpVec);
      },
      getFpvLookTarget: (fpvTarget, targetVec) => {
        const driftAngle = b1.userData.driftAngle ?? 0;
        const dist = 10;
        fpvTmpVec.set(Math.cos(driftAngle) * dist, 1.8, Math.sin(driftAngle) * dist);
        fpvTarget.localToWorld(fpvTmpVec);
        targetVec.copy(fpvTmpVec);
      },
      getFpvUp: (fpvTarget, upVec) => {
        fpvTarget.getWorldQuaternion(fpvTmpQuat);
        upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
      }
    });
  }
```

- [ ] **Step 4: Update the `world` object (around line 568)**

Find:

```javascript
    lamps, stalls, fireworks, balloon, train, shootingGallery,
```

Replace `balloon,` with `balloons,`:

```javascript
    lamps, stalls, fireworks, balloons, train, shootingGallery,
```

- [ ] **Step 5: Update the animate loop (around line 624)**

Find:

```javascript
  if (world.balloon?.userData.tick) world.balloon.userData.tick(delta, time, wind);
```

Replace with:

```javascript
  if (world.balloons) {
    for (const b of world.balloons) {
      if (b.userData.tick) b.userData.tick(delta, time, wind);
    }
  }
```

- [ ] **Step 6: Add the hotbar import and init**

In `src/App.js`, find the import block at the top (lines 1-38). Add a new import for `setupRideHotbar` after the existing `Hud` import (line 37):

```javascript
import { setupRideHotbar } from './ui/RideHotbar.js';
```

Then locate the line `cameraManager.setInteractiveObjects(interactionManager.interactiveObjects);` (around line 437). Immediately after it, add:

```javascript
  setupRideHotbar({
    rides: [
      { id: 'ferris',   name: 'Ruota',          icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="7"/><path d="M12 3v14M5 10h14M7.05 5.05l9.9 9.9M7.05 14.95l9.9-9.9"/><circle cx="12" cy="10" r="1.2" fill="currentColor"/></svg>' },
      { id: 'carousel', name: 'Carosello',      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M3 9h18v2a9 9 0 0 1-18 0V9z"/><path d="M12 7v4"/></svg>' },
      { id: 'coaster',  name: 'Montagne Russe', icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h4v-3a3 3 0 0 1 6 0v3h4v-3a3 3 0 0 1 6 0v3"/><circle cx="6" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>' },
      { id: 'tagada',   name: 'Tagada',         icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>' },
      { id: 'train',    name: 'Brucomela',      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="6" width="14" height="11" rx="2"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="15" cy="20" r="1.5" fill="currentColor"/><path d="M5 12h14"/></svg>' },
      { id: 'balloon',  name: 'Mongolfiera',    icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-3.5 0-6 2.5-6 6 0 4 3 8 6 8s6-4 6-8c0-3.5-2.5-6-6-6z"/><path d="M9 17l3 4 3-4"/><path d="M12 7v6"/></svg>' }
    ],
    onSelect: (id, opts) => {
      if (opts && opts.toggle) {
        cameraManager.exitFPV();
      } else {
        cameraManager.enterFPVById(id);
      }
    },
    getActiveRideId: () =>
      cameraManager.isFPV ? cameraManager._fpvRide?.group?.userData?.rideId ?? null : null
  });
```

- [ ] **Step 7: Verify the file parses**

Run: `node --check src/App.js`
Expected: exits 0 with no output. If a syntax error, fix and re-run.

- [ ] **Step 8: Commit**

```bash
git add src/App.js
git commit -m "feat(app): wire rideId tags, balloon-1 ride, and RideHotbar init"
```

---

## Task 5: Update help text in `index.html`

**Files:**
- Modify: `index.html:713`

- [ ] **Step 1: Replace the `C` help line**

In `index.html`, find:

```html
                <li><kbd>C</kbd>: First-Person FPV Ride</li>
```

Replace with:

```html
                <li>Click ride button (bottom bar): Enter FPV</li>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "docs(hud): replace C FPV help line with hotbar hint"
```

---

## Task 6: Update README

**Files:**
- Modify: `README.md` (Controls table)

- [ ] **Step 1: Replace the `C` row**

In `README.md`, find:

```markdown
| `C` near a ride | Enter FPV ride camera |
```

Replace with:

```markdown
| Click ride button (bottom bar) | Enter FPV ride camera |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): replace C FPV control with hotbar click"
```

---

## Task 7: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Open the dev server**

The dev server is already running on `localhost:8080` (per AGENTS.md). Open `http://localhost:8080` in the browser.

- [ ] **Step 2: Verify the hotbar appears**

Expected: A dark blurred bar with 6 buttons (Ruota, Carosello, Montagne Russe, Tagada, Brucomela, Mongolfiera) is visible at the bottom of the viewport. No console errors.

- [ ] **Step 3: Verify the 3 balloons render correctly**

Pan/orbit the camera to find the 3 balloons. Expected: 3 distinct balloons, each with a different design (chevron pink-blue, chevron yellow-brown, red-white stripes), each at a different xz position, each at height ~35-45. None overlap. No console errors.

- [ ] **Step 4: Verify each ride button enters the correct FPV**

For each of the 6 buttons, click it from orbit camera. Expected: camera jumps into the FPV of that specific ride (same view as the old `C`-key behavior produced when you happened to be near it). No flight animation — instant landing.

- [ ] **Step 5: Verify toggle (click same button = exit)**

From inside a ride FPV, click the active (orange-glowing) button. Expected: FPV exits, camera returns to its previous orbit position. No errors.

- [ ] **Step 6: Verify switch (click another button = swap)**

From inside a ride FPV, click a different ride's button. Expected: camera jumps directly into the new ride's FPV, no flight. Riders hidden/shown correctly.

- [ ] **Step 7: Verify ESC still exits**

From inside a ride FPV, press `ESC`. Expected: FPV exits, camera returns to previous position. The same behavior as before (ESC unchanged).

- [ ] **Step 8: Verify the C key is dead**

Press `C` from any state. Expected: nothing happens, no console errors. The `C` key is removed.

- [ ] **Step 9: Verify mobile layout (optional)**

If a mobile viewport is available (DevTools responsive mode, 375px wide), check the hotbar. Expected: buttons shrink to ~52px min-width, labels become 10px. All 6 buttons remain visible and tappable.

- [ ] **Step 10: Verify day/night + lighting on balloons**

Wait or set time of day to night (slider to ~22:00). Expected: each of the 3 balloons has a glowing internal point light, distinct from the others. No console errors.

- [ ] **Step 11: Verify other UI elements still work**

Test: click on a control panel in the scene (should toggle a ride), click a lamppost (should toggle its light), press `1`-`6` (preset cameras), press `Space` (pause time), drag to orbit, scroll to zoom. Expected: all unchanged behavior.

- [ ] **Step 12: Check console for warnings**

Open the browser DevTools console. Expected: no warnings or errors related to CameraManager, Balloon, RideHotbar, or the missing `C` key. The only acceptable log is a single `[Balloon] GLB missing sub-root ...` line IF the GLB truly doesn't have one of the 3 sub-roots (the function then returns null and the count drops below 3; the design accounts for this).

- [ ] **Step 13: Commit verification (if any fix was needed)**

If any step required a code fix, commit it as `fix(hotbar): <description>` and re-run the affected steps. If everything passes, no commit is needed.

---

## Self-Review

- **Spec coverage:**
  - HUD ride hotbar with 6 buttons → Task 1 (RideHotbar component) + Task 4 Step 6 (App.js init)
  - Rimozione tasto `C` → Task 2 Step 1 + Task 5 Step 1 + Task 6 Step 1
  - 3 mongolfiere separate, #1 in FPV → Task 3 (Balloon refactor) + Task 4 Step 3 (balloon ride entry)
  - FPV mongolfiera segue drift/sway → Task 3 (driftAngle in userData) + Task 4 Step 3 (lookTarget uses driftAngle)
  - Toggle stesso bottone → Task 1 (opts.toggle detection) + Task 2 Step 2 (enterFPVById toggle branch)
  - Switch altro bottone istantaneo → Task 2 Step 2 (`_cleanupFPV` + immediate landing)
  - ESC esce → untouched (existing code)
  - Bar inferiore a tutto schermo → Task 1 (`position: fixed; left:0; right:0; bottom:0`)
  - Bottone attivo con glow arancione → Task 1 (`.is-active` class)
  - `pointer-events: none` sullo sfondo → Task 1 (CSS rule)
  - Help text aggiornato → Task 5
  - README aggiornato → Task 6
- **Placeholder scan:** No TBD/TODO. All code blocks are complete. All file paths are absolute within the repo.
- **Type consistency:**
  - `b.userData.driftAngle` set in `Balloon.js` (Task 3) and read in `App.js` Step 3 (Task 4) — consistent.
  - `userData.rideId` set on `fw`/`cr`/`tg`/`co`/`tr` (Task 4 Step 2) and `b1` (Task 3) and read in `CameraManager.enterFPVById` (Task 2 Step 2) — consistent.
  - `setupRideHotbar({ rides, onSelect, getActiveRideId })` signature matches between Task 1 (definition) and Task 4 Step 6 (call) — consistent.
- **Error handling coverage:**
  - Missing rideId → `enterFPVById` warns and no-ops (Task 2)
  - Missing FPV target → `enterFPVById` warns and no-ops (Task 2)
  - Missing GLB sub-root → `buildOneBalloon` warns and returns null (Task 3); `App.js` `world.balloons` may have < 3 entries; the hotbar balloon button still works as long as `balloons[0]` exists, and the ride entry guards on `balloons[0]` (Task 4 Step 3)
  - Flying state interrupted by FPV → `_cleanupFPV` called (Task 2)
- **Out of scope respected:** no sound, no fly-in animation, no `enterFPV` deprecation, no RideRegistry refactor.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-06-16-hud-ride-hotbar.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
