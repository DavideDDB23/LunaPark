# Task Tracker — Luna Park 3D

> Back to [README](README.md)  
> Update status as work progresses: ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ❌ BLOCKED

---

## Phase 1 — Environment

### P1.1 — Project Skeleton
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.1.1 | Create index.html with canvas and import maps | ⬜ | |
| P1.1.2 | Vendor three.js r158+ into /libs | ⬜ | |
| P1.1.3 | Vendor tween.js 21+ into /libs | ⬜ | |
| P1.1.4 | Create main.js with renderer, scene, camera, clock | ⬜ | |
| P1.1.5 | Add OrbitControls (temporary default view) | ⬜ | |
| P1.1.6 | Confirm WebGL context initialises without error | ⬜ | |
| P1.1.7 | Create folder structure (js/, assets/, docs/) | ⬜ | |
| P1.1.8 | Initialise GitHub repo, push skeleton | ⬜ | |

### P1.2 — Ground Plane
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.2.1 | Download grass_meadow texture set from Poly Haven (2K) | ⬜ | albedo + normal + roughness |
| P1.2.2 | Create PlaneGeometry(200, 200, 1, 1) rotated -π/2 on X | ⬜ | |
| P1.2.3 | Load albedo texture; set repeat(40,40), RepeatWrapping | ⬜ | |
| P1.2.4 | Load normal map; assign to MeshStandardMaterial.normalMap | ⬜ | |
| P1.2.5 | Load roughness map; assign to roughnessMap | ⬜ | |
| P1.2.6 | Set anisotropy to renderer.capabilities.getMaxAnisotropy() | ⬜ | |
| P1.2.7 | Enable shadow receiving (receiveShadow = true) | ⬜ | |
| P1.2.8 | Visual QA: no tiling seams visible at normal viewing distances | ⬜ | |

### P1.3 — Path Network
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.3.1 | Download asphalt_02 texture from Poly Haven (2K) | ⬜ | |
| P1.3.2 | Define 4 path rectangles (N-S and E-W cross layout) | ⬜ | 6 units wide |
| P1.3.3 | Create PlaneGeometry for each path, y-offset +0.01 (avoid z-fight) | ⬜ | |
| P1.3.4 | Apply asphalt PBR material to paths | ⬜ | |
| P1.3.5 | Create central circular hub (CircleGeometry r=8) | ⬜ | |
| P1.3.6 | Visual QA: paths sit cleanly on ground | ⬜ | |

### P1.4 — Skybox
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.4.1 | Download day HDRI from Poly Haven (outdoor/sky category, 2K EXR) | ⬜ | e.g. "blue_lagoon" or "kloppenheim" |
| P1.4.2 | Convert HDRI to CubeRenderTarget using PMREMGenerator | ⬜ | |
| P1.4.3 | Assign to scene.background and scene.environment | ⬜ | |
| P1.4.4 | Night skybox: create BoxGeometry(1000) with starfield texture | ⬜ | |
| P1.4.5 | Prepare night skybox mesh (initially hidden, opacity=0) | ⬜ | |
| P1.4.6 | Visual QA: no seams, horizon matches ground | ⬜ | |

### P1.5 — Lighting (Static)
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.5.1 | Add HemisphereLight(0x87CEEB, 0x8B7355, 0.8) | ⬜ | sky blue / ground warm |
| P1.5.2 | Add DirectionalLight(0xFFFAE0, 2.5) at position(50,80,30) | ⬜ | warm sun colour |
| P1.5.3 | Enable castShadow on DirectionalLight | ⬜ | |
| P1.5.4 | Configure shadow.camera: left/right/top/bottom = ±120, near=0.1, far=300 | ⬜ | |
| P1.5.5 | Set shadow.mapSize = 2048×2048 | ⬜ | |
| P1.5.6 | Set shadow.bias = -0.001, normalBias = 0.02 | ⬜ | |
| P1.5.7 | Visual QA: shadows cast from stalls/fence, no peter-panning | ⬜ | |

### P1.6 — Fence
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.6.1 | Choose approach: GLB import or procedural BoxGeometry | ⬜ | prefer GLB for visual quality |
| P1.6.2 | If GLB: download low-poly wooden fence from Sketchfab (CC license) | ⬜ | see MODEL_LIST.md |
| P1.6.3 | If procedural: create fence segment (post + horizontal rails) | ⬜ | |
| P1.6.4 | Tile fence segments around 190×190 perimeter | ⬜ | ~4-unit spacing |
| P1.6.5 | Apply wood texture (ambientCG WoodPlanks) | ⬜ | albedo + normal |
| P1.6.6 | Enable castShadow and receiveShadow | ⬜ | |
| P1.6.7 | Visual QA: fence continuous, no gaps at corners | ⬜ | |

### P1.7 — Lampposts
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.7.1 | Download lamppost GLB from Sketchfab (see MODEL_LIST) | ⬜ | |
| P1.7.2 | Import with GLTFLoader; confirm geometry only (strip animations) | ⬜ | |
| P1.7.3 | Create 12 lamppost instances along path edges | ⬜ | 3 per path arm |
| P1.7.4 | Attach PointLight child to each lamp head (initially off) | ⬜ | intensity=2, distance=15, decay=2 |
| P1.7.5 | Store lamp reference in userData: lampMesh.userData.pointLight | ⬜ | |
| P1.7.6 | Add lamppost meshes to interactionManager lampLayer | ⬜ | |
| P1.7.7 | Visual QA: lamps visible, lights activate correctly | ⬜ | |

### P1.8 — Food Stalls
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.8.1 | Download carnival stall GLB from Sketchfab (see MODEL_LIST) | ⬜ | |
| P1.8.2 | Place 6 stalls at path junction offset positions | ⬜ | |
| P1.8.3 | Apply striped awning texture if model lacks it | ⬜ | |
| P1.8.4 | Enable shadows on stall meshes | ⬜ | |
| P1.8.5 | Add billboard/sign placeholder geometry | ⬜ | optional but visual |
| P1.8.6 | Visual QA: stalls look integrated with the scene | ⬜ | |

### P1.9 — Central Stage
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.9.1 | Create raised platform: CylinderGeometry(r=8, h=0.5) | ⬜ | |
| P1.9.2 | Apply concrete/wood stage texture | ⬜ | |
| P1.9.3 | Add SpotLight above stage (initially off) | ⬜ | target at center |
| P1.9.4 | Add simple backdrop geometry behind stage | ⬜ | |

### P1.10 — Phase 1 QA & Performance
| ID | Task | Status | Notes |
|---|---|---|---|
| P1.10.1 | Chrome DevTools performance profile — target <8ms frame time | ⬜ | |
| P1.10.2 | Confirm renderer.info.render.calls < 50 for environment alone | ⬜ | |
| P1.10.3 | Test on Firefox | ⬜ | |
| P1.10.4 | Take screenshots for documentation | ⬜ | |
| P1.10.5 | Tag git: v0.1-env-complete | ⬜ | |

---

## Phase 2 — Rides

_(Tasks will be broken down in detail when Phase 1 is complete)_

| ID | Task | Status |
|---|---|---|
| P2.1 | FerrisWheel class: full scene graph | ⬜ |
| P2.2 | FerrisWheel: gondola counter-rotation | ⬜ |
| P2.3 | FerrisWheel: passenger oscillation | ⬜ |
| P2.4 | Carousel class: platform + horses | ⬜ |
| P2.5 | Carousel: phase-offset horse bobbing | ⬜ |
| P2.6 | RollerCoaster: CatmullRomCurve3 + TubeGeometry | ⬜ |
| P2.7 | RollerCoaster: cart Frenet frame | ⬜ |
| P2.8 | Tagada: 3-joint articulated arm | ⬜ |
| P2.9 | All control panels (4×) | ⬜ |
| P2.10 | AnimationManager integration | ⬜ |
| P2.11 | Ease-in/out on ride start/stop | ⬜ |
| P2.12 | Ride PBR materials | ⬜ |

---

## Phase 3 — Interaction

| ID | Task | Status |
|---|---|---|
| P3.1 | Click-to-fly raycaster | ⬜ |
| P3.2 | Camera tween (position + lookAt) | ⬜ |
| P3.3 | Day/night slider + sun orbit | ⬜ |
| P3.4 | Auto-lamp day/night trigger | ⬜ |
| P3.5 | Lamppost click toggle | ⬜ |
| P3.6 | Speed scroll modifier | ⬜ |
| P3.7 | FPV gondola camera | ⬜ |
| P3.8 | Color picker ride lights | ⬜ |
| P3.9 | NPC visitors + waypoints | ⬜ |
| P3.10 | UI overlay panel | ⬜ |

---

## Phase 4 — Polish

| ID | Task | Status |
|---|---|---|
| P4.1 | Emissive blink shader | ⬜ |
| P4.2 | Night skybox transition | ⬜ |
| P4.3 | Atmospheric fog | ⬜ |
| P4.4 | Performance pass | ⬜ |
| P4.5 | Technical report (PDF, 10+ pages) | ⬜ |
| P4.6 | GitHub Pages activation + test | ⬜ |
| P4.7 | Submission email | ⬜ |
