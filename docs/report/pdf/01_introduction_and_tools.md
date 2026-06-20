# Luna Park — Interactive 3D Amusement Park
## Project Report

**Author:** Davide De Blasio  
**Course:** Interactive Graphics — Prof. Marco Schaerf  
**Institution:** Sapienza University of Rome, DIAG  
**Academic Year:** 2025–2026  
**Date:** June 2026

---

## Section 1 — Project Introduction

### 1.1 Overview

*Luna Park* is a fully interactive, real-time 3D amusement park rendered entirely within the web browser via Three.js and the WebGL 2.0 graphics API. Developed as the final project for the Interactive Graphics course at Sapienza University of Rome, it demonstrates the practical application of the core topics covered in the syllabus — from the rendering pipeline and shading models to hierarchical scene graphs, custom GLSL shaders, and computer animation — within a cohesive, visually rich application.

The project is served as a set of static files with no build step required: any HTTP server pointing at the repository root suffices. The entry point is `index.html`, which sets up a `<canvas>` element and loads all JavaScript as native ES modules via an `importmap`. This design decision keeps the development workflow simple and ensures the project runs identically on a local machine and on GitHub Pages.

### 1.2 Motivation and Design Goals

The amusement park theme was chosen because it naturally motivates every major graphics technique in the course:

1. **Rides as hierarchical models**: Each attraction is a tree of `THREE.Group` and `THREE.Mesh` nodes whose compound rotations and translations produce the characteristic motion — exactly the kind of hierarchical scene graph described in the course lectures.
2. **Hand-coded animations**: The project mandate prohibits importing animation clips. All motion — from the Ferris wheel's counter-rotating gondolas to the roller coaster's energy-governed cart — is derived from first principles in JavaScript, providing a direct demonstration of computer animation techniques.
3. **Shader-driven visuals**: The park contains several environments that cannot be achieved with standard materials alone: an animated river with wave displacement and caustics, an HDR sky that transitions smoothly across the diurnal cycle, and a GPU particle fireworks system. These are implemented as custom GLSL shaders.
4. **Rich lighting**: Multiple light types co-exist — a directional sun that orbits the sky, a moon, a hemisphere sky light, twelve point-light lampposts, path spotlights, and per-ride decoration bulbs — all managed by a single `DayNightCycle` class that drives every light source from a single time parameter.
5. **Full interactivity**: The user can click anywhere in the 3D scene to fly the camera there, toggle individual lampposts, control ride speed, manipulate the time of day, and even enter first-person view aboard any ride.

### 1.3 Technology Environment

The project uses **Three.js r170** as a high-level abstraction over **WebGL 2.0**. Three.js was chosen because it handles the low-level boilerplate of WebGL (buffer management, shader compilation, texture upload, matrix stacks) while remaining thin enough that the application can drop down to raw GLSL for the water, sky, and fireworks shaders. All custom shader code is written in **GLSL ES 3.0** (`#version 300 es`), matching the WebGL 2.0 context requested by `canvas.getContext('webgl2')`.

The render loop uses Three.js's `EffectComposer` pipeline:

```
WebGLRenderTarget → RenderPass → UnrealBloomPass → OutputPass → display
```

Tone mapping is set to `THREE.ACESFilmicToneMapping`, and the renderer's output colour space is `THREE.SRGBColorSpace` to ensure correct gamma handling throughout the pipeline.

Shadow mapping is enabled globally with `THREE.PCFSoftShadowMap`, which applies a Poisson-disk kernel in the shadow map to produce soft-edged shadows without visible aliasing.

### 1.4 High-Level Feature List

| Category | Feature |
|---|---|
| **Rides** | Ferris Wheel (counter-rotating gondolas), Carousel (phase-offset bobbing horses), Roller Coaster (spline track, energy-governed speed), Tagada (compound oscillation), Panoramic Train (CatmullRom ring track), Hot Air Balloons (3, wind-drift trajectory), Shooting Gallery (pointer-lock FPV aim) |
| **Environment** | PBR-textured grass ground, asphalt paths, park perimeter fence with string lights, 6 food stalls, central octagonal stage, entrance gate, river with animated water shader, fish, rocks, vegetation (trees, bushes, flowers) |
| **Lighting** | Day/night cycle (sun/moon orbit), HemisphereLight, PCF shadows, 12 auto-lampposts, stage spotlight, 6 path spotlights, per-ride decoration bulbs with colour picker |
| **Sky** | 4 HDR equirectangular presets (night, sunrise, day, sunset) crossfaded by a custom two-texture sky sphere shader |
| **Post-processing** | Selective UnrealBloom, ACES filmic tone mapping |
| **NPCs** | 10 procedurally animated park visitors with A* pathfinding, analytic leg IK, and 14 outfit variants |
| **Passengers** | Seated riders on all rides (gondolas, carousel horses, coaster seats, Tagada disc, train wagons, balloon baskets) |
| **Particles** | Night fireworks: GPU particle system with 3 burst types (spherical, corona, willow) |
| **Camera** | Click-to-fly, 6 preset viewpoints (keys 1–6), FPV aboard any ride (key C), OrbitControls |
| **HUD** | Time-of-day arc, digital clock, manual slider, auto-advance toggle, FPS counter, ride hotbar, colour picker |

### 1.5 Module Structure

The source tree under `src/` is organized by concern:

```
src/
├── App.js                  ← Scene bootstrap, render loop, HUD wiring
├── main.js                 ← Entry point (imports App.js)
├── controls/
│   ├── CameraManager.js    ← Orbit, click-to-fly, FPV, preset viewpoints
│   └── InteractionManager.js ← Raycaster, click/wheel/hover dispatch
├── environment/
│   ├── Ground.js, Paths.js, Fence.js, River.js, Rocks.js, Benches.js
│   ├── FoodStalls.js, Props.js (entrance gate), Stage.js, Vegetation.js
│   ├── Lampposts.js, PathLights.js, ExternalScenery.js
│   ├── Water.js            ← Custom GLSL wave + caustic shader
│   ├── Sky.js              ← HDR crossfade sky-sphere shader
│   ├── Fish.js             ← Animated clownfish with skeleton
│   └── Fireworks.js        ← GPU particle burst system
├── lighting/
│   ├── DayNightCycle.js    ← Sun/moon orbit, tone mapping, lamp control
│   └── LightManager.js     ← HemisphereLight + DirectionalLight factory
├── people/
│   ├── Visitors.js         ← NPC pathfinding, procedural gait (~900 lines)
│   └── Passengers.js       ← Rider template system, seated poses, IK
├── rides/
│   ├── FerrisWheel.js, Carousel.js, Coaster.js, Tagada.js
│   ├── Balloon.js, Train.js, ShootingGallery.js
├── ui/
│   ├── ControlPanel.js     ← 3D in-world ride panel (semaphore + lever)
│   ├── Hud.js              ← Canvas-based time arc, clock, slider
│   ├── RideHints.js        ← Proximity-fade FPV hint billboards
│   └── RideHotbar.js       ← HTML bottom bar for ride FPV buttons
└── utils/
    ├── EventBus.js         ← Pub/sub for decoupled component communication
    ├── NavGrid.js          ← Occupancy grid + A* for NPC pathfinding
    ├── loaders.js          ← GLB/HDR/texture loader wrappers
    └── Easings.js          ← Shared easing functions for tweens
```

---

## Section 2 — External Libraries and Tools

This section catalogues every library, framework, and tool used in the project that was not developed by the project team, together with its version, licence, and role.

### 2.1 Three.js r170

| Attribute | Value |
|---|---|
| Version | r170 |
| Licence | MIT |
| URL | https://threejs.org / https://github.com/mrdoob/three.js |

Three.js is the primary rendering library. It provides a scene graph abstraction (`Object3D`, `Group`, `Mesh`), a wide range of geometry primitives (`CylinderGeometry`, `SphereGeometry`, `TorusGeometry`, `TubeGeometry`, `CatmullRomCurve3`), material types (`MeshStandardMaterial`, `ShaderMaterial`, `MeshBasicMaterial`), light types (`DirectionalLight`, `HemisphereLight`, `PointLight`, `SpotLight`), texture utilities (`CanvasTexture`, `TextureLoader`, `PMREMGenerator`), and the WebGL renderer (`WebGLRenderer`). It also provides the `EffectComposer` post-processing pipeline used for bloom.

Three.js is loaded as an ES module from the `importmap` in `index.html`:

```json
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
  }
}
```

All Three.js addons (see §2.2) are resolved via the `three/addons/` prefix.

### 2.2 Three.js Addons (r170, MIT)

The following modules from `three/examples/jsm/` are imported:

| Module | Import Path | Role |
|---|---|---|
| `OrbitControls` | `controls/OrbitControls.js` | Mouse orbit, pan, zoom around a target point |
| `EffectComposer` | `postprocessing/EffectComposer.js` | Multi-pass post-processing pipeline |
| `RenderPass` | `postprocessing/RenderPass.js` | Base scene render into a framebuffer |
| `UnrealBloomPass` | `postprocessing/UnrealBloomPass.js` | Selective bloom on bright emissive elements |
| `OutputPass` | `postprocessing/OutputPass.js` | Final tone-map and gamma-correct to canvas |
| `GLTFLoader` | `loaders/GLTFLoader.js` | Load `.glb` binary GLTF 3D models |
| `RGBELoader` | `loaders/RGBELoader.js` | Load `.hdr` Radiance RGBE environment maps |
| `PMREMGenerator` | _(built into Three.js core)_ | Pre-filter HDR maps into mip-mapped env maps for IBL |

### 2.3 tween.js

| Attribute | Value |
|---|---|
| Version | 23.1.3 |
| Licence | MIT |
| URL | https://github.com/tweenjs/tween.js |

tween.js provides a lightweight, framework-agnostic interpolation engine. It is used throughout the project for smooth, eased transitions:

- **Camera fly-to animations** (1.2 s, `Quadratic.InOut`): when the user clicks a point in the scene, the camera position and `OrbitControls` target glide to the new viewpoint.
- **Ride speed ramp-up/ramp-down**: starting a ride eases the speed multiplier from 0 to 1 over `RAMP_UP` seconds (1.5 s for the Ferris Wheel, 0.5 s for the Carousel and Tagada); stopping eases it back over `RAMP_DOWN` seconds.
- **Lamppost toggle**: the point-light intensity is tweened over 0.8 s when a lamppost is clicked.
- **Tagada arm extension/retraction**: the arm telescopes to boarding height over ~1 s via a TWEEN on the arm length scalar.

tween.js is also loaded from the `importmap`:

```json
"@tweenjs/tween.js": "https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js"
```

### 2.4 Python `http.server`

| Attribute | Value |
|---|---|
| Version | Python standard library (3.x) |
| Licence | PSF Licence |

During development the project is served locally with:

```bash
python3 -m http.server 8080
```

No build toolchain, no transpilation, no bundler is required. The browser resolves all `import` statements via the native ES module system and the `importmap` in `index.html`.

### 2.5 GitHub Pages

The project is intended for deployment on **GitHub Pages** (free tier, MIT-licensed infrastructure). GitHub Pages serves the repository root as a static site, making the application accessible at a public URL without any server-side logic. All asset paths in the source are relative (no leading `/`) to ensure compatibility with the GitHub Pages subdirectory structure.

---

*The report continues in subsequent sections with a complete listing of all external assets (Section 3) and a technical deep-dive into the implementation (Section 4).*
