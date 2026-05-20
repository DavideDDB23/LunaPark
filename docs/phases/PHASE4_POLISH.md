# Phase 4 — Polish & Delivery (3 → 4)

> Back to [README](../README.md)  
> Prerequisites: [Phase 3](PHASE3_INTERACTION.md) complete

---

## Goal

Submission-ready project. Polish visuals, fix bugs, tune performance, write the technical report, and deploy to GitHub Pages.

---

## Visual Polish

### P4.1 — Emissive Blink Shader

Apply the `EmissiveBlinkMaterial` (described in [SHADER_PLAN.md](../graphics/SHADER_PLAN.md)) to all ride decoration bulb meshes. At night, bulbs pulse with `sin(time × 3)` intensity variation.

Also update `rideDecorLights` (PointLights on ride structures) intensity with the same pulse.

---

### P4.2 — Night Sky Transition

Smooth transition from HDRI day sky to starfield night:

```
DayNightCycle.update():
  nightFactor = smoothstep(0.1, 0.35, 1 - sunIntensity)
  nightSkyMesh.material.opacity = nightFactor
  scene.backgroundIntensity = 1.0 - nightFactor × 0.9
```

Result: as the sun sets, the HDRI sky gradually fades while the starfield fades in.

---

### P4.3 — Atmospheric Fog

```
scene.fog = new THREE.FogExp2(0xC8E4F8, 0.003)  // pale blue daytime fog
```

DayNightCycle updates fog colour:
```
scene.fog.color.lerpColors(DAY_FOG_COLOR, NIGHT_FOG_COLOR, nightFactor)
// DAY_FOG_COLOR  = 0xC8E4F8  (pale blue)
// NIGHT_FOG_COLOR = 0x0A0A1A (very dark blue)
```

---

### P4.4 — Ride Light Blinking

During day: `rideDecorLights.forEach(l => l.intensity = 0)`  
During night:
```
tick(delta, time):
  for i, light of rideDecorLights:
    phase = i × (TWO_PI / rideDecorLights.length)
    light.intensity = 0.5 + sin(time × 3 + phase) × 0.4
```

---

### P4.5 — Ground Blend Shader (if time allows)

Implement `TEX_07` blend mask and `SHADER_2` from [SHADER_PLAN.md](../graphics/SHADER_PLAN.md) to soften the grass/asphalt path boundary. Lower priority — skip if Phase 4 time is tight.

---

## Performance Pass

### Profile → Identify → Fix

```
Chrome DevTools process:
  1. Open DevTools → Performance tab
  2. Enable CPU throttle: 4× slowdown (simulates older laptop)
  3. Record 5 seconds of scene running (all rides on, night mode)
  4. Find long frames (> 16ms) in the overview
  5. Click into the longest frame → identify the expensive function

Common culprits to check:
  □ Too many draw calls → merge geometry, use InstancedMesh
  □ Shadow map too large → reduce from 2048 to 1024 if needed
  □ Per-frame object allocation → use pre-allocated temp vectors
  □ Too many PointLights → reduce or use layers
  □ Raycaster on too many objects → use layers to filter
```

### Geometry Merging (if not done in Phase 1)

```
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Merge all fence segments
const fenceGeos = fenceSegments.map(seg => {
  const geo = seg.geometry.clone()
  geo.applyMatrix4(seg.matrixWorld)
  return geo
})
const mergedFence = mergeGeometries(fenceGeos)
const fenceMesh = new THREE.Mesh(mergedFence, fenceMaterial)
scene.add(fenceMesh)
// Remove individual segments from scene
```

---

## Technical Report

### Structure (10+ pages)

The report serves as both a technical presentation and user manual.

**Section 1 — Project Description** (~1 page)
- Concept: interactive 3D amusement park
- Technology: Three.js + WebGL + tween.js
- Team: Davide De Blasio + (teammates if any)

**Section 2 — Environment Used** (~0.5 pages)
- Three.js r158+
- WebGL 2.0 via browser
- tween.js 21+ for smooth animations
- Hosted on GitHub Pages

**Section 3 — Libraries, Tools, and Models** (~1 page)
- Three.js: [threejs.org](https://threejs.org)
- tween.js: [github.com/tweenjs/tween.js](https://github.com/tweenjs/tween.js)
- Textures: Poly Haven (CC0), ambientCG (CC0)
- Models: [Sketchfab models used] (CC license, author)
- Development tools: VS Code, Blender (if used for model processing), Chrome DevTools

**Section 4 — Technical Implementation** (~4 pages)
- Scene graph structure + hierarchical models (with diagram)
- Ferris wheel counter-rotation: mathematical explanation
- Carousel horse phase-offset bobbing formula
- Roller coaster: CatmullRom curve + Frenet frame
- Tagada: multi-frequency compound oscillation
- Lighting system: all light types and their roles
- Material system: PBR workflow, texture maps used
- Shadows: PCF shadow maps, frustum configuration

**Section 5 — User Interactions** (~2 pages)
- Click-to-fly: raycasting algorithm description
- 3D control panels: raycasting on mesh geometry
- Day/night cycle: sun orbit formula, lamp activation
- FPV camera: scene graph parenting
- All other interactions with keyboard/mouse reference

**Section 6 — Course Topic Connections** (~1 page)
- Table mapping each course lecture to the project feature that demonstrates it

**Section 7 — User Manual** (~1 page)
- How to run (local server + GitHub Pages URL)
- All controls reference

**Appendix — Performance Benchmarks**
- FPS measurements (day / night / all rides / FPV mode)
- Draw call counts
- Triangle counts

---

## GitHub Pages Deployment

```
GitHub Repository setup:
  1. Ensure index.html is at repository ROOT (not in a subfolder)
  2. Ensure all asset paths are RELATIVE (e.g., 'assets/textures/grass.jpg')
     NOT absolute ('/assets/textures/grass.jpg' fails on GitHub Pages subdomain)
  3. Ensure all library paths are relative
  4. Settings → Pages → Source: Deploy from branch → main → / (root) → Save
  5. Wait 2–5 minutes → URL appears: username.github.io/repo-name/
  6. Test URL in incognito window (no cached assets)
  7. Add URL to README.md

CORS / MIME type checks:
  GitHub Pages serves .glb files with correct MIME type automatically
  GitHub Pages serves .exr files — may need to test (sometimes blocked)
  Fallback: pre-convert EXR to JS-loadable format or use RGBELoader with .hdr
```

---

## Submission Email

Send to `marco.schaerf@uniroma1.it` before June 20, 2026 at 23:59:

```
Subject: Interactive Graphics Project — Luna Park — [Student Name] — June Session

Dear Professor Schaerf,

I am writing to inform you that my Interactive Graphics project "Luna Park — 
3D Amusement Park" is complete and ready for evaluation.

GitHub Repository: https://github.com/[username]/[repo-name]
Live Demo (GitHub Pages): https://[username].github.io/[repo-name]/

The project includes:
- Four hierarchical animated rides (Ferris wheel with gondola counter-rotation, 
  Carousel with phase-offset horse bobbing, Roller Coaster on parametric curve, 
  Tagada with 3-joint compound arm)
- PBR textures and lighting (DirectionalLight, HemisphereLight, 12× PointLights, SpotLight)
- Dynamic day/night cycle with automatic lamp activation
- Click-to-fly navigation and 3D control panels via raycasting
- First-person gondola camera (C key near Ferris Wheel)
- NPC visitors walking between waypoints
- All animations implemented in JavaScript (no imported animations)

Registered in Infostud for the June 24 session.

Best regards,
Davide De Blasio
```

---

## Final Checklist Before Submission

```
CODE:
  □ All four rides animated and interactive
  □ All interactions working (click-to-fly, panels, lamps, FPV, speed, color)
  □ Day/night cycle complete
  □ Visitors walking
  □ No console errors or warnings
  □ Performance: 45fps minimum on slow hardware

REPORT:
  □ PDF file in repository root (luna_park_report.pdf)
  □ Minimum 10 pages
  □ All external assets credited
  □ Technical explanation of hierarchical models
  □ Interactions described
  □ Course topic connections listed

REPOSITORY:
  □ All source code committed (including libs/)
  □ No node_modules, no build artifacts
  □ README.md has GitHub Pages URL
  □ GitHub Pages working and tested

SUBMISSION:
  □ Infostud registration: June 24 exam session
  □ Email sent before June 20, 23:59
  □ Tag v1.0-submission pushed

ORAL EXAM PREP:
  □ Demo script rehearsed (see MILESTONES.md)
  □ Console walkthrough prepared (getWorldQuaternion proof)
  □ Know the answer to: "Why is the gondola counter-rotation special?"
  □ Know the answer to: "What is the Frenet frame?"
  □ Know the answer to: "How does raycasting relate to ray tracing?"
  □ Know the answer to: "What is the rendering equation?"
  □ Backup video recording of demo at 60fps
```
