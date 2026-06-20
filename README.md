# Luna Park — Interactive 3D Amusement Park

**Course:** Interactive Graphics — Prof. Marco Schaerf  
**Institution:** Sapienza University of Rome  
**Author:** Davide De Blasio  
**Technology:** Three.js r170 · WebGL 2.0 · tween.js  

---

## Live Demo

> **GitHub Pages URL:** _(to be added after deployment)_

---

## Project Summary

An interactive, real-time 3D amusement park rendered in the browser via Three.js and WebGL. The scene features:

- **4 fully-animated rides** — Ferris Wheel (counter-rotating gondolas), Carousel (phase-offset bobbing horses), Roller Coaster (spline-based track with variable speed), Tagada (compound oscillation)
- **Dynamic day/night cycle** — sun/moon orbit, HDR sky crossfade, automatic lamppost/stage lighting
- **10 NPC visitors** — A* pathfinding, procedural walk cycle with two-bone leg IK
- **Custom GLSL shaders** — water (waves + caustics + foam), sky HDR crossfade, emissive blink
- **Rich environment** — PBR-textured ground/asphalt, river with animated fish, vegetation, food stalls, central stage, entrance gate, park fence
- **Interactive controls** — click-to-fly camera, 6 preset viewpoints, FPV ride cameras, ride start/stop panels, speed scroll, lamppost/stage toggle, colour picker

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
| Scroll wheel on ride | Adjust ride speed (0.2x – 1.5x) |
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
├── index.html                ← Entry point
├── src/
│   ├── main.js               ← Scene init, render loop, HUD wiring
│   ├── App.js                ← Application bootstrap, event wiring
│   ├── controls/
│   │   └── InteractionManager.js  ← Raycaster, click/wheel handlers
│   ├── ui/
│   │   ├── Hud.js            ← HUD components (time arc, sliders)
│   │   ├── ControlPanel.js   ← 3D ride control panel (semaphore + lever)
│   │   ├── RideSign.js       ← Ride name signboards
│   │   └── RideHint.js       ← Floating interaction hints
│   ├── rides/
│   │   ├── RideBase.js       ← Shared ride controller base
│   │   ├── FerrisWheel.js    ← Counter-rotating gondolas
│   │   ├── Carousel.js       ← Bobbing horses, cone canopy
│   │   ├── Coaster.js        ← Spline track, station state machine
│   │   ├── Tagada.js         ← Compound oscillation, spinning disc
│   │   ├── Train.js          ← Railway ride
│   │   ├── Balloon.js        ← Hot air balloon navigation
│   │   ├── ShootingGallery.js← Pointer-lock shooting game
│   │   ├── Visitors.js       ← A* pathfinding, procedural walk
│   │   ├── Passengers.js     ← Ride rider system
│   │   ├── Stage.js          ← Octagonal stage, performers, spotlight
│   │   ├── Water.js          ← Custom GLSL wave shader
│   │   ├── Fish.js           ← Animated clownfish
│   │   ├── Sky.js            ← HDR crossfade shader
│   │   ├── Lampposts.js      ← Auto-on at night
│   │   ├── PathLights.js     ← Path intersection spotlights
│   │   ├── Vegetation.js     ← Trees, bushes, plants
│   │   ├── Fireworks.js      ← Firework show system
│   │   └── rideUtils.js      ← Shared ride helpers (bulbs, lights)
│   ├── lighting/
│   │   ├── DayNightCycle.js  ← Sun/moon orbit, exposure, lamp control
│   │   └── LightManager.js   ← Hemisphere + directional (sun)
│   ├── people/
│   │   └── Passengers.js     ← Rider positioning & animation
│   └── utils/
│       ├── EventBus.js       ← Pub/sub event system
│       ├── Easings.js        ← Custom easing functions
│       ├── loaders.js        ← GLB/OBJ/HDR/texture loaders
│       └── textures.js       ← Procedural texture generators
├── assets/
│   ├── models/               ← GLB models (rides, props, Quaternius pack)
│   ├── textures/             ← PBR texture sets (grass, asphalt, wood, metal)
│   └── *.hdr                 ← HDR sky presets (day, night, sunrise, sunset)
└── docs/                     ← Development documentation & report
```

---

## Course Topics Covered

| Course Topic | Demonstration |
|---|---|
| 2D/3D Transformations | Hierarchical scene graph, composed rotation chains (rides) |
| GPU Pipeline / WebGL | Three.js as WebGL abstraction; custom GLSL shaders (water, sky) |
| Surfaces & Meshes | Procedural geometry, imported GLB meshes |
| Textures on GPU | PBR texture sets (albedo, normal, roughness, metalness) |
| Shading | PBR materials, normal mapping, specular, emissive |
| Rendering Equation | HemisphereLight + DirectionalLight approximation |
| Ray Tracing | Raycasting for click-to-fly and 3D panel interaction |
| Shadows | PCF soft shadow maps on DirectionalLight |
| Sampling | Texture MIP-maps, anisotropic filtering |
| Computer Animations | All ride animations in JavaScript (no clips) |
| Physics-based Animations | Gondola counter-rotation, coaster variable speed, rider sway |

---

## Credits

- **3D Models:** Quaternius (environment pack), Poly Pizza (various props)
- **Textures:** ambientCG (grass, asphalt), various CC0 sources
- **HDR Sky:** Polyhaven (day, night, sunrise, sunset presets)
- **Libraries:** Three.js (MIT), tween.js (MIT)
