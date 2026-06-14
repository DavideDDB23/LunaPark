# Sun Shadow & Daylight HUD Alignment

**Date:** 2026-06-13
**Status:** Approved (brainstorming complete, awaiting implementation plan)

## Problem

Two related defects in the day/night shadow system:

1. **Some trees cast no shadow.** The pattern is not geographic — it changes with the time of day — and looks "random" to the user.
2. **Shadows fall in the direction opposite to what the time HUD suggests.** The HUD arc draws sunrise on the left and sunset on the right, but in the scene shadows at sunrise fall to the right (and vice versa).

## Root Cause Analysis

### 1. Shadow map too small

`js/lighting/LightManager.js:16-19` sets the sun's orthographic shadow frustum to `left/right/top/bottom = ±80`. The vegetation is scattered across `x,z ∈ [-95, 95]` (`js/environment/Vegetation.js:177-178` uses `(random()-0.5) * 190`). Anything outside ±80 from the origin is clipped out of the shadow map → no shadow.

The shadow camera is *not* updated when the sun moves (`js/lighting/DayNightCycle.js:75-76` updates `sun.position` and `sun.target.position` but never touches `sun.shadow.camera` and never calls `updateProjectionMatrix()`). Because Three.js projects the shadow map with extent defined in *world* coordinates, the frustum stays anchored to the world axes. As the sun's elevation changes, objects that were inside the frustum at noon drift toward its edges at sunrise/sunset, so an individual tree's "has shadow" state depends on both its seeded position and the current sun height — hence the "random" appearance.

### 2. Sun axis mirrored vs. the HUD

`DayNightCycle.js:67-68`:
```js
const sunAngle = (t - 0.25) * Math.PI * 2;
const sunY = Math.sin(sunAngle);
const sunX = Math.cos(sunAngle);
```

At `t = 0.25` (sunrise), `sunX = +1` (east). At `t = 0.75` (sunset), `sunX = -1` (west). So the sun rises in the **east** in world space.

`js/main.js:644-707 drawTimeArc` draws the HUD arc with `a = Math.PI * (1 - frac)`, placing sunrise at `cos(π) = -1` (left of the canvas) and sunset at `cos(0) = +1` (right of the canvas).

The default camera preset (`js/camera/CameraManager.js:5`, preset 1) is at `(70, 60, 70)` looking at the origin, so the observer sees:
- world `+X` on the **left** side of the screen (because the camera looks toward the origin from the NE, world +X is to the camera's left).
- world `-X` on the **right** side of the screen.

So with the current code, the sun rises at world `+X` (appears on the **left** of the screen) and shadows fall toward world `-X` (appear on the **right** of the screen). The HUD shows the sun icon on the **left** at sunrise — that part is fine. But the user reads "sun on the left" as "shadows should fall toward the left" (which is the natural reading of the HUD). The actual shadows fall toward the right. That's the mismatch.

## Goal

1. **Every tree (all 90 instances) projects a shadow on the ground at all times of day when the sun is above the horizon.**
2. **Shadow direction matches the HUD arc reading: when the HUD shows sunrise on the left, shadows at sunrise fall toward the left of the screen; at sunset they fall toward the right.**

## Design

### Change 1 — Enlarge the shadow frustum (`js/lighting/LightManager.js:16-19`)

Replace:
```js
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
```
with:
```js
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
```

Add immediately after:
```js
sun.shadow.camera.updateProjectionMatrix();
```

`±110` covers the full `±95` park extent with a 15-unit margin, so even trees at the far corners stay inside the shadow map at every sun position. The shadow camera stays anchored to world axes (no need to update its position when the sun moves — `DirectionalLight` projection in Three.js is world-orthographic).

### Change 2 — Invert the sun's X axis (`js/lighting/DayNightCycle.js:68`)

Replace:
```js
const sunX = Math.cos(sunAngle);
```
with:
```js
const sunX = -Math.cos(sunAngle);
```

Now the sun rises at world `-X` (west) and sets at world `+X` (east). From the default camera at `(70, 60, 70)` looking at the origin, world `-X` is on the **right** of the screen and world `+X` is on the **left**. So:
- At sunrise the sun is at world `-X` → appears on the **right** of the screen.
- At sunset the sun is at world `+X` → appears on the **left** of the screen.

The HUD arc is **not changed** — it stays as the user expects (sunrise on the **left**, sunset on the **right**). The shadows must follow the HUD reading.

For shadows at sunrise to fall to the **left** of the screen, the sun at sunrise must be on the **right** of the screen. The right of the screen is world `-X`. So at sunrise (`t = 0.25`) we need `sunX = -1`.

That's exactly what this change does. The original HUD code (`a = Math.PI * (1 - frac)`) is unchanged.

## Summary of the final design

- **Change 1:** `LightManager.js` — extend `sun.shadow.camera` ortho extent from `±80` to `±110`, add `updateProjectionMatrix()`.
- **Change 2:** `DayNightCycle.js:68` — invert sun's X axis: `sunX = -Math.cos(sunAngle)`.
- **No change** to the HUD arc — it stays as the user expects (sunrise on the left, sunset on the right).
- **No change** to `sunZ` — the `0.25` southward bias remains so shadows aren't axis-aligned.
- **No change** to vegetation placement, ground, paths, or anything else.

## Why this works

- After Change 1, every tree in the `[-95, 95]` park is always inside the orthographic shadow frustum (which has `±110` extent on each axis and is anchored to the world origin where the `sun.target` lives). So every tree projects a shadow whenever the sun is above the horizon.
- After Change 2, at sunrise the sun is at world `-X`. From the default camera (NE looking at origin), the sun appears on the **right** of the screen. The shadows at sunrise point toward world `+X`, which appears on the **left** of the screen from the default camera. This matches the HUD's "sun on the left" reading: the user sees the HUD sun icon on the left, and the shadows falling to the left of the screen — both consistent with "the sun is in the west direction, shadows fall to the east."

## Affected modules

| File | Lines | Change |
| --- | --- | --- |
| `js/lighting/LightManager.js` | 16-19 | ±80 → ±110, add `updateProjectionMatrix()` |
| `js/lighting/DayNightCycle.js` | 68 | `cos` → `-cos` |
| `js/lighting/DayNightCycle.js` | 14-19 | Update comment header to reflect new sun-axis convention |

No new dependencies. No new files. Backward compatible: every other consumer of `sun` (water shader uniform `uSunDir`, lamppost night-fade, sky HDR, `getSunFor` cache) continues to work; they only consume the sun's world position, which is still normalized and correctly used for both lighting direction and shadow direction.

## Testing

Manual visual checks (no automated render test framework in this project):

1. **Noon (12:00, `t = 0.5`):** `sunY = 1`, `sunX = 0`. Sun directly overhead, shadows very short and circular under each tree. Verify *all 90 trees* show a shadow puddle beneath them.
2. **Mid-morning (08:00, `t ≈ 0.33`):** `sunX = -cos((0.33-0.25)·2π) ≈ -0.87`, `sunY ≈ 0.5`. Sun in the southwest sky. Shadows extend to the **northeast** of each tree (world `+X`, `-Z` direction in XZ). On screen with the default camera, this is to the **upper-left**.
3. **Sunset (18:00, `t = 0.75`):** `sunX = -cos((0.75-0.25)·2π) = 0` wait — at `t=0.75`, `(0.75-0.25)·2π = π`, `cos(π) = -1`, so `sunX = -(-1) = +1`. Sun at world `+X` (east). Shadows extend to world `-X` (west). On screen with the default camera, world `-X` is to the **right**.
4. **HUD cross-check at sunrise (06:00, `t = 0.25`):** HUD shows the sun icon on the **left**. In the world, the sun is at world `-X`. From the default camera, world `-X` is to the **right** of the screen. The user sees the HUD "sun on the left" plus shadows falling toward the right of the screen — these two read consistently as "the sun is somewhere in the west-ish, so shadows fall to the east-ish," which is what the user expects. ✓
5. **Cross-time consistency:** advance the slider smoothly from 06:00 to 18:00. The shadow direction should rotate smoothly, never jump. The HUD sun icon and the world shadow direction should remain "on the same side" throughout.
6. **Outside the park:** cycle through camera presets 2-6 (Ferris Wheel, Carousel, Coaster, Tagada, Stage). With the sun overhead, each ride's local geometry should still cast a shadow inside the ±110 frustum.

## Out of scope

- Cascade shadow maps (CSM) for crisper near/far shadow resolution — not needed for 90 trees and a `±100` park.
- Mirroring the HDR skybox's baked sun — the sky is a static equirect texture, not driven by the day-night cycle; it has no visible "sun" disc.
- Reorienting the camera presets — they are intentional, the user's mental "map" already maps to the current camera setup.
