# 🎠 Luna Park — Interactive 3D Amusement Park

**Course:** Interactive Graphics — Prof. Marco Schaerf  
**Institution:** Sapienza University of Rome — DIAG  
**Project:** Luna Park (Amusement Park 3D)  
**Technology Stack:** Three.js r158+ · tween.js · WebGL  
**Deadline Target:** June 20, 2026 (exam: June 24, 2026)  

---

## Live Demo

> **GitHub Pages URL:** _(activate after final push)_  
> Direct link will be placed here before submission.

---

## Project Summary

An interactive, real-time 3D amusement park rendered in the browser via Three.js and WebGL. The scene features four fully-animated hierarchical amusement rides, a richly detailed park environment (ground, paths, lampposts, food stalls, fences, skybox), a dynamic day/night cycle, advanced raycasting-based interaction, and a fly-to navigation system.

The project directly demonstrates mastery of every graded topic from the Interactive Graphics course:

| Course Topic | Demonstration in Project |
|---|---|
| Lecture 04–05: 2D/3D Transformations | Hierarchical scene graph, composed rotation chains |
| Lecture 06: GPU Pipeline / WebGL | Three.js as WebGL abstraction; custom GLSL shaders |
| Lecture 07–08: Surfaces & Meshes | Procedural geometry, imported GLB meshes |
| Lecture 09–10: Textures on GPU | PBR texture sets (albedo, normal, roughness, emissive) |
| Lecture 11–12: Shading | Phong/PBR materials, normal mapping, specular |
| Lecture 13: Rendering Equation | PBR material system, HemisphereLight + DirectionalLight |
| Lecture 15: Ray Tracing | Raycasting for click-to-fly and 3D panel interaction |
| Lecture 16: Shadows & Reflections | PCF shadow maps on DirectionalLight |
| Lecture 17: Sampling | Texture MIP-maps, anisotropic filtering |
| Lecture 18: Computer Animations | All ride animations implemented in JavaScript |
| Lecture 19: Physics-based Animations | Gondola pendulum, rider lean physics |

---

## Quick Start

```
git clone <repo-url>
cd luna-park
# No build step needed — open index.html via a local server
npx serve .   # or python3 -m http.server 8080
```

Open `http://localhost:8080` in a modern browser (Chrome/Firefox recommended).

---

## Controls

| Input | Action |
|---|---|
| Left-click on ground/ride | Fly camera to that location |
| Left-click on 3D panel | Toggle ride start/stop |
| Left-click on lamppost | Toggle light on/off |
| Scroll wheel | Adjust selected ride speed |
| `C` near Ferris wheel | Toggle first-person gondola camera |
| Day/Night slider (UI) | Advance time of day |
| Color picker (UI) | Change ride decoration light color |
| Orbit drag (right mouse / two-finger) | Free orbit camera |

---

## Repository Structure

```
luna-park/
├── index.html              ← Entry point
├── js/
│   ├── main.js             ← Scene init, render loop
│   ├── environment/        ← Ground, paths, skybox, lampposts, stalls
│   ├── rides/              ← FerrisWheel, Carousel, Coaster, Tagada
│   ├── characters/         ← Visitors (NPC walkers)
│   ├── interaction/        ← Raycaster, click-to-fly, panel system
│   ├── lighting/           ← Day/night cycle, light manager
│   ├── animation/          ← AnimationManager, tween wrappers
│   └── utils/              ← Helpers, math, loaders
├── assets/
│   ├── models/             ← GLB/GLTF files (geometry only, no animations)
│   ├── textures/           ← PBR texture sets
│   └── audio/              ← (optional) ambient sounds
├── libs/                   ← three.js, tween.js (vendored)
├── docs/                   ← THIS DOCUMENTATION
│   ├── graphics/
│   ├── interaction/
│   ├── assets/
│   └── phases/
└── README.md
```

---

## Documentation Index

### Core Planning
- [Project Overview](PROJECT_OVERVIEW.md)
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md)
- [Development Roadmap](DEVELOPMENT_ROADMAP.md)
- [Milestones](MILESTONES.md)
- [Task Tracker](TASK_TRACKER.md)

### Graphics & Rendering
- [Rendering Pipeline](graphics/RENDERING_PIPELINE.md)
- [Scene Structure](graphics/SCENE_STRUCTURE.md)
- [Lighting Strategy](graphics/LIGHTING_STRATEGY.md)
- [Material System](graphics/MATERIAL_SYSTEM.md)
- [Shader Plan](graphics/SHADER_PLAN.md)
- [Camera System](graphics/CAMERA_SYSTEM.md)
- [Post Processing](graphics/POST_PROCESSING.md)
- [Performance Optimization](graphics/PERFORMANCE_OPTIMIZATION.md)

### Interaction & Animation
- [Interaction Design](interaction/INTERACTION_DESIGN.md)
- [Input System](interaction/INPUT_SYSTEM.md)
- [UI/UX Plan](interaction/UI_UX_PLAN.md)
- [Animation System](interaction/ANIMATION_SYSTEM.md)
- [State Management](interaction/STATE_MANAGEMENT.md)

### Assets
- [Asset Pipeline](assets/ASSET_PIPELINE.md)
- [Model List](assets/MODEL_LIST.md)
- [Texture List](assets/TEXTURE_LIST.md)
- [Audio Plan](assets/AUDIO_PLAN.md)

### Development Phases
- [**Phase 1 — Environment (CURRENT)**](phases/PHASE1_ENVIRONMENT.md)
- [Phase 2 — Rides & Hierarchical Models](phases/PHASE2_RIDES.md)
- [Phase 3 — Interaction Systems](phases/PHASE3_INTERACTION.md)
- [Phase 4 — Polish & Delivery](phases/PHASE4_POLISH.md)

---

## Grading Alignment

The project is designed to maximise the grade under Prof. Schaerf's criteria:

1. **Hierarchical Models** ✅ — Four rides, each a multi-level scene graph subtree  
2. **Lights and Textures** ✅ — 6 light types, full PBR sets (albedo/normal/roughness/emissive)  
3. **User Interaction** ✅ — Click-to-fly, 3D control panels, day/night slider, light toggles  
4. **Animations** ✅ — All implemented in JavaScript; NO imported animations  

---

_Last updated: Phase 1 planning — May 2026_
