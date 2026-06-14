# Sun Shadow & Daylight HUD Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two related shadow system bugs: (1) some trees cast no shadow due to undersized shadow frustum, (2) shadow direction is mirrored relative to the HUD time arc.

**Architecture:** Two surgical changes to the existing lighting system: enlarge the directional light's orthographic shadow frustum to cover the full park extent, and invert the sun's X-axis traversal so shadows fall in the direction the HUD suggests. No new files, no new dependencies.

**Tech Stack:** Three.js (DirectionalLight shadow camera, world-space orthographic projection)

**Spec:** `docs/superpowers/specs/2026-06-13-sun-shadow-hud-alignment-design.md`

---

## File Structure

| File | Responsibility | Change Type |
|------|----------------|-------------|
| `js/lighting/LightManager.js` | Creates sun directional light with shadow camera | Modify: enlarge shadow frustum extent |
| `js/lighting/DayNightCycle.js` | Drives sun position over time of day | Modify: invert X-axis, update header comment |

---

### Task 1: Enlarge Shadow Frustum

**Files:**
- Modify: `js/lighting/LightManager.js:16-19`

- [ ] **Step 1: Open `js/lighting/LightManager.js` and locate the shadow camera setup**

Read lines 16-19. Current code:
```javascript
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
```

- [ ] **Step 2: Replace the shadow camera extent from ±80 to ±110**

Replace lines 16-19 with:
```javascript
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
```

- [ ] **Step 3: Add `updateProjectionMatrix()` call after line 19**

Insert immediately after the four extent assignments:
```javascript
sun.shadow.camera.updateProjectionMatrix();
```

The full block (lines 16-20) should now read:
```javascript
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.camera.updateProjectionMatrix();
```

- [ ] **Step 4: Verify the change by reading the modified file**

Run:
```bash
cat js/lighting/LightManager.js | grep -A 5 "sun.shadow.camera.left"
```

Expected output:
```
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.camera.updateProjectionMatrix();
```

- [ ] **Step 5: Commit the shadow frustum fix**

```bash
git add js/lighting/LightManager.js
git commit -m "fix: enlarge sun shadow frustum to ±110 to cover full park

The shadow camera extent was ±80 but vegetation is scattered across
±95 units. Trees beyond the frustum cast no shadow, creating a
'random' pattern that changed with the time of day as the sun's
elevation shifted objects relative to the fixed world-anchored frustum.

Extent ±110 covers the full ±95 park extent with 15-unit margin.
Added updateProjectionMatrix() call to ensure the camera updates."
```

---

### Task 2: Invert Sun X-Axis

**Files:**
- Modify: `js/lighting/DayNightCycle.js:14-19` (header comment)
- Modify: `js/lighting/DayNightCycle.js:68` (sun position calculation)

- [ ] **Step 1: Update the header comment to reflect the new sun-axis convention**

Open `js/lighting/DayNightCycle.js` and locate lines 14-19. Current comment:
```javascript
// Time convention: t ∈ [0, 1] where
//   0.00 = midnight       sun at -90° (under horizon)
//   0.25 = sunrise        sun on +X horizon
//   0.50 = noon           sun overhead
//   0.75 = sunset         sun on -X horizon
//   1.00 = midnight (wraps)
```

Replace with:
```javascript
// Time convention: t ∈ [0, 1] where
//   0.00 = midnight       sun at -90° (under horizon)
//   0.25 = sunrise        sun on -X horizon (west)
//   0.50 = noon           sun overhead
//   0.75 = sunset         sun on +X horizon (east)
//   1.00 = midnight (wraps)
```

- [ ] **Step 2: Invert the sun's X-axis calculation**

Locate line 68. Current code:
```javascript
const sunX = Math.cos(sunAngle);
```

Replace with:
```javascript
const sunX = -Math.cos(sunAngle);
```

The full block (lines 66-69) should now read:
```javascript
const sunAngle = (t - 0.25) * Math.PI * 2;
const sunY = Math.sin(sunAngle);
const sunX = -Math.cos(sunAngle);
const sunZ = 0.25; // small southward bias so shadows aren't axis-aligned
```

- [ ] **Step 3: Verify the change by reading the modified file**

Run:
```bash
cat js/lighting/DayNightCycle.js | grep -A 3 "const sunAngle"
```

Expected output:
```
const sunAngle = (t - 0.25) * Math.PI * 2;
const sunY = Math.sin(sunAngle);
const sunX = -Math.cos(sunAngle);
const sunZ = 0.25; // small southward bias so shadows aren't axis-aligned
```

- [ ] **Step 4: Verify the header comment update**

Run:
```bash
cat js/lighting/DayNightCycle.js | grep -A 5 "Time convention"
```

Expected output:
```
// Time convention: t ∈ [0, 1] where
//   0.00 = midnight       sun at -90° (under horizon)
//   0.25 = sunrise        sun on -X horizon (west)
//   0.50 = noon           sun overhead
//   0.75 = sunset         sun on +X horizon (east)
//   1.00 = midnight (wraps)
```

- [ ] **Step 5: Commit the sun axis inversion**

```bash
git add js/lighting/DayNightCycle.js
git commit -m "fix: invert sun X-axis to align shadows with HUD time arc

The HUD draws sunrise on the left and sunset on the right. With the
sun rising at world +X (east), shadows at sunrise fell to world -X
(west), which appeared on the right side of the screen from the
default camera preset (NE looking at origin). This created a mismatch
between the HUD's 'sun on the left' reading and the actual shadow
direction.

Inverting sunX = -Math.cos(sunAngle) makes the sun rise at world -X
(west) and set at world +X (east). Now shadows at sunrise point toward
world +X (east), which appears on the left of the screen from the
default camera — matching the HUD's sunrise-on-the-left convention.

Updated header comment to reflect the new convention: sunrise at -X
(west), sunset at +X (east)."
```

---

### Task 3: Visual Verification

**Files:**
- None (manual visual testing)

- [ ] **Step 1: Build and serve the project**

Run:
```bash
npm run dev
```

Expected: Local dev server starts (typically `http://localhost:5173` or similar).

- [ ] **Step 2: Open the scene in a browser and navigate to noon (12:00)**

Open the dev server URL. Use the time slider in the HUD to set the time to 12:00 (t = 0.5).

Expected behavior:
- Sun is directly overhead (sunY = 1, sunX = 0).
- All 90 trees cast a small shadow puddle directly beneath them.
- No trees are missing shadows.

- [ ] **Step 3: Navigate to mid-morning (08:00) and verify shadow direction**

Set the time slider to 08:00 (t ≈ 0.33).

Expected behavior:
- Sun is in the southwest sky (sunX ≈ -0.87, sunY ≈ 0.5).
- Shadows extend to the northeast of each tree (world +X, -Z direction).
- From the default camera preset 1 (NE looking at origin), shadows appear to the upper-left of each tree.

- [ ] **Step 4: Navigate to sunset (18:00) and verify shadow direction**

Set the time slider to 18:00 (t = 0.75).

Expected behavior:
- Sun is at world +X (east), low on the horizon.
- Shadows extend to world -X (west), appearing on the right side of the screen from the default camera.

- [ ] **Step 5: Cross-check HUD consistency at sunrise (06:00)**

Set the time slider to 06:00 (t = 0.25).

Expected behavior:
- HUD shows the sun icon on the **left** side of the arc.
- In the world, the sun is at world -X (west), which appears on the **right** of the screen from the default camera.
- Shadows point toward world +X (east), which appears on the **left** of the screen.
- The HUD's "sun on the left" reading is consistent with shadows falling to the left.

- [ ] **Step 6: Test cross-time smoothness**

Enable auto-advance (if available) or manually drag the time slider from 06:00 to 18:00.

Expected behavior:
- Shadow direction rotates smoothly, never jumps or teleports.
- HUD sun icon moves smoothly along the arc.
- Shadow direction and HUD position remain "on the same side" throughout.

- [ ] **Step 7: Test all camera presets**

Cycle through camera presets 1-6 (keys 1-6):
- Preset 1: Overview (NE)
- Preset 2: Ferris Wheel (NW)
- Preset 3: Carousel (NE)
- Preset 4: Roller Coaster (SE)
- Preset 5: Tagada (SW)
- Preset 6: Stage (N)

At each preset, set the time to 12:00 (noon).

Expected behavior:
- Each ride's local geometry casts a shadow.
- All shadows are within the ±110 frustum.
- No geometry is missing shadows.

- [ ] **Step 8: Final commit (if any adjustments were needed)**

If no changes were needed during visual testing, skip this step.

If adjustments were made (e.g., further tuning of shadow bias, frustum extent), commit them:
```bash
git add <modified files>
git commit -m "fix: adjust sun shadow system based on visual testing

<Describe what was adjusted and why>"
```

---

## Summary

**Total changes:**
- 2 files modified
- ~5 lines of code changed (4 extent values + 1 sign inversion)
- 2 commits (one per bug fix)
- 1 manual visual verification pass

**No new files, no new dependencies, no breaking changes.**

**Rollback:** If either fix causes issues, revert the corresponding commit:
```bash
git revert <commit-hash>
```
