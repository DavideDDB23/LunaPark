# Raise Panoramic Train Track — Central North Zone (In Front of Stage)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the Y coordinate of 5 CatmullRom control points in the panoramic train's track to form a smooth elevated panoramic arc above the central north zone (in front of the stage at Z = -88).

**Architecture:** Modify a single constant array in `src/rides/Train.js` (the `CONTROL_POINTS` for the CatmullRom curve). The curve is re-evaluated downstream — rails, sleepers, support pillars, nav-grid footprint, and wagon positions all auto-regenerate from the updated curve. No other files require changes.

**Tech Stack:** Three.js r170, CatmullRomCurve3 (tension 0.5, closed loop), tween.js.

---

## Task 1: Elevate control points in the north zone

**Files:**
- Modify: `src/rides/Train.js:10-30` (the `CONTROL_POINTS` array)

- [ ] **Step 1: Edit the 5 control points**

In `src/rides/Train.js`, replace the entire `CONTROL_POINTS` array (lines 10–30) with:

```javascript
const CONTROL_POINTS = [
  new THREE.Vector3(0, 11.0, -58),    // CHANGED: 5.5 → 11.0 — central north peak (panoramic arc apex)
  new THREE.Vector3(45, 11.0, -80),   // CHANGED: 1.2 → 11.0 — NE peak
  new THREE.Vector3(82, 5.5, -82),    // CHANGED: 1.2 → 5.5  — NE outer transition (ramp)
  new THREE.Vector3(92, 0.3, -40),    // East-North (near East fence)
  new THREE.Vector3(88, 3.5, -12),    // East transition
  new THREE.Vector3(72, 5.5, 12),     // East River crossing
  new THREE.Vector3(45, 8.5, 18),     // Curve north of coaster
  new THREE.Vector3(22, 11.5, 26),    // High scenic bridge
  new THREE.Vector3(15, 11.5, 34),    // High flyover
  new THREE.Vector3(0, 11.5, 39),     // High street crossing
  new THREE.Vector3(-6.0, 11.5, 43.5),
  new THREE.Vector3(-18, 11.5, 60),   // High curve
  new THREE.Vector3(-50, 6.5, 78),    // South-West transition
  new THREE.Vector3(-85, 1.2, 92),    // SW outer corner
  new THREE.Vector3(-92, 0.3, 40),    // West-South
  new THREE.Vector3(-92, 5.5, 0),     // West River crossing
  new THREE.Vector3(-92, 0.3, -40),   // West-North
  new THREE.Vector3(-82, 5.5, -82),   // CHANGED: 1.2 → 5.5  — NW outer transition (ramp)
  new THREE.Vector3(-45, 11.0, -80),  // CHANGED: 1.2 → 11.0 — NW peak
];
```

- [ ] **Step 2: Verify the file parses**

Run: `node -e "import('./src/rides/Train.js').then(m => console.log('ok')).catch(e => console.error(e.message))"`
Expected: Either `ok` (if module loaded) or a syntax error message. If syntax error, fix and re-run.

Note: this is a `.js` ESM module that imports three.js and runs an async function. A `node -e` import alone may fail on three's WebGL/dom dependencies — that's fine, we're only checking syntax. If `node --check src/rides/Train.js` is available, prefer that:

Run: `node --check src/rides/Train.js`
Expected: exits 0 with no output.

- [ ] **Step 3: Visual verification in the browser**

Open `http://localhost:8080` (dev server is already running per AGENTS.md). Press `1` (overview preset) and `6` (stage preset). Verify:
- An elevated track arc is visible in the north zone, peaking above the stage.
- Train wagons run smoothly along the new arc with no visible kinks or clipping.
- No console errors in the browser DevTools console.

- [ ] **Step 4: Commit**

```bash
git add src/rides/Train.js
git commit -m "feat(train): raise north zone track for panoramic arc above stage"
```

---

## Self-Review

- **Spec coverage:** All 5 control point changes from the design are present.
- **Placeholder scan:** No TBD/TODO. All values are concrete numbers.
- **Type consistency:** `THREE.Vector3(x, y, z)` signature is unchanged; only the y components differ.
- **Downstream impact:** Pillars (lines 102-154) auto-regenerate, footprint (lines 56-62) is XZ-only and unaffected, wagons (line 320-333) auto-position from new curve. Y-clamp (lines 42-49) ensures no underground dips.
