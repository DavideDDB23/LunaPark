# Development Roadmap — Luna Park 3D

> Back to [README](README.md)  
> See also: [Milestones](MILESTONES.md) | [Task Tracker](TASK_TRACKER.md)

---

## Overview

The project follows a **vertical-slice, phase-by-phase** approach. Each phase produces a running, demoable build. No phase depends on a future phase being complete. This allows:
- A clean demo at any point in time
- Easy checkpointing for partial submission
- Parallel work if working in a group

**Total estimated time:** ~35–45 developer-hours  
**Target deadline:** June 20, 2026  

---

## Phase Map

```
Phase 1 — Environment (0 → 1)         ←── YOU ARE HERE
  Ground, paths, skybox, fence,
  lampposts, food stalls, basic lights
  
    ↓

Phase 2 — Rides & Hierarchy (1 → 2)
  FerrisWheel, Carousel, RollerCoaster,
  Tagada + 3D control panels
  
    ↓

Phase 3 — Interaction & Characters (2 → 3)
  Click-to-fly, day/night, lamppost toggle,
  speed control, gondola FPV, NPC visitors
  
    ↓

Phase 4 — Polish & Delivery (3 → 4)
  Post-processing, audio, perf tuning,
  report writing, GitHub Pages
```

---

## Phase 1 — Environment

**Goal:** A beautiful, demoable park ground that already looks impressive on its own.  
**Duration:** ~8–10 hours  
**Deliverable:** `index.html` opens to a lit, textured park scene with walkable floor, paths, fence perimeter, lampposts, food stalls, and a proper skybox. Camera orbits freely.

### Week 1 Task Breakdown

| Day | Task | File(s) |
|---|---|---|
| Day 1 | Project skeleton: index.html, libs, folder structure | index.html, main.js |
| Day 1 | Three.js renderer + camera + orbit controls | main.js |
| Day 1 | Ground plane with grass PBR texture (repeat 40×40) | environment/Ground.js |
| Day 2 | Path network: 4 main paths (PlaneGeometry patches) | environment/Paths.js |
| Day 2 | Skybox (daytime HDRI converted to skybox cube) | environment/Sky.js |
| Day 2 | HemisphereLight + DirectionalLight (no cycle yet) | lighting/LightManager.js |
| Day 3 | Fence perimeter (instanced or merged geometry) | environment/Fence.js |
| Day 3 | Lamppost model import (GLB) + PointLight child nodes | environment/Lampost.js |
| Day 4 | Food stall models (6×) placed at path junctions | environment/FoodStall.js |
| Day 4 | Central stage platform geometry | environment/Stage.js |
| Day 5 | Shadow setup: PCF shadow maps, tuned frustum | main.js / LightManager.js |
| Day 5 | Texture QA: mipmap, anisotropy, repeat check | AssetLoader.js |
| Day 5 | Normal map integration on ground/path surfaces | Ground.js, Paths.js |
| Day 5 | Screenshots, performance check (target 60fps) | — |

**Phase 1 Success Criteria:**
- [ ] Ground plane visible with grass texture, correct UV repeat
- [ ] Paths visible as distinct asphalt/cobble surface
- [ ] Fence visible around perimeter
- [ ] 12 lampposts placed correctly along paths
- [ ] 6 food stalls placed at junctions
- [ ] Central stage present
- [ ] Skybox rendering, no seams
- [ ] Shadows casting from DirectionalLight onto ground
- [ ] Normal maps producing visible surface detail
- [ ] 60fps on test machine with no rides yet
- [ ] No console errors

---

## Phase 2 — Rides & Hierarchical Models

**Goal:** All four rides built as proper Three.js scene-graph hierarchies, animated in JavaScript.  
**Duration:** ~14–16 hours  
**Deliverable:** Park from Phase 1 + four running rides, each with a 3D control panel, all animations JS-driven.

### Week 2 Task Breakdown

| Day | Task | File(s) |
|---|---|---|
| Day 1 | FerrisWheel: hub + ring + 8 arms + 8 gondolas | rides/FerrisWheel.js |
| Day 1 | FerrisWheel: counter-rotation gondola logic | rides/FerrisWheel.js |
| Day 2 | FerrisWheel: passengers (oscillation ±5°) | rides/FerrisWheel.js |
| Day 2 | Carousel: platform + tettoia + 8 poles + 8 horses | rides/Carousel.js |
| Day 2 | Carousel: horse Y-bob with phase offset formula | rides/Carousel.js |
| Day 3 | RollerCoaster: CatmullRomCurve3 track definition | rides/RollerCoaster.js |
| Day 3 | RollerCoaster: TubeGeometry track mesh | rides/RollerCoaster.js |
| Day 3 | RollerCoaster: cart position + Frenet orientation | rides/RollerCoaster.js |
| Day 4 | Tagada: base + arm1 + arm2 + seat platform | rides/Tagada.js |
| Day 4 | Tagada: three-axis oscillation with sin(t*n) phases | rides/Tagada.js |
| Day 4 | 3D control panels (all 4 rides) | interaction/ControlPanel.js |
| Day 5 | AnimationManager: register all ride animators | animation/AnimationManager.js |
| Day 5 | Ease-in / ease-out on ride start/stop via tween | animation/AnimationManager.js |
| Day 5 | Ride materials: wood + metal PBR textures applied | rides/*.js |
| Day 5 | Performance check with all rides running | — |

**Phase 2 Success Criteria:**
- [ ] Ferris wheel ring rotates; gondolas remain vertical
- [ ] Carousel horses bob with distinct phase offsets
- [ ] Roller coaster cart follows parametric curve correctly
- [ ] Tagada arm produces chaotic multi-axis motion
- [ ] All 4 control panels are clickable and toggle rides
- [ ] Ease-in/ease-out on ride start/stop
- [ ] Ride textures applied (wood/metal)
- [ ] 60fps with all rides running simultaneously

---

## Phase 3 — Interaction & Characters

**Goal:** Full interactive experience: fly-to navigation, day/night, NPC walkers.  
**Duration:** ~10–12 hours  
**Deliverable:** Complete interactive park experience.

| Day | Task | File(s) |
|---|---|---|
| Day 1 | Click-to-fly raycaster (ground hits) | interaction/ClickToFly.js |
| Day 1 | Camera tween (position + lookAt interpolation) | camera/CameraController.js |
| Day 2 | Day/night slider: sun orbit + sky colour transition | lighting/DayNightCycle.js |
| Day 2 | Auto-lamp activation at night | lighting/DayNightCycle.js |
| Day 2 | Lamppost click toggle (individual light on/off) | interaction/InteractionManager.js |
| Day 3 | Speed scroll-wheel modifier per ride | interaction/InteractionManager.js |
| Day 3 | FPV gondola camera (C key attach/detach) | camera/CameraController.js |
| Day 3 | Color picker for ride lights | ui/UIManager.js |
| Day 4 | NPC visitor: capsule geometry + painted texture | characters/Visitor.js |
| Day 4 | Waypoint graph for visitor path-following | characters/WaypointGraph.js |
| Day 4 | Visitor walk animation (body sway, stride) | characters/Visitor.js |
| Day 5 | UI panel (HTML overlay): day/night slider, help text | ui/UIManager.js |
| Day 5 | Keyboard shortcut handler (C, R for reset, etc.) | interaction/InputSystem.js |
| Day 5 | Ride lights (coloured PointLights on structures) | lighting/RideLights.js |

**Phase 3 Success Criteria:**
- [ ] Click on ground flies camera there
- [ ] Click on ride name flies camera to that ride
- [ ] Day/night slider moves sun and changes sky
- [ ] Lamps auto-activate at night
- [ ] Individual lamppost click toggles its light
- [ ] Speed modifier works per ride (scroll when near ride)
- [ ] C key attaches/detaches gondola FPV camera
- [ ] Color picker changes ride decoration light color
- [ ] Visitors walk between waypoints without clipping ground
- [ ] UI overlay non-intrusive and clearly labeled

---

## Phase 4 — Polish & Delivery

**Goal:** Submission-ready project with documentation, GitHub Pages deployment.  
**Duration:** ~6–8 hours  

| Task | Details |
|---|---|
| Performance pass | Profile with Chrome DevTools; reduce draw calls |
| Shadow quality tuning | Adjust frustum, bias, normalBias |
| Emissive blink shader | Ride lights pulse at night |
| Night skybox swap | HDRI day → starfield night with tween |
| Audio (optional) | Web Audio API: ambient fairground sounds |
| Fog | THREE.Fog or FogExp2 for depth/atmosphere |
| Report writing | 10+ page technical + user manual PDF |
| GitHub Pages activation | Test live URL, confirm all assets load |
| README GitHub link | Add live link to README |
| Email to Prof. Schaerf | Notification before deadline |
| Oral exam prep | Key talking points, demo script, console walkthrough |

---

## Dependency Graph (simplified)

```
AssetLoader
    │
    ├── EnvironmentBuilder ──────────────────────────────┐
    │       └── Ground, Paths, Fence, Lamps, Stalls      │
    │                                                    │
    ├── RidesBuilder ──────────────────────────────────┐ │
    │       └── FerrisWheel, Carousel, Coaster, Tagada  │ │
    │                                                   │ │
    ├── LightManager ← EnvironmentBuilder               │ │
    │       └── DayNightCycle                           │ │
    │                                                   │ │
    ├── AnimationManager ← RidesBuilder                 │ │
    │                                                   │ │
    ├── InteractionManager ← Rides + Lamps + Camera     │ │
    │                                                   │ │
    ├── CameraController ← RidesBuilder (gondola nodes)  │ │
    │                                                   │ │
    ├── CharacterSystem ← EnvironmentBuilder (waypoints)─┘ │
    │                                                      │
    └── UIManager ← StateManager ← all above──────────────┘
```

---

## Git Workflow

### Branching Strategy
```
main           ← always demoable; tagged at each phase boundary
├── phase/1-environment  ← current active development branch
├── phase/2-rides
├── phase/3-interaction
└── phase/4-polish
```

### Commit Convention
```
feat(env): add grass ground plane with PBR texture
feat(rides): ferris wheel gondola counter-rotation
fix(camera): flyTo tween target height clamp
perf(env): merge static fence geometry into single BufferGeometry
docs: update TASK_TRACKER phase 1 progress
```

### Tag Strategy
- `v0.1-env-complete` — after Phase 1
- `v0.2-rides-complete` — after Phase 2
- `v0.3-interaction-complete` — after Phase 3
- `v1.0-submission` — final submission tag

---

## Risk Register

| Risk | Trigger | Fallback |
|---|---|---|
| Poly Haven CDN down | Asset load fails at exam | Pre-download all textures to `/assets/textures/` |
| Ride animation stutters | Delta accumulation | Clamp delta to max 50ms |
| Raycaster slow on dense scene | >5ms per frame | Layer mask; reduce raycast targets |
| Shadow acne on ground | Normal bias issue | Increase normalBias to 0.05 |
| GitHub Pages MIME errors | GLB not served correctly | Vendor local copies, correct .htaccess |
| Exam machine too slow | Integrated GPU, old browser | Pre-record 60fps screen capture as backup |
