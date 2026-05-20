# Milestones — Luna Park 3D

> Back to [README](README.md)

---

## Milestone Overview

| # | Name | Target Date | Status | Deliverable |
|---|---|---|---|---|
| M0 | Project skeleton | Day 1 | ⬜ TODO | index.html + libs running |
| M1 | Environment complete | End Week 1 | ⬜ TODO | Full park scene, no rides |
| M2 | Rides complete | End Week 2 | ⬜ TODO | 4 animated rides |
| M3 | Interaction complete | End Week 3 | ⬜ TODO | Full interactive experience |
| M4 | Polish complete | ~June 15 | ⬜ TODO | Submission-ready |
| M5 | Submission | June 20, 2026 | ⬜ TODO | GitHub Pages live + email sent |

---

## M0 — Project Skeleton

**Definition of Done:**
- `index.html` opens in browser without errors
- Three.js renderer creates a WebGL canvas
- Black scene with a grey ground plane
- Camera can orbit with mouse
- `libs/` folder contains vendored three.js and tween.js
- `docs/` folder contains all planning markdown files
- GitHub repository initialised and connected

**Key files to create:**
- `index.html`
- `js/main.js`
- `js/utils/AssetLoader.js`
- `libs/three.module.js` (or CDN import map)
- `libs/tween.esm.js`

---

## M1 — Environment Complete

**Definition of Done:**
- Grass ground plane with tiling PBR texture (albedo + normal + roughness)
- Four asphalt/cobblestone paths forming a cross layout
- Wooden fence around park perimeter
- 12 decorative lampposts placed along paths (geometry only, no PointLights yet)
- 6 food stalls at path intersections (GLB models loaded)
- Central stage platform
- Daytime skybox (HDRI-based)
- `HemisphereLight` + `DirectionalLight` (static position, no cycle yet)
- PCF shadow maps from DirectionalLight onto ground
- No console errors
- Stable 60fps on test machine

**Screenshots required:**
- Wide shot showing the full park from above
- Close-up of ground texture showing normal map detail
- Close-up of a food stall with shadows

---

## M2 — Rides Complete

**Definition of Done:**
- **Ferris Wheel:** hub + ring (rotates Y) + 8 arms + 8 gondolas (counter-rotate Y) + 2 passengers per gondola (oscillate Z ±5°) + 1 control panel
- **Carousel:** platform (rotates Y) + canopy + 8 vertical poles + 8 horses (bob Y = sin(t + phaseOffset) × amplitude) + 8 jockeys + 1 control panel
- **Roller Coaster:** CatmullRomCurve3 track (8+ control points) + TubeGeometry track mesh + cart following curve via getPointAt + Frenet frame orientation + 4 passengers + variable speed (faster downhill)
- **Tagada:** base (slow Y rotation) + arm1 (X oscillation sin(t)) + arm2 (Z oscillation sin(t×1.7)) + seat platform (fast Y rotation) + 1 control panel
- All rides start paused; control panel click starts/stops with ease-in/out
- All ride structures have PBR materials (wood + painted metal)
- 60fps with all 4 rides running

**Technical validation:**
- Open browser console; confirm gondola world rotation stays ≈ 0 while ring rotates → proves counter-rotation works
- Confirm horse positions form a wave pattern at any given frame

---

## M3 — Interaction Complete

**Definition of Done:**
- Click on ground → camera flies there (QuadraticInOut tween, 1200ms)
- Click on any ride mesh → camera flies to viewing position for that ride
- Click on control panel → ride toggles; panel light changes green/red
- Day/night slider (HTML range input) → sun position changes, sky colour transitions
- Lamps auto-activate when sun < 15° above horizon; auto-deactivate at dawn
- Click on lamppost mesh → that specific PointLight toggles
- Scroll wheel near a ride → that ride's speed changes (smoothly)
- C key (when within 20 units of Ferris wheel) → FPV gondola camera activates
- C key or ESC → FPV camera deactivates, return to orbit
- Color picker → changes emissive colour of selected ride's decoration lights
- 8 NPC visitors walking between waypoints, never clipping ground

---

## M4 — Polish Complete

**Definition of Done:**
- Night sky transitions smoothly (HDRI day ↔ star skybox)
- Ride lights blink at night (emissive shader with sin(t))
- Atmospheric fog (`THREE.FogExp2`) adds depth
- Performance: stable 60fps on integrated GPU laptop
- Report: 10+ pages, PDF, covering all technical aspects
- All assets credited in report and `docs/assets/MODEL_LIST.md`
- GitHub Pages: live URL confirmed working
- README has live link

---

## M5 — Submission

**Checklist:**
- [ ] GitHub Pages URL is in README.md
- [ ] All source code committed (including libs)
- [ ] No `node_modules` or build artifacts in repo
- [ ] Report PDF committed to repo root
- [ ] GitHub Classroom assignment accepted
- [ ] Registered on Infostud for June 24 session
- [ ] Email sent to marco.schaerf@uniroma1.it before June 20, 23:59

---

## Grading Criteria Checklist

Based on the official project requirements:

### ✅ Hierarchical Models
- [ ] At least one complex hierarchical model → FerrisWheel (5 levels deep)
- [ ] Animations exploit the hierarchical structure → gondola counter-rotation

### ✅ Lights and Textures
- [ ] At least one light → 6 types used (Hemisphere, Directional, Point×12, Spot, RideLights)
- [ ] Colour textures → all surfaces
- [ ] Normal maps → ground, paths, wood structures
- [ ] Specular/roughness maps → metal structures, painted surfaces

### ✅ User Interaction
- [ ] Turn on/off lights → lamppost toggle, day/night cycle
- [ ] Change viewpoint → click-to-fly, orbit, FPV
- [ ] Configure colors → ride light color picker
- [ ] Start/stop rides → 3D control panels

### ✅ Animations
- [ ] Most objects animated → all 4 rides, NPC visitors
- [ ] Hierarchical models exploit structure → FerrisWheel, Tagada
- [ ] NO imported animations → all JS-implemented

---

## Oral Exam Preparation

### Demo Script (10 minutes)
1. **(0:00–1:30)** Start scene — wide orbit view — "This is the park environment: ground, paths, fence, stalls, lampposts." Show shadows. Show normal maps by getting close to the ground.
2. **(1:30–3:00)** Move to day/night slider — slide to night — "Lampposts auto-activate. Sky transitions. Ride lights blink." Slide back to day.
3. **(3:00–5:00)** Click on Ferris Wheel control panel — ride starts. "Notice the gondolas: the outer ring rotates Y by ω, and each gondola counter-rotates by −ω. This is the composed hierarchical transform from Lecture 05." Open console — print gondola.getWorldQuaternion() to show it's static.
4. **(5:00–6:30)** Click on Roller Coaster panel — "The cart follows a CatmullRomCurve3. Its orientation is derived from the Frenet frame — tangent, normal, binormal. This is the parametric curve theory from the surfaces lecture."
5. **(6:30–7:30)** Press C near the Ferris Wheel — FPV gondola camera. "The camera is now a child of the gondola node. It follows in world space automatically."
6. **(7:30–9:00)** Click on lamppost to toggle. Click on ground to fly-to. Show raycasting working. "Raycasting is the real-time analogue of the ray tracing algorithm from Lecture 15."
7. **(9:00–10:00)** Performance — open DevTools, show stable frame time. "Shadows from one DirectionalLight, PointLights without shadows for most lampposts, instanced fence geometry."

### Key Talking Points
- "Animations cannot be imported — every movement is a parametric function of elapsed time"
- "The scene graph is the direct implementation of the transformation hierarchy from lectures 4 and 5"
- "Raycasting is conceptually the same algorithm as ray tracing, just stopping at the first intersection"
- "PBR materials implement a real-time approximation of the rendering equation from Lecture 13"
- "The day/night cycle demonstrates dynamic light management — intensity, colour, and shadow direction all change"
