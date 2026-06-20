# Luna Park — Interactive 3D Amusement Park

**Course:** Interactive Graphics — Prof. Marco Schaerf  
**Institution:** Sapienza University of Rome  
**Authors:** Enrico Battistoni, Davide De Blasio  
**Technology:** Three.js r170 · WebGL 2.0 · tween.js  

---

## Live Demo

> **GitHub Pages URL:** https://sapienzainteractivegraphicscourse.github.io/final-project-tokteam

---

## Project Summary

An interactive, real-time 3D amusement park rendered in the browser via Three.js and WebGL. The scene features:

- **7 fully-animated rides** — Ferris Wheel (counter-rotating gondolas), Carousel (phase-offset bobbing horses), Roller Coaster (spline-based energy-governed cart), Tagada (compound oscillation), Panoramic Train (CatmullRom ring track), Hot Air Balloons (wind-drift), Shooting Gallery (pointer-lock FPV aim)
- **Dynamic day/night cycle** — sun/moon orbit, 4-way HDR sky crossfade, automatic lamppost/spotlight activation
- **10 NPC visitors** — A* pathfinding, procedural walk cycle with two-bone leg IK, seated passengers on all rides
- **Custom GLSL shaders** — animated water (waves + caustics + foam), HDR sky crossfade, GPU particle fireworks
- **Rich environment** — PBR-textured ground/asphalt/wood, river with animated fish, vegetation, 6 food stalls, central stage, entrance gate, park fence with string lights
- **Interactive controls** — click-to-fly camera, 6 preset viewpoints, FPV ride cameras, ride start/stop levers, speed scroll, lamppost/stage toggle, colour picker, time-of-day slider

All animations are hand-written JavaScript math — no imported animation clips.

---

## Quick Start

```bash
git clone <repo-url>
cd LunaPark.nosync
# No build step — serve via any HTTP server
npx serve .
# or: python3 -m http.server 8080
```

Open `http://localhost:8080` in a modern browser (Chrome/Firefox/Edge).

---

## Controls

| Input | Action |
|---|---|
| Left-click on ground/ride | Fly camera to that location |
| Left-click on ride panel | Start / stop ride |
| Left-click on lamppost | Toggle light on/off |
| Left-click on stage spotlight | Toggle spotlight on/off |
| Scroll wheel on ride | Adjust ride speed (0.2× – 1.5×) |
| `1` – `6` | Fly to preset viewpoints |
| Click ride button (bottom bar) | Enter FPV ride camera |
| `Space` | Pause / resume auto time |
| `ESC` | Exit FPV / active view |
| Drag (left mouse) | Orbit camera |
| Right-drag | Pan camera |
| Scroll (not on ride) | Zoom in/out |
| Time slider (HUD) | Set time of day (0–24h) |
| Colour picker (HUD) | Change ride decoration lights |

---

## Repository Structure

```
LunaPark.nosync/
├── index.html                   ← Entry point
├── src/
│   ├── main.js                  ← Scene init, render loop, HUD wiring
│   ├── App.js                   ← App bootstrap, event wiring
│   ├── controls/
│   │   ├── CameraManager.js     ← Orbit, click-to-fly, FPV, presets
│   │   └── InteractionManager.js← Raycaster, click/wheel/hover
│   ├── environment/
│   │   ├── Ground.js, Paths.js, Fence.js
│   │   ├── Lampposts.js, PathLights.js
│   │   ├── FoodStalls.js, Stage.js, Props.js, Benches.js
│   │   ├── Vegetation.js, Rocks.js, River.js
│   │   ├── Water.js             ← Custom GLSL wave shader
│   │   ├── Sky.js               ← HDR crossfade shader
│   │   ├── Fish.js              ← Animated clownfish
│   │   └── Fireworks.js         ← GPU particle system
│   ├── lighting/
│   │   ├── DayNightCycle.js     ← Sun/moon orbit, lamp control
│   │   └── LightManager.js      ← Hemisphere + directional lights
│   ├── people/
│   │   ├── Visitors.js          ← NPC pathfinding, procedural walk
│   │   └── Passengers.js        ← Rider positioning & animation
│   ├── rides/
│   │   ├── RideBase.js          ← Shared ride controller base
│   │   ├── FerrisWheel.js, Carousel.js, Coaster.js, Tagada.js
│   │   └── Train.js, Balloon.js, ShootingGallery.js
│   ├── ui/
│   │   ├── Hud.js, ControlPanel.js
│   │   └── RideHotbar.js, RideHints.js, RideSign.js
│   └── utils/
│       ├── EventBus.js, NavGrid.js
│       ├── loaders.js, textures.js
│       └── easings.js, rideUtils.js, riverConstants.js
├── assets/
│   ├── models/                  ← GLB models (rides, props, Quaternius pack)
│   ├── textures/                ← PBR texture sets (grass, asphalt, wood)
│   └── hdr/                     ← HDR sky presets (day, night, sunrise, sunset)
└── docs/                        ← Development docs & project report
```

---

## Course Topics Covered

| Course Topic | Demonstration |
|---|---|
| 2D/3D Transformations | Hierarchical scene graph, composed rotation chains (rides) |
| GPU Pipeline / WebGL | Three.js as WebGL abstraction; custom GLSL shaders (water, sky) |
| Surfaces & Meshes | Procedural geometry, imported GLB meshes |
| Textures on GPU | PBR texture sets (albedo, normal, roughness) |
| Shading | PBR materials, normal mapping, specular, emissive |
| Rendering Equation | HemisphereLight + DirectionalLight approximation |
| Ray Tracing | Raycasting for click-to-fly and 3D panel interaction |
| Shadows | PCF soft shadow maps on DirectionalLight |
| Sampling | Texture MIP-maps, anisotropic filtering |
| Computer Animations | All ride animations in JavaScript (no clips) |
| Physics-based Animations | Gondola counter-rotation, coaster energy-governed speed |

---

## Credits

- **3D Models:** Quaternius (environment pack, characters), Poly Pizza, Sketchfab — CC0
- **Textures:** ambientCG (grass, asphalt, wood) — CC0
- **HDR Sky:** Polyhaven (day, night, sunrise, sunset) — CC0
- **Libraries:** Three.js r170 (MIT), tween.js (MIT)
- **Full asset attribution:** see [`docs/report/report.qmd`](docs/report/report.qmd)
