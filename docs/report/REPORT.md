# Luna Park — Interactive 3D Amusement Park
## Project Report — Interactive Graphics Course

**Authors:** Enrico Battistoni, Davide De Blasio  
**Course:** Interactive Graphics — Prof. Marco Schaerf  
**Institution:** Sapienza University of Rome, DIAG  
**Academic Year:** 2025–2026  
**Date:** 20 June 2026  

---

## Table of Contents

1. [Project Introduction](#1-project-introduction)
2. [External Libraries and Tools](#2-external-libraries-and-tools)
3. [External Assets](#3-external-assets)
4. [Technical Implementation — Rides and Animations](#4-technical-implementation--rides-and-animations)
5. [Technical Implementation — Lighting, Shaders, and PBR](#5-technical-implementation--lighting-shaders-and-pbr)
6. [Technical Implementation — NPCs, Camera, and Interactions](#6-technical-implementation--npcs-camera-and-interactions)
7. [Mapping to Course Topics](#7-mapping-to-course-topics)
8. [User Manual](#8-user-manual)

---

## 1. Project Introduction

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
| **Rides** | Ferris Wheel (counter-rotating gondolas), Carousel (phase-offset bobbing horses), Roller Coaster (spline track, energy-governed speed), Tagada (compound oscillation), Panoramic Train (CatmullRom ring track), Hot Air Balloons (3, wind-drift with 2D noise trajectory), Shooting Gallery (pointer-lock FPV aim) |
| **Environment** | PBR-textured grass ground, asphalt paths, park perimeter fence with string lights, 6 food stalls, central octagonal stage, entrance gate, river with animated water shader, fish, rocks, vegetation (trees, bushes, flowers) |
| **Lighting** | Day/night cycle (sun/moon orbit), HemisphereLight, PCF shadows, 12 auto-lampposts, stage spotlight, 6 path spotlights, per-ride decoration bulbs with colour picker |
| **Sky** | 4 HDR equirectangular presets (night, sunrise, day, sunset) crossfaded by a custom two-texture sky sphere shader |
| **Post-processing** | Selective UnrealBloom, ACES filmic tone mapping |
| **NPCs** | 10 procedurally animated park visitors with A* pathfinding, analytic leg IK, and 14 outfit variants |
| **Passengers** | Seated riders on all rides (gondolas, carousel horses, coaster seats, Tagada disc, train wagons, balloon baskets) |
| **Particles** | Night fireworks: GPU particle system with 3 burst types (spherical, corona, willow) |
| **Camera** | Click-to-fly, 6 preset viewpoints (keys 1–6), FPV aboard any ride, OrbitControls |
| **HUD** | Time-of-day arc, digital clock, manual slider, auto-advance toggle, FPS counter, ride hotbar, colour picker |

### 1.5 Module Structure

The source tree under `src/` is organized by concern:

```
src/
├── App.js                  Scene bootstrap, render loop, HUD wiring
├── main.js                 Entry point (imports App.js)
├── controls/
│   ├── CameraManager.js    Orbit, click-to-fly, FPV, preset viewpoints
│   └── InteractionManager.js  Raycaster, click/wheel/hover dispatch
├── environment/
│   ├── Ground.js, Paths.js, Fence.js, River.js, Rocks.js, Benches.js
│   ├── FoodStalls.js, Props.js (entrance gate), Stage.js, Vegetation.js
│   ├── Lampposts.js (×12 lampposts, ×6 path spotlights)
│   ├── Water.js            Custom GLSL wave + caustic shader
│   ├── Sky.js              HDR crossfade sky-sphere shader
│   ├── Fish.js             Animated clownfish with skeleton
│   └── Fireworks.js        GPU particle burst system
├── lighting/
│   ├── DayNightCycle.js    Sun/moon orbit, tone mapping, lamp control
│   └── LightManager.js     HemisphereLight + DirectionalLight factory
├── people/
│   ├── Visitors.js         NPC pathfinding, procedural gait (~900 lines)
│   └── Passengers.js       Rider template system, seated poses, IK
├── rides/
│   ├── RideBase.js         Shared controller base class (FPV interface, bloom layers, tween lifecycle)
│   ├── FerrisWheel.js, Carousel.js, Coaster.js, Tagada.js
│   ├── Balloon.js, Train.js, ShootingGallery.js
├── ui/
│   ├── ControlPanel.js     3D in-world ride panel (semaphore + lever)
│   ├── Hud.js              Canvas-based time arc, clock, slider
│   ├── RideHints.js        Proximity-fade FPV hint billboards
│   └── RideHotbar.js       HTML bottom bar for ride FPV buttons
└── utils/
    ├── EventBus.js         Pub/sub for decoupled component communication
    ├── NavGrid.js          Occupancy grid + A* for NPC pathfinding
    ├── loaders.js          GLB/HDR/texture loader wrappers
    ├── easings.js          Shared easing functions for tweens
    ├── rideUtils.js        Emissive bulbs, point lights, nightMixLerp helpers
    ├── riverConstants.js   River centre-line / half-width functions
    └── textures.js         Procedural canvas-texture generators (platform, canopy)
```

---

## 2. External Libraries and Tools

This section catalogues every library, framework, and tool used in the project that was not developed by the project team.

### 2.1 Three.js r170

- **Version:** r170 | **Licence:** MIT | **URL:** https://threejs.org

Three.js is the primary rendering library. It provides a scene graph abstraction (`Object3D`, `Group`, `Mesh`), geometry primitives (`CylinderGeometry`, `SphereGeometry`, `TorusGeometry`, `TubeGeometry`, `CatmullRomCurve3`), material types (`MeshStandardMaterial`, `ShaderMaterial`), light types (`DirectionalLight`, `HemisphereLight`, `PointLight`, `SpotLight`), texture utilities (`CanvasTexture`, `TextureLoader`, `PMREMGenerator`), and the WebGL renderer (`WebGLRenderer`). It also provides the `EffectComposer` post-processing pipeline.

Three.js is loaded as an ES module from the `importmap` in `index.html`:

```json
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
  }
}
```

### 2.2 Three.js Addons (r170, MIT)

| Module | Role |
|---|---|
| `OrbitControls` | Mouse orbit, pan, zoom around a target point |
| `EffectComposer` | Multi-pass post-processing pipeline |
| `RenderPass` | Base scene render into a framebuffer |
| `UnrealBloomPass` | Selective bloom on bright emissive elements |
| `OutputPass` | Final tone-map and gamma-correct to canvas |
| `GLTFLoader` | Load `.glb` binary GLTF 3D models |
| `RGBELoader` | Load `.hdr` Radiance RGBE environment maps |

### 2.3 tween.js

- **Version:** 23.1.3 | **Licence:** MIT | **URL:** https://github.com/tweenjs/tween.js

tween.js provides a lightweight interpolation engine used throughout the project for smooth, eased transitions: camera fly-to animations (1.2 s, `Quadratic.InOut`), ride speed ramp-up/ramp-down, lamppost toggle intensity animation, and Tagada arm boarding extension/retraction.

### 2.4 Python `http.server`

Used during development for local serving. No build toolchain is required — the browser resolves all `import` statements via the native ES module system.

### 2.5 GitHub Pages

The project is deployed on GitHub Pages, which serves the repository root as a static site.

---

## 3. External Assets

### 3.1 Asset Pipeline Overview

All 3D models are in **GLB** format (binary GLTF 2.0). The project uses a custom `loadGLB()` wrapper around Three.js's `GLTFLoader` that immediately discards all embedded animation data (`gltf.animations = []`) before returning the scene graph. This enforces the project policy that every motion is hand-written JavaScript math.

PBR texture sets follow the **ambientCG / Poly Haven convention**: separate image files for albedo, tangent-space normal map, roughness map, and where available metalness and ambient-occlusion maps. Textures are loaded with `anisotropy = renderer.capabilities.getMaxAnisotropy()` (typically 16×).

HDR sky environments are in the **RGBE `.hdr`** format and processed by `PMREMGenerator` for image-based lighting across all PBR materials.

### 3.2 Three-Dimensional Models

#### 3.2.1 Rides

| Model | File | Source | Licence |
|---|---|---|---|
| Ferris Wheel | `ferris_wheel.glb` | Quaternius free pack / Sketchfab | CC0 |
| Carousel Horse | `carousel_horse.glb` | Quaternius creature pack | CC0 |
| Roller Coaster Track | `coaster_track.glb` | "Animated roller coaster" by assetfactory, Sketchfab | CC0 |
| Wacky Worm (Train) | `wacky_worm_coaster.glb` | Poly Pizza | CC0 |
| Hot Air Balloon | `balloon.glb` | Quaternius free pack | CC0 |

#### 3.2.2 Buildings and Structures

| Model | File | Source | Licence |
|---|---|---|---|
| Carnival Shooting Booth | `stylized_carnival_booth.glb` | Sketchfab | CC0 |
| Food Stall props | Embedded in environment pack | Quaternius | CC0 |

#### 3.2.3 Human Characters (Visitors and Riders)

All human figures come from the **Quaternius "Ultimate Animated Character Pack"** (CC0). The project loads up to 14 distinct character GLBs as templates at startup, strips all embedded animation data, clones on demand, and drives all bone transformations procedurally through JavaScript.

#### 3.2.4 Props and Interactables

| Model | File | Source | Licence |
|---|---|---|---|
| 9 mm Pistol | `9mm_pistol_low_poly_gun.glb` | Sketchfab | CC0 |
| 9 mm Bullet | `9mm_bullet_low_poly.glb` | Sketchfab | CC0 |
| Environment props (trees, bushes, rocks, benches) | Quaternius environment pack | CC0 |

### 3.3 PBR Texture Sets

All PBR texture sets are sourced from **ambientCG** (CC0):

| Surface | ambientCG Asset | Maps Included |
|---|---|---|
| Grass | GrassField001 | color, normal, roughness, ao |
| Asphalt / Paths | Asphalt026 | color, normal, roughness |
| Wood (Carousel) | WoodFloor050 | color, normal, roughness |

Colour maps are loaded with `THREE.SRGBColorSpace`; normal and roughness maps are loaded as linear data to avoid double-gamma correction.

### 3.4 HDR Sky Environments

Four RGBE equirectangular HDR maps from **Poly Haven** (CC0):

| Preset | Poly Haven Asset |
|---|---|
| Day | Outdoor day HDRI (Kloofendal 48d Partly Cloudy) |
| Sunrise | Sunrise / golden hour HDRI |
| Sunset | Sunset / warm evening HDRI |
| Night | Night sky HDRI |

### 3.5 Licence Compliance Summary

All assets are CC0 (no attribution required) or MIT (attribution in source headers). The project is fully distributable.

---

## 4. Technical Implementation — Rides and Animations

### 4.1 Scene Graph and Hierarchical Models

The scene is structured as a standard Three.js scene graph — a tree of `THREE.Object3D` nodes whose transforms compose from parent to child. Every node stores a local transform (position, rotation, scale); the world transform of any node is the product of all ancestor matrices.

**Project policy**: every motion is hand-written JavaScript. When GLB models are loaded, the custom `loadGLB()` wrapper immediately discards all embedded animation data. No `AnimationMixer` is ever instantiated.

The full top-level scene graph:

```
THREE.Scene
├── sky (sky-sphere mesh)
├── sun (DirectionalLight, shadow enabled)
├── moon (DirectionalLight, no shadow)
├── hemi (HemisphereLight)
├── environmentGroup
│   ├── ground, paths, fence
│   ├── lampposts (×12), pathLights (×6)
│   ├── foodStalls (×6), benches, rocks, vegetation
│   ├── stage, entranceGate
│   ├── river + water (Water.js ShaderMesh)
│   ├── fish (animated clownfish)
│   └── fireworks (GPU particles)
├── ferrisWheel
├── carousel
├── coaster
├── tagada
├── balloon[0..2]
├── train
└── shootingGallery
```

Each ride group encapsulates its entire sub-tree. For example, the Tagada's hierarchy:

```
tagada (Group, world position [-40, 0, 40])
├── foundation (Mesh)
├── baseSkirt (Mesh)
├── armPivot (Group)           pitch + roll + yaw applied here
│   ├── arm (Mesh)
│   ├── armExtension (Group)   telescopes vertically for boarding
│   │   └── disc (Group)      spins continuously when ride is on
│   │       ├── platform (Mesh)
│   │       ├── canopy (Mesh)
│   │       └── seat[0..7] (Group each, with passenger)
│   └── pistons (Mesh ×2)
└── controlPanel (Group)
```

This three-level Group structure allows the compound Tagada oscillation to be implemented by writing to three different `rotation` properties on three different nodes — each node's children inherit all parent rotations automatically.

### 4.2 Ferris Wheel — Counter-Rotation

**Construction**: The Ferris Wheel GLB contains a `wheel` node (the rotating ring) and a `cabin` node whose children are ten individual gondola meshes. The model is authored Z-up with a −90° X-rotation on the root, so the real wheel axis and hub position are measured from world matrices at load time.

**Rotation accumulator**: Each frame, a scalar `wheelSpin` is incremented by `rampedSpeed × delta`, where `rampedSpeed = MAX_SPEED × smoothstep(ramp)` and `ramp` is a [0,1] parameter eased in over `RAMP_UP = 1.5 s` and out over `RAMP_DOWN = 2.0 s`.

**Counter-rotation principle**: Each gondola node is the child of a `mount` Group positioned at the gondola's orbit radius. The mount co-rotates with the ring. The gondola mesh itself is rotated by exactly `−wheelSpin` about the same axis. The world orientation of the gondola is:

```
worldRot(gondola) = parentRot(mount) + localRot(gondola) = (+wheelSpin) + (−wheelSpin) = 0
```

The gondola's world orientation is identically zero at all times — always aligned with the world frame, always upright, exactly as a real Ferris wheel gondola behaves.

**Passenger sway**: Each gondola carries 2 passengers. Their bodies lean by `SWAY_AMP × sin(SWAY_FREQ × t + phaseOffset)` radians — a gentle swaying motion.

### 4.3 Carousel — Phase-Offset Horse Bobbing

**Structure**: The carousel platform is a procedural `CylinderGeometry` disk. Eight horses (cloned from `carousel_horse.glb`) are mounted at equal angular spacing around a radius of approximately 7.5 world units. Each horse sits atop a procedural pole.

**Platform rotation**: `platformAngle += PLATFORM_OMEGA × rampedSpeed × delta`, where `PLATFORM_OMEGA = 0.8 rad/s`.

**Horse bobbing formula**: Each horse `i` has a vertical displacement:

```
y_i(t) = HORSE_BASE_Y + BOB_AMP × sin(2π × HORSE_BOB_FREQ × t + φ_i)
```

where `BOB_AMP = 0.9 m`, `HORSE_BOB_FREQ = 1.5 Hz`, and `φ_i = i × (2π / 8)`.

The uniform distribution of phases produces a Mexican-wave (travelling wave) pattern around the ring as the platform rotates.

**Procedural canopy texture**: The carousel canopy uses a `CanvasTexture` with alternating deep-red and cream-white stripes separated by gold dividers, created entirely in JavaScript.

**Night lighting**: The carousel features 16 rim bulbs, festoon swags drooping between rim points, canopy gore-seam bulbs, vertical column bulb strips, and a glowing gold neon band at the platform edge — all animated with phase-staggered sinusoidal pulsing at night.

### 4.4 Roller Coaster — Parallel Transport Frame

The roller coaster is the most algorithmically complex part of the project, proceeding in four stages.

#### 4.4.1 Track Extraction

The rail tube mesh (`Circle.023_build_gen_1_0`) is a circle of 24 vertices swept along the track, storing `24 × 395 = 9,480` vertices sequentially. The centroid of each 24-vertex ring is a point on the rail centre-line. The 395 raw centroids are low-pass filtered (3 iterations) and down-sampled to 80 control points.

#### 4.4.2 CatmullRom Spline

The 80 control points are passed to `THREE.CatmullRomCurve3(ctrlPts, true, 'catmullrom', 0.5)`. The curve is closed, with `arcLengthDivisions = 20000` for accurate arc-length parameterisation.

#### 4.4.3 Parallel Transport Frame (Bishop Frame)

Instead of the Frenet frame (which suffers from discontinuous flips at inflection points and on straight segments), the code uses a **Parallel Transport (Bishop) frame**. The frame is initialised with the rail spoke direction closest to world-up, then propagated along the curve by applying the rotation that maps each tangent to the next. The result is a globally consistent frame field that matches the physical banking of the rail as modelled by the artist.

#### 4.4.4 Cart Orientation

For each carriage at arc-length parameter `u`:

```js
curve.getTangentAt(u).normalize().negate();  // face forward
getUpVectorAt(u, _up);                       // parallel-transport up
_mtx.lookAt(_origin, _tan, _up);
```

Two trains of four carriages each run simultaneously, offset by 0.5 (half-circuit apart). Each carriage is independently positioned and oriented, hugging the rail exactly.

#### 4.4.5 Energy Model

The coaster's speed varies with altitude:
```
v² = v₀² + 2g(y_top − y)
```
This produces the characteristic roller coaster rhythm: acceleration on descents and deceleration on crests.

#### 4.4.6 Station State Machine

The ride implements a four-state machine: `STOP → LAUNCH → COAST → BRAKE → STOP`. The station pause is 3 seconds between cycles.

#### 4.4.7 Rail Night Glow

At night, the track mesh is split into two material groups: triangles near the centre-line (the rails and ties) receive an emissive material, while support pylons stay dark. The emissive rail material uses `toneMapped = false` for bright glow through ACES tone mapping, recolourable via the colour picker.

### 4.5 Tagada — Compound Oscillation

The Tagada is a mechanical arm ride whose characteristic motion arises from simultaneous three-axis oscillation of the `armPivot` Group:

```js
armPivot.rotation.x = BASE_PITCH + PITCH_AMP × sin(PITCH_FREQ × t);
armPivot.rotation.z = ROLL_AMP × sin(ROLL_FREQ × t);
armPivot.rotation.y += ARM_YAW_SPEED × delta;
```

The pitch frequency (2.6 rad/s) and roll frequency (1.9 rad/s) are incommensurable, producing quasi-periodic motion that never exactly repeats within a typical ride cycle — the trajectory in the (pitch, roll) phase plane traces a Lissajous figure. The disc platform at the end of the arm spins at `MAX_SPIN_SPEED = 2.0 rad/s` independently.

A boarding mode telescopes the arm down by 7.5 units via TWEEN when stopped, and extends back when the ride starts.

### 4.6 Panoramic Train — CatmullRom Track

The train ride follows a hand-authored closed CatmullRom curve with 20 control points that circle the entire park perimeter at scenic height. The track climbs to 11.5 units for panoramic views over the stage, dips to ground level at the corners, and crosses the river twice via elevated bridges. The curve's `getPointAt` method is overridden to Y-clamp at 0.2 units, preventing the track from dipping underground.

A single locomotive and three wagons from the Wacky Worm GLB are positioned along the curve using the same arc-length parameterisation technique as the roller coaster, with a Y-90° offset for proper wagon orientation. Curvature-based banking is applied, with a sharpness of 1.2 and a maximum bank angle of 0.3 radians.

### 4.7 Hot Air Balloons — Wind-Drift Trajectory

Three hot air balloons drift freely above the park in assigned zones. Their horizontal trajectory is driven by **2D value noise** (deterministic hash function with smoothstep interpolation), producing smooth, organic drift patterns that never repeat exactly. Each balloon oscillates vertically with a gentle sine wave (`A = 2.5 units`, `freq = 0.15 Hz`) and is buffeted by a configurable wind speed parameter.

Each balloon carries 2–3 passengers. A camera rig at head height enables FPV mode from the basket.

### 4.8 RideBase — Shared Controller Architecture

Although every ride is implemented in its own file, all six ride controllers share the same lifecycle, state, and external API through a common base class `RideBase` (`src/rides/RideBase.js`). Centralising this infrastructure in one place removed large amounts of duplicated code that would otherwise have been copy-pasted across the ride modules and, more importantly, gives the rest of the application a single contract for talking to a ride.

The class owns three categories of state that every ride needs:

- **`running` / `speedMultiplier`** — the on/off flag and a per-ride scaling factor applied to every animation that uses the base speed. The speed multiplier is exposed to the user via the scroll-wheel handler (Section 6.4) and clamped to the same `[0.2, 1.5]` range for every ride.
- **`nightMix ∈ [0, 1]`** — a single exponential-interpolation factor that smoothly fades every night-only effect in and out. The interpolation is encapsulated in the helper `nightMixLerp(current, isNight, delta, rate)` from `src/utils/rideUtils.js`, which uses the standard `current + (target − current) × (1 − exp(−rate·delta))` form so that the transition speed is framerate-independent. Each ride reuses the same `nightMix` value, ensuring that all night transitions across the scene happen at the same perceptual rate.
- **Bloom-layer membership** — every ride meshes (excluding the control panel) are pushed onto Three.js light layer 2 via `applyBloomLayers()`. This is how the post-processing `UnrealBloomPass` selectively picks up only the rides' emissive bulbs and not the static environment.

Three further responsibilities are exposed as overridable hooks:

- **FPV interface** — every controller subclass implements `getFpvTarget()`, `getFpvCameraPos(target, out)`, `getFpvLookTarget(target, out)`, `getFpvUp(target, out)`, and `getFpvOffset()`. `CameraManager.enterFPV(closestRide)` invokes these polymorphically, so adding a new FPV-equipped ride is a matter of subclassing `RideBase` and filling in the five methods — no changes to the camera system are required. For example, the Ferris Wheel returns its `gondolaMounts[0].cameraRig` as the target and an offset of `(0, 1.5, 0)` for head height; the panoramic train returns the locomotive's `cameraRig` and a forward-looking direction derived from the parent wagon's world quaternion.
- **Tween lifecycle** — `trackTween(t)` registers a `TWEEN.Tween` with the controller. When the ride is stopped (or the controller is disposed of), all tracked tweens are stopped and removed, preventing callbacks from firing against stale state. This is used for the colour-picker transitions and any one-off animation a ride kicks off.
- **EventBus hygiene** — `addEventBusListener(event, cb)` wraps the standard `eventBus.on()` call so that, on disposal, every listener the controller registered is automatically unsubscribed. This protects against the classic "listener fired after the scene was torn down" bug that would otherwise produce `Cannot read property of undefined` errors on ride stop.

The common `tickSpeed(controlPanel, delta)` method returns the current eased speed factor in `[0, 1]`. It encapsulates the `smoothstep` ramp-up and ramp-down curves and keeps the `RAMP_UP` / `RAMP_DOWN` semantics consistent across rides. Most rides keep the default 0.5 s ramp; the panoramic train and the Ferris wheel use 1.5 s up / 2.0 s down for a heavier feel that matches their physical scale.

### 4.9 Shooting Gallery — FPS Aim with Controller

The shooting gallery (`ShootingGallery.js`) provides a first-person aim experience and is the most architecturally elaborate ride, refactored around a dedicated `ShootingGalleryController` class that owns all of its state, including the player position, target list, muzzle state, and aim history.

**Booth and operator setup.** When the gallery is built, a procedurally constructed booth and a "cowboy" operator (a Quaternius character clone in a cowboy outfit) are positioned behind the counter. The cowboy's right-hand bone (`Fist.R` or `HandR`, with fallbacks to `LowerArmR`) is located by name lookup and a `9mm_pistol_low_poly_gun.glb` clone is attached to it as a child Object3D, so the gun follows the operator's hand throughout his idle animation. The same GLB is also instantiated a second time as the player-held **FPS gun** parented to the camera rig: when the user enters aim mode, the FPS gun becomes visible at the lower right of the screen and follows the mouse-controlled yaw and pitch.

**Aim mode and Pointer Lock.** Clicking the booth enters aim mode: `canvas.requestPointerLock()` hides the cursor, the camera is teleported to the operator's front view, and the FPS gun's rotation tracks `aimYaw` and `aimPitch` deltas. The gun base orientation is `Y = π` (facing the targets in −Z) and the relative yaw/pitch from the mouse is applied in the `'YXZ'` Euler order. A first-frame clamp is applied so the player cannot spin past the booth (the unclamped implementation that previously let the user look behind the booth was reverted — see Section 5.4 for the design rationale).

**Muzzle flash and recoil.** A `THREE.PointLight` (the `muzzleLight`, orange `0xff9922`, range 4 units, decay 1.5) is positioned at the gun's muzzle and lights up on every shot. Its intensity is integrated each frame as `muzzleFlashIntensity = max(0, muzzleFlashIntensity − dt·65)`, producing a fast exponential decay that matches the duration of a real muzzle flash. A `CanvasTexture` of a yellow-orange radial gradient with seven radial rays is rendered into a `THREE.Sprite` with `AdditiveBlending` and `depthWrite = false`; the sprite's `scale` and the material's `opacity` are bound to the same intensity so the visible flash grows and fades in lockstep with the light. When the player fires, a `recoilX` / `recoilY` kick is added to the gun rotation and decayed at `dt · 8`; a `cameraShake` vector is summed into the camera position so the viewpoint itself jumps slightly, giving the shot a tactile feel.

**Targets.** Ten targets are spawned on a row across the back of the booth, evenly spaced at `bound = ±2.8` units from the centre. Each target oscillates left and right at a randomised speed and direction (`t.speed × t.direction`) and wraps around when it reaches the edge. On a hit, the target is given an initial angular velocity `omega` and `hitTime = now`; its rotation is integrated with a damped pendulum equation `α = −g·sin(θ) − damping·ω` over four sub-steps per frame, producing a believable physical "flipping back" animation. Each target mesh's `emissiveIntensity` decays from `8.0` toward zero over the recovery, making the target glow for the duration of the spin.

**Scoring and timer.** When a bullet ray hits a target, the controller computes a distance-based multiplier (closer targets score more) and emits a score event. A `timer` counter runs for 30 s; on expiry the controller calls `exitAimMode()` and freezes the score. The reticle, score, and timer are all rendered into a CSS-positioned `<canvas>` HUD overlay drawn on top of the WebGL canvas.

**Exit.** `ESC` releases the pointer lock via `document.exitPointerLock()`; the controller tweens the camera back to the pre-aim orbit position over 0.8 s.

---

## 5. Technical Implementation — Lighting, Shaders, and PBR

### 5.1 Lighting System

The scene employs a structured approximation of the rendering equation decomposed into three semantically distinct light categories.

#### 5.1.1 Ambient Sky — HemisphereLight

A `HemisphereLight` approximates indirect illumination with two colours — sky scatter (upper hemisphere) and ground-bounce (lower hemisphere) — interpolated by the surface normal's elevation. The sky colour changes with the diurnal phase: daytime clear blue (`0x87ceeb`) / earth brown (`0x8b7355`), twilight warm orange (`0xff9970`), night deep navy (`0x2a3a64`) / near-black (`0x12121f`).

#### 5.1.2 Direct Sunlight — DirectionalLight

The sun's colour animates from saturated orange-gold at sunrise to near-white at solar noon. Intensity ramping uses `smoothstep` of `sunHeight` to produce a subjectively natural dawn and dusk. This light is solely responsible for shadow casting.

#### 5.1.3 Moonlight

A secondary `DirectionalLight` sits opposite the sun with a cool blue-grey colour (`0x4466aa`). Its intensity ramps in as the sun sets (`smoothstep(moonHeight, 0.0, 0.3) × 6.0`), reaching a peak of approximately 6.0 at full moon elevation. It does not cast shadows.

#### 5.1.4 Artificial Night Lighting

Five categories activate at night:
1. **12 Lamppost PointLights** with quadratic distance attenuation
2. **Stage Spotlight** (SpotLight) targeting the stage platform (mounted on the roof edge)
3. **6 Path Spotlights** at intersections for navigational legibility
4. **Per-ride Decoration PointLights** with phase-staggered sinusoidal pulsing and runtime colour configurability
5. **Fence String Lights** — emissive bulbs strung along the park perimeter fence, day/night aware and recolourable via the HUD colour picker (eventBus + TWEEN transition)

### 5.2 Day/Night Cycle

The diurnal cycle is governed by a normalised time parameter `t ∈ [0, 1]`, with 0.00 = midnight, 0.25 = sunrise, 0.50 = noon, 0.75 = sunset. The sun position is derived geometrically:

```
sunAngle = (t − 0.25) × 2π
sunY = sin(sunAngle), sunX = −cos(sunAngle)
```

Tone-mapping exposure and background intensity are animated as functions of `sunHeight`, using `smoothstep` with different threshold ranges. Night detection is via the predicate `sun.position.y < 5 OR sun.intensity < 0.5`.

### 5.3 PCF Shadow Maps

**PCFSoftShadowMap** (Percentage Closer Filtering with a 9×9 Poisson-disk kernel) produces smooth penumbra gradients. The directional sun light uses a **4096 × 4096** shadow map with an orthographic frustum of **180 × 180** world units. Only the sun casts shadows — point lights do not, to stay within the real-time performance budget.

### 5.4 Custom GLSL Shaders

#### 5.4.1 Water Shader

The water surface (`Water.js`) uses a fully custom `ShaderMaterial` with both stages in GLSL ES 3.00.

**Vertex stage**: Surface displacement is a sum of four sinusoidal Gerstner wave trains with different directions, wavelengths, amplitudes, and speeds. The displaced surface normal is computed analytically by summing partial derivatives. Up to 8 concentric ripple wave-packets are triggered by fish entry/exit events.

**Fragment stage**: Multi-layer optical model including:
- **Depth-based colour** transitioning from deep blue at the channel centre to shallow cyan near banks
- **Procedural caustics** via two-scale value noise with cubic exponentiation
- **Blinn-Phong specular** highlight using the sun direction uniform
- **Schlick Fresnel** reflectance blended against a sky-colour tint
- **Bank-edge foam** and crest-foam layers with animated noise
- **Night tint** mixing toward a moonlit blue-grey

#### 5.4.2 Sky Shader

The sky is rendered on an inverted sphere (`Sky.js`) using a custom `ShaderMaterial`.

**Vertex stage**: Removes the translation component from the view matrix and forces `gl_Position.z = gl_Position.w` to place the sky at the far plane.

**Fragment stage**: Samples two HDR equirectangular textures simultaneously using equirectangular UV projection (`atan(z,x)` for azimuth, `asin(y)` for elevation). The two colours are blended via the `uMix` uniform. Four HDR presets (night, sunrise, day, sunset) are crossfaded on a schedule that covers the full 24-hour cycle.

**PMREM**: Each HDR preset bakes a pre-filtered mipmapped radiance environment map via `PMREMGenerator` for image-based lighting on all `MeshStandardMaterial` objects.

#### 5.4.3 Fireworks Shader

The fireworks system (`Fireworks.js`) is a GPU particle system using `BufferGeometry` with custom vertex attributes (`aVelocity`, `aLifetime`, `aType`, `aTrailOffset`).

**Vertex stage**: Ballistic integration entirely in the vertex shader:
```glsl
pos = uCenter + aVelocity × uAge − 0.5 × uGravity × uAge²
```
Particles whose `uAge` exceeds `aLifetime` are culled by projecting to a degenerate position.

**Fragment stage**: Radial gradient alpha using `gl_PointCoord`, with linear fade by `lifeRatio`. Three burst archetypes: **spherical** (uniform velocity on a sphere), **corona** (horizontal equatorial ring), **willow** (drooping trails with downward gravity bias).

### 5.5 PBR Material Workflow

All `MeshStandardMaterial` instances use Three.js's implementation of the **GGX/Trowbridge-Reitz microfacet BRDF** (Walter et al. 2007, Disney BRDF Burley 2012):

```
f(l, v) = f_d + f_s
f_d = c_diff / π
f_s = F(l, h) · G(l, v, h) · D(h) / (4 · (n·l) · (n·v))
```

Texture channels used: albedo (sRGB linearised), tangent-space normal map, roughness map (GGX α), metalness map (conductor/dielectric split), ambient occlusion map (IBL diffuse modulation), emissive map (self-illumination, set above bloom threshold of 1.5).

All textures use maximum available anisotropic filtering (typically 16×) for correct appearance at shallow grazing angles.

### 5.6 Post-Processing

**UnrealBloomPass**: Multi-scale selective bloom (threshold 1.5, strength 0.35, radius 0.4). Only self-illuminating surfaces above the luminance threshold participate. The bloom is composited additively over the HDR scene.

**ACES filmic tone mapping**: S-shaped transfer function with shadow lift, highlight rolloff, and mid-tone saturation preservation.

---

## 6. Technical Implementation — NPCs, Camera, and Interactions

### 6.1 NPC Visitors and Procedural Walk Cycle

The park is populated by 10 NPC visitors that roam continuously (~900 lines in `Visitors.js`).

#### 6.1.1 State Machine and Waypoints

Each NPC operates a **WAIT ↔ WALK** two-state machine. On arrival at a waypoint, the NPC waits 1–5 seconds, then selects a new destination from the hand-authored waypoint graph covering the entire park.

#### 6.1.2 A* Pathfinding on a Navigation Grid

Continuous path queries use **A*** on a coarse occupancy grid (`CELL = 2` world-unit squares) implemented in `NavGrid.js`. Each cell is flagged blocked if it overlaps any obstacle: rides, buildings, trees (seeded at load time), the river (except the bridge crossing), or the fence perimeter. The heuristic is Euclidean distance; the cost function penalises cells adjacent to obstacles.

A **string-pulling** step removes redundant waypoints wherever a straight line-of-sight exists, producing smooth routes.

#### 6.1.3 Procedural Gait Engine

Four-layer synthesised walk cycle (no clips, no mixers):

**Layer 1 — Foot Targets**: Each foot alternates stance (planted, world velocity zero) and swing (Hermite arc with heel-strike dorsiflexion and toe-off plantarflexion). Phase advances by `distance / stride`, eliminating foot-skate.

**Layer 2 — Two-Bone Leg IK**: Analytic IK places thigh and shin bones, calibrated from the skeleton's own geometry at spawn for correct proportions across all 14 outfit variants.

**Layer 3 — Pelvis Rhythm**: Vertical bob at 2× step frequency, lateral weight shift toward the stance leg, yaw counter-rotation, and roll counter-phased with lateral shift.

**Layer 4 — Trunk and Limbs**: Spine counter-rotation, forward lean proportional to speed, arm swing opposite to same-side leg, elbow flex, and head stabilisation.

#### 6.1.4 Visual Variety and Crowd Separation

14 outfit variants from the Quaternius pack plus HSL hue shift per NPC for unique colours. A separation force prevents overlapping.

### 6.2 Passenger System

`Passengers.js` provides shared infrastructure for all rides.

`makeRider(template, height, opts)` clones a template, caches key bone references, and adds the clone to the scene. `updateRider(rider, time)` applies procedural seated poses (rest, lookL/R, lookUp, point, relax, cheer, wave) via a state-machine.

Seated leg pose (`applyChairSeatedLegs`) sets ~90° hip and knee flexion for carousel jockeys and Tagada disc riders.

### 6.3 Camera System

`CameraManager.js` manages four distinct camera modes:

**Orbit mode**: Default, using `OrbitControls` with damping (factor 0.08), distance range [5, 250], and max polar angle 0.49π.

**Click-to-fly**: A `THREE.Raycaster` tests clicks against all interactive objects. On hit, a TWEEN animates both `camera.position` and `controls.target` over 1.2 s with `Quadratic.InOut` easing.

**Preset viewpoints**: Six hardcoded positions (keys 1–6) providing instant access to the full park overview, Ferris wheel close-up, carousel, roller coaster loop, Tagada, and stage.

**First-person view (FPV)**: Pressing C enters FPV mode aboard the nearest ride. The camera is attached to ride-specific nodes (gondola seat, coaster cart, Tagada disc, train cabin, balloon basket) and updated each frame from the node's world transform. ESC exits FPV with a 0.8 s tween back to the pre-FPV position. The FPV interface is defined on the shared `RideBase` class: every ride controller exposes `getFpvTarget()`, `getFpvCameraPos()`, `getFpvLookTarget()`, `getFpvUp()`, and `getFpvOffset()`, which `CameraManager` invokes polymorphically — adding a new FPV-equipped ride only requires implementing these five methods on its controller subclass.

### 6.4 User Interactions

#### Interaction Infrastructure

`InteractionManager.js` maintains a single `THREE.Raycaster` updated on every `pointermove` and `click`. Interactive objects (ride panels, lampposts, stage spotlights, ground) are registered in typed arrays.

`ControlPanel.js`: Each ride has a 3D in-world panel with a semaphore bulb (red/green) and a lever that tilts when the ride is on.

`RideHints.js`: Proximity-fade billboard sprites near rides, visible when the camera approaches within a configurable radius.

`RideHotbar.js`: HTML bar at screen bottom with named buttons — clicking enters FPV for that ride.

#### Complete Interaction Reference

| Interaction | Trigger | Mechanism |
|---|---|---|
| Fly camera to point | Left-click on ground/ride/scenery | Raycaster → CameraManager.flyToWorldPoint() TWEEN |
| Toggle ride on/off | Left-click on control panel | Raycaster → ControlPanel.toggle() → speed ramp TWEEN |
| Toggle lamppost | Left-click on lamppost | Raycaster → 3-state cycle (Auto/Manual-off/Manual-on) |
| Toggle stage spotlight | Left-click on stage faretto | Same 3-state mechanism |
| Adjust ride speed | Scroll wheel over ride | speed clamped [0.2×, 1.5×] |
| Preset viewpoints 1–6 | Keys 1–6 | CameraManager.flyToPreset(n) TWEEN |
| Enter FPV | Key C near ride | CameraManager.enterFPV(closestRide) |
| Exit FPV / aim mode | ESC | CameraManager.exitFPV() → tween back |
| Pause/resume time | Space | Toggle DayNightCycle auto-advance |
| Set time of day | HUD time slider | DayNightCycle.setHour(value) |
| Change decoration colour | HUD colour picker | eventBus.emit → all ride PointLights + emissive mats update |
| Shoot (gallery) | Left-click in pointer-lock | Raycaster vs targets → score += multiplier |
| Hover cursor | Mouse move over clickable | cursor: pointer driven by raycaster |

---

## 7. Mapping to Course Topics

| Course Topic | Luna Park Demonstration |
|---|---|
| 2D/3D Transformations | Hierarchical scene graph; composed rotation chains (Ferris gondola counter-rotation, Carousel platform+horses, Tagada arm pivot+disc); CatmullRom arc-length parameterisation for coaster cart placement |
| Coordinate Systems | Model-space vs world-space computation in FerrisWheel.js; localToWorld/worldToLocal in rail centreline extraction; NPC bone positions transformed for IK |
| GPU Rendering Pipeline | Three.js as WebGL 2.0 abstraction; three custom ShaderMaterial shaders (Water, Sky, Fireworks) with hand-written vertex and fragment stages |
| Vertex Shaders (GLSL) | Water: per-vertex sum-of-sine displacement with analytical normals; Sky: translation-free view matrix, forced depth; Fireworks: ballistic integration entirely in vertex shader |
| Fragment Shaders (GLSL) | Water: caustic noise, Blinn-Phong specular, Fresnel, foam, night tint; Sky: equirectangular UV mapping, HDR crossfade; Fireworks: radial gradient alpha |
| Lighting / Shading Models | Blinn-Phong specular in water shader; MeshStandardMaterial GGX/Trowbridge-Reitz microfacet BRDF; HemisphereLight + DirectionalLight approximation of rendering equation |
| Textures | PBR maps (albedo, normal, roughness, metalness, AO, emissive); CanvasTexture for procedural textures (carousel canopy); HDR equirectangular for sky and IBL |
| Normal Mapping | Tangent-space normal maps from ambientCG on grass, asphalt, wood; perturbs per-fragment normals for surface micro-detail |
| Shadow Maps | PCFSoftShadowMap on sun DirectionalLight; 4096×4096 shadow map; orthographic frustum 180×180 world units |
| Ray Casting / Picking | THREE.Raycaster for click-to-fly, panel interaction, lamppost toggle, ride speed scroll; ShootingGallery pointer-lock aim |
| Spline Curves | CatmullRomCurve3 for coaster track (control points from geometry), train ring track, balloon drift waypoint steering; getPointAt/getTangentAt for arc-length parameterised placement |
| Hierarchical Models | Ferris Wheel (ring → mount → gondola); Carousel (platform → pole → horse); Tagada (base → armPivot → arm → disc → seats); human figure rig |
| Computer Animations | All ride animations hand-coded in JS: sine-based bobbing, compound oscillation, parallel-transport frame orientation, counter-rotation identity; procedural NPC gait with foot IK |
| Particle Systems | GPU particle fireworks: three burst archetypes, positions integrated in vertex shader using ballistic equations |
| Procedural Geometry | Tagada built entirely from primitives; carousel platform and poles; river surface mesh (320×16 grid); fence string-light points |
| IBL / Environment Maps | PMREM maps from four HDR presets; scene.environment for specular IBL on all MeshStandardMaterial surfaces |
| Post-Processing | UnrealBloomPass (threshold 1.5, strength 0.35) for selective glow; ACESFilmicToneMapping for HDR-to-display mapping |
| Pathfinding / Spatial Algorithms | A* on NavGrid occupancy grid; string-pulling for path smoothing; analytic two-bone leg IK |

---

## 8. User Manual

### 8.1 Running the Project

**Requirements**: A modern browser with WebGL 2.0 support (Chrome 80+, Firefox 78+, Edge 80+, Safari 15+).

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

> The project must be served over HTTP/HTTPS — `file://` URLs will fail due to CORS restrictions on ES module imports.

### 8.2 Complete Controls Reference

#### Camera Navigation

| Input | Action |
|---|---|
| Left-click on ground/ride/object | Fly camera smoothly to that point (1.2 s) |
| Left drag (hold) | Orbit camera around target |
| Right drag | Pan camera |
| Scroll wheel (not over ride) | Zoom in/out |
| Key 1 | Overview: bird's-eye view of entire park |
| Key 2 | Ferris Wheel close-up |
| Key 3 | Carousel close-up |
| Key 4 | Roller Coaster — full loop visible |
| Key 5 | Tagada close-up |
| Key 6 | Stage close-up |
| Key C | Enter first-person view (FPV) aboard nearest ride |
| ESC | Exit FPV or shooting gallery aim mode |

#### Rides

| Input | Action |
|---|---|
| Left-click on ride's control panel | Start/stop that ride (speed eases in/out) |
| HUD ride speed sliders | Adjust ride speed (range: 0.2× – 1.5×) |
| Bottom hotbar buttons | Enter FPV mode for the labelled ride directly |

#### Lighting and Environment

| Input | Action |
|---|---|
| Left-click on lamppost | Toggle lamppost (3 states: Auto/Manual-off/Manual-on) |
| Left-click on stage spotlight | Toggle spotlight (same 3-state cycle) |
| Space | Pause/resume day/night auto-advance |
| Time slider (HUD) | Set time of day (0–24 h) |
| Colour picker (HUD) | Change colour of all ride decoration lights |

#### Shooting Gallery

| Input | Action |
|---|---|
| Key T (near shooting booth) | Enter FPV aim mode (pointer lock) |
| Mouse movement (in aim mode) | Rotate aim reticle |
| Left-click (in aim mode) | Shoot — hit targets score points |
| ESC (in aim mode) | Exit shooting gallery |

### 8.3 HUD Overview

| Element | Location | Description |
|---|---|---|
| Time arc | Top-right | Semicircular arc showing sun/moon position |
| Digital clock | Top-right | Current in-game time as HH:MM |
| Time slider | Top-right | Drag to manually set the hour |
| Auto-advance toggle | Top-right | Button to pause/resume automatic time |
| FPS counter | Bottom-right | Real-time frames-per-second display |
| Colour picker | Left panel | Changes emissive colour of all ride bulbs |
| Ride hotbar | Bottom centre | Row of buttons to enter FPV per ride |

### 8.4 Usage Tips

1. Start with key **1** to see the entire park from above.
2. Set time to **21–22** to activate night fireworks and night lighting.
3. Click a **control panel** to start a ride, then press **C** for FPV.
4. Use the **colour picker at night** with rides running for the best visual effect.
5. Press **Space** to freeze time and inspect a specific lighting condition.
6. **Scroll over a ride** to slow it down for a closer look at animations.

