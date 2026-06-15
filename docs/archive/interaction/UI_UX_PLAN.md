# UI/UX Plan — Luna Park 3D

> Back to [README](../README.md)

---

## 1. UI Philosophy

The UI is intentionally minimal. The scene is the interface. HTML overlays exist only for controls that cannot be embedded in 3D (day/night slider, color picker, key reference).

**Rule:** If it can be a 3D object in the scene, it must be. HTML elements are the last resort.

---

## 2. HTML Overlay Elements

### Layout
```
body
  └── canvas (fills 100vw × 100vh)
  └── #ui-overlay (position:absolute, top-left, non-interactive background)
      ├── #controls-panel
      │   ├── Day/Night slider    <input type="range" min="0" max="24">
      │   ├── Ride light colour   <input type="color">
      │   └── Help button         <button>?</button>
      └── #key-reference (toggleable)
          ├── "Click ground → fly"
          ├── "Click panel → start/stop ride"
          ├── "Click lamp → toggle"
          ├── "C = gondola FPV"
          ├── "Scroll = ride speed"
          └── "1–6 = preset views"
```

### CSS Strategy
- Transparent dark overlay panel (rgba background, blur filter)
- Small, positioned top-left, out of the way of the scene
- Font: system-ui, 12–14px, white text
- Slider: native browser element, styled with CSS accent-color
- Visible but unobtrusive during demos

---

## 3. In-Scene UI Elements

### 3D Control Panels (per ride)

Each ride has a physical control box in the scene:

```
Panel geometry:
  ├── box_base     BoxGeometry(2, 1.5, 0.5) — dark metal casing
  ├── semaphore    SphereGeometry(0.15, 8, 8) — red or green emissive
  └── lever        BoxGeometry(0.1, 0.5, 0.1) — grey metal, rotates 45°
```

State feedback:
- `semaphore.material.emissive = 0x00FF00` when ride running
- `semaphore.material.emissive = 0xFF0000` when ride stopped
- `lever.rotation.x = 0` stopped, `= π/4` running (45° tilt)

The lever rotation is tweened with tween.js (300ms, Quadratic.Out) for a satisfying mechanical feel.

### Labels (Optional — Phase 4)

If time permits, small HTML `<div>` elements positioned using `camera.project(mesh.position)` can show ride names as floating labels. These update their CSS transform each frame.

---

## 4. User Journey

### First Load
1. Scene opens in overview position (high camera, sees full park)
2. Brief fade-in (CSS opacity transition, 1 second)
3. Key reference visible (auto-closes after 8 seconds)
4. User can immediately interact — no loading screen if assets are small enough, or a simple "Loading..." text replaced by the canvas

### Exploration
- User clicks somewhere in the park → camera flies there
- User finds a ride → clicks the control panel → ride starts
- User finds a lamppost at night → clicks it → toggles
- User presses C near Ferris Wheel → experiences it first-person
- User moves the day/night slider → watches the scene transition

### Demo Flow (exam)
Follow the demo script in [MILESTONES.md](../MILESTONES.md) for the 10-minute oral exam presentation.

---

## 5. Visual Feedback Summary

| Action | Immediate Feedback | Delayed Feedback |
|---|---|---|
| Click → fly-to | Cursor → default | Camera starts moving (0ms) |
| Click control panel | Semaphore colour change | Ride starts moving (ease-in) |
| Click lamppost | Emissive bulb activates | PointLight intensity tweens up |
| Move day/night slider | Sun moves, sky changes | Lamps auto-activate (threshold) |
| Press C | Screen POV changes | Ride continues in FPV |
| Scroll near ride | Ride visibly speeds up/slows | Speed number in overlay (optional) |

---

## 6. Responsive Design

The canvas fills the full viewport. The overlay panel scales with a minimum font size to remain readable on any screen. No horizontal scrollbar.

On presentation day: the project will be fullscreen'd in the browser (`F11`). The overlay panel must remain visible and not be cut off.

---

## 7. Hover Cursor Feedback

When the mouse hovers over a clickable object, the cursor changes from `default` to `pointer`. This signals interactivity without tooltips.

Implementation: `mousemove` at 30fps throttle → raycaster → check interactive layers → `canvas.style.cursor = ...`

Clickable objects that change cursor:
- Control panels
- Lampposts
- Ground plane
- Ride structures
