# Interaction Design — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Design Principles

**Everything in 3D first.** Rides are controlled by 3D panels inside the scene, not HTML buttons. Lights are toggled by clicking on lamp geometry. This demonstrates advanced raycasting on arbitrary mesh geometry — a key differentiator.

**Navigation as exploration.** The user clicks where they want to go; the camera flies there. This feels natural and encourages exploration without requiring WASD keyboard flying skills.

**Instant feedback.** Every interaction produces an immediate visual response — a semaphore light changes, a ride starts moving, a lamp activates. No UI loading states.

**Graceful degradation.** If a user misses a click target, nothing happens. No error states. The worst case is the camera flies somewhere unexpected, which is visually interesting.

---

## 2. Interaction Catalogue

### I1 — Click-to-Fly Navigation

**Trigger:** Left mouse button click on ground plane, ride structure, or any scene object  
**Priority:** Lowest (last resort if no other interaction triggered)  
**Effect:** Camera smoothly flies to a viewpoint near the clicked point  
**Technical:** Raycaster → intersect all `flyTargetLayer` objects → pick `hits[0].point` → `cameraController.flyTo(point)`  
**Feedback:** Smooth camera animation (1200ms QuadraticInOut tween)  

Design detail: The camera flies to a position _behind and above_ the clicked point relative to the current viewing direction, not directly to the hit point. This prevents clipping through objects.

---

### I2 — Ride Control Panel Toggle

**Trigger:** Left click on a 3D control panel mesh (traffic light / lever)  
**Priority:** Highest (checked before fly-to)  
**Effect:** The associated ride starts (if stopped) or stops (if running)  
**Technical:** Raycaster → intersect `controlPanelLayer` → `hit.object.userData.ride.toggle()`  
**Feedback:**  
- Semaphore mesh: green material → red (or vice versa), instant
- Ride: ease-in to running speed (tween 1500ms), or ease-out to stop
- Panel lever mesh: rotation tweened 45° to show state change

Design detail: The panel should be large enough to click easily during a demo presentation on a large screen. Minimum target size: 2×2 world units.

---

### I3 — Lamppost Light Toggle

**Trigger:** Left click on lamppost head mesh  
**Priority:** Medium (checked after control panels, before fly-to)  
**Effect:** PointLight intensity tweens 0→2.5 (on) or 2.5→0 (off)  
**Technical:** Raycaster → intersect `lampostLayer` → `lamp.toggle()`  
**Feedback:** Light visibly appears/disappears in scene; emissive bulb material activates

---

### I4 — Day/Night Cycle Slider

**Trigger:** HTML `<input type="range">` slider (value 0–24, representing hours)  
**Effect:** `dayNightCycle.time` is set to slider value / 24; sun orbits, sky changes, lamps activate/deactivate, ride light intensities update  
**Feedback:** Immediate — all visual changes update in the same frame  

---

### I5 — Ride Speed Modifier

**Trigger:** Mouse scroll wheel while cursor is over a ride area  
**Detection:** Raycaster at cursor position each scroll event → if hitting a ride mesh, modify that ride's speed  
**Effect:** `ride.speed = clamp(ride.speed + delta * SCROLL_SENSITIVITY, 0.2, 3.0)` with ease (tween over 500ms)  
**Feedback:** Visual speed change is obvious; ride sounds (if implemented) pitch-shift

---

### I6 — FPV Gondola Camera

**Trigger:** Key `C` pressed when camera is within 20 units of Ferris Wheel centre  
**Effect:** Camera is reparented to a gondola node  
**Exit:** Key `C` or `ESC` → camera detaches and returns to orbit mode  
**Feedback:** Sudden immersive first-person view from gondola height

Design detail: Only works for the Ferris Wheel gondola (clearest demonstration). Other rides could be FPV candidates but are harder (carousel is too fast; roller coaster disorients).

---

### I7 — Ride Light Colour Picker

**Trigger:** HTML `<input type="color">` in UI panel  
**Effect:** All decoration PointLights and emissive materials on the currently "selected" ride change to the chosen hue  
**Selection:** A ride becomes "selected" when the user clicks on its structure (separate from fly-to — detect this in the raycaster chain)  

---

### I8 — Preset Viewpoint Keys (optional)

**Trigger:** Number keys 1–6  
**Effect:** Camera flies to pre-defined viewpoints (overview, each ride, stage)  
**Feedback:** Smooth fly-to animation

---

## 3. Interaction Priority Chain

When a click event fires, the InteractionManager checks in this order:

```
1. Control panels (controlPanelLayer) → toggleRide
2. Lamposts       (lampostLayer)      → toggleLamp
3. Ride structures (rideLayer)        → selectRide + flyTo
4. Ground          (groundLayer)      → flyTo
5. Sky/nothing     → no action
```

**Important:** Each check uses `raycaster.intersectObjects(layerObjects)`. If hits are found, the function **returns** immediately — no lower-priority check runs for that click.

---

## 4. Accessibility Considerations

- **Keyboard navigation:** All critical actions available via keyboard (1–6 for viewpoints, C for FPV, Space for day/night toggle)
- **Cursor feedback:** CSS cursor changes to `pointer` when hovering over clickable objects (detected via `mousemove` raycasting against interactive layers at low priority)
- **UI contrast:** HTML overlay uses high-contrast colours; slider/picker are standard browser elements with native accessibility

---

## 5. Mobile Considerations (secondary priority)

Touch events map to mouse events in Three.js by default. Single tap = click. Pinch = zoom. Two-finger drag = orbit. The day/night slider and colour picker are standard HTML inputs that work on mobile.

FPV mode is not available on mobile (no C key) — this is acceptable.
