## Section 6 — Mapping to Course Topics

This section explicitly maps each topic covered in the Interactive Graphics course lectures to the corresponding feature in the Luna Park project that demonstrates it.

### 6.1 Reference Table

| Course Topic | Luna Park Demonstration |
|---|---|
| 2D/3D Transformations | Hierarchical scene graph; composed rotation chains in rides (Ferris gondola counter-rotation, Carousel platform+horses, Tagada arm pivot+disc); CatmullRom arc-length parameterisation for coaster cart placement |
| Coordinate Systems | Model-space vs world-space computation in `FerrisWheel.js` (hub and axis measured from world matrices, not local coords); `localToWorld` / `worldToLocal` used in rail centreline extraction; NPC bone positions in armature-local space transformed to world for IK |
| GPU Rendering Pipeline | Three.js as WebGL 2.0 abstraction: vertex buffers → vertex shader → rasterisation → fragment shader → framebuffer. The pipeline is made explicit by the three custom `ShaderMaterial` shaders (Water, Sky, Fireworks) where vertex and fragment stages are written by hand |
| Vertex Shaders (GLSL) | Water shader: per-vertex displacement by sum-of-sine waves with analytical normal computation; Sky shader: translation-free view matrix and forced `gl_Position.z = gl_Position.w`; Fireworks: ballistic integration `pos = center + vel·age − 0.5·g·age²` entirely in the vertex shader |
| Fragment Shaders (GLSL) | Water: caustic procedural noise, Blinn-Phong specular, Fresnel reflectance, bank foam, night tint; Sky: equirectangular UV mapping, two-HDR crossfade; Fireworks: radial gradient alpha per particle |
| Lighting / Shading Models | Blinn-Phong specular in water fragment shader; Three.js `MeshStandardMaterial` implements GGX/Trowbridge-Reitz microfacet BRDF; `HemisphereLight` + `DirectionalLight` approximation of the rendering equation (ambient + direct irradiance) |
| Textures | PBR texture maps (albedo, normal, roughness, metalness, AO, emissive) on all surfaces; `CanvasTexture` for procedural textures (Tagada platform sunburst, carousel canopy stripes); HDR equirectangular maps for sky and IBL; texture anisotropy set to max device capability |
| Normal Mapping | Tangent-space normal maps from ambientCG applied to grass, asphalt, and wood surfaces; perturbs per-fragment normals for surface micro-detail without any added geometry |
| Shadow Maps | `PCFSoftShadowMap` on the sun `DirectionalLight`; 4096×4096 shadow map; orthographic frustum 180×180 world units; soft penumbra via Poisson-disk kernel weighted averaging |
| Ray Casting / Picking | `THREE.Raycaster` used for: click-to-fly, panel interaction, lamppost toggle, ride speed scroll; `ShootingGallery` pointer-lock aim system shoots a ray from screen centre against target meshes |
| Spline Curves | `THREE.CatmullRomCurve3` for roller coaster track (control points extracted from geometry); panoramic train ring track; balloon drift waypoint steering; `getPointAt(u)` / `getTangentAt(u)` for arc-length parameterised placement |
| Hierarchical Models | Ferris Wheel (ring → mount → gondola chain); Carousel (platform → pole → horse → jockey); Tagada (base → armPivot → arm → disc → seats); human figure rig (pelvis → spine → upper body → limbs → feet) |
| Computer Animations | All ride animations hand-coded in JS: sine-based bobbing (carousel), sinusoidal compound oscillation (Tagada), parallel-transport frame orientation (coaster), counter-rotation identity (Ferris wheel); procedural NPC gait with foot IK |
| Particle Systems | GPU particle fireworks (`Fireworks.js`): three burst archetypes (spherical, corona, willow); particle positions integrated in vertex shader using ballistic equations |
| Procedural Geometry | Tagada ride built entirely from `CylinderGeometry`, `TorusGeometry`, `BoxGeometry`, `SphereGeometry`, `RingGeometry`; carousel platform and poles; river surface mesh (320×16 grid conforming to the river's curved centreline); fence string-light points |
| IBL / Environment Maps | PMREM maps baked from four HDR presets at startup; `scene.environment` set to the nearest HDR for IBL; all `MeshStandardMaterial` surfaces receive physically correct specular reflections from the environment |
| Post-Processing | `UnrealBloomPass` (threshold 1.5, strength 0.35, radius 0.4) for selective glow on emissive ride lights, water specular, and fireworks; `ACESFilmicToneMapping` maps HDR values to display range with filmic S-curve |
| Pathfinding / Spatial Algorithms | A* on `NavGrid` occupancy grid for NPC route planning; string-pulling for path smoothing; analytic two-bone leg IK for NPC walker and Tagada passenger legs |

### 6.2 Discussion

The project was designed from the outset to cover as many course topics as possible within a single, coherent application. Rather than implementing each technique as an isolated demo, every feature is integrated into the amusement park scene in a way that contributes to the overall visual and interactive experience.

The **hierarchical model** requirement is most clearly demonstrated by the Ferris Wheel's counter-rotation: the mathematical identity `worldRot = +φ + (−φ) = 0` is a direct consequence of the parent-child composition of rotations in the scene graph, which is the central concept of Section 4.1 of the course.

**Custom GLSL shaders** are present in three separate systems: the water shader demonstrates sum-of-sine wave displacement with analytical normal computation (a classic technique from GPU Gems); the sky shader demonstrates HDR crossfading and the equirectangular mapping used in environment-map rendering; the fireworks shader demonstrates a GPU particle system with ballistic physics — a paradigm where computation moves from CPU to GPU via per-vertex attribute arrays.

The **rendering equation** is approximated by the lighting setup: the `HemisphereLight` represents the diffuse sky irradiance (the integral of radiance over the upper hemisphere, approximated as a single sample), the `DirectionalLight` represents direct solar irradiance, and the `MeshStandardMaterial`'s GGX BRDF correctly evaluates the Cook-Torrance specular term for each fragment.

---

## Section 7 — User Manual

### 7.1 Running the Project

**Requirements**: a modern web browser with WebGL 2.0 support.

| Browser | Minimum Version |
|---|---|
| Google Chrome | 80 (released Feb 2020) |
| Mozilla Firefox | 78 (released Jun 2020) |
| Microsoft Edge | 80 (released Feb 2020) |
| Safari | 15 (released Sep 2021) |

No installation is required. Serve the project root directory with any static HTTP server:

```bash
# Option A: Python (no installation)
python3 -m http.server 8080
# then open http://localhost:8080

# Option B: Node.js serve package
npx serve .
# then open http://localhost:3000

# Option C: GitHub Pages (live demo)
# Open the GitHub Pages URL from the README
```

> **Note**: The project must be served over HTTP/HTTPS — opening `index.html` directly as a `file://` URL will fail due to browser cross-origin restrictions on ES module imports.

### 7.2 Complete Controls Reference

#### Camera Navigation

| Input | Action |
|---|---|
| Left-click on ground, ride, or object | Fly camera smoothly to that point (1.2 s) |
| Left drag (hold) | Orbit the camera around the current target |
| Right drag | Pan the camera |
| Scroll wheel (not over a ride) | Zoom in / out |
| Key `1` | Overview: bird's-eye view of the entire park |
| Key `2` | Ferris Wheel close-up |
| Key `3` | Carousel close-up |
| Key `4` | Roller Coaster — full loop visible |
| Key `5` | Tagada close-up |
| Key `6` | Stage close-up |
| Key `C` | Enter first-person view (FPV) aboard the nearest ride |
| `ESC` | Exit FPV or shooting gallery aim mode |

#### Rides

| Input | Action |
|---|---|
| Left-click on a ride's control panel | Start or stop that ride (speed eases in/out) |
| Scroll wheel while hovering over a ride | Adjust ride speed (range: 0.2× – 1.5×) |
| Bottom hotbar buttons | Enter FPV mode for the labelled ride directly |

#### Lighting and Environment

| Input | Action |
|---|---|
| Left-click on a lamppost | Toggle that lamppost (3 states: Auto / Manual-off / Manual-on) |
| Left-click on stage faretto | Toggle the stage spotlight (same 3-state cycle) |
| `Space` | Pause or resume the day/night auto-advance |
| Time slider (HUD) | Drag to set the time of day (0–24 h) |
| Colour picker (HUD) | Change the colour of all ride decoration lights |

#### Shooting Gallery

| Input | Action |
|---|---|
| Left-click on shooting booth | Enter FPV aim mode (pointer lock) |
| Mouse movement (in aim mode) | Rotate aim reticle |
| Left-click (in aim mode) | Shoot — hit targets score points (distance multiplier) |
| `ESC` (in aim mode) | Exit shooting gallery, return to orbit |

### 7.3 HUD Overview

| HUD Element | Location | Description |
|---|---|---|
| Time arc | Top-right | Semicircular arc showing sun/moon position; sun icon tracks from left (sunrise) to right (sunset); moon icon tracks at night |
| Digital clock | Top-right | Current in-game time displayed as HH:MM |
| Phase label | Under clock | Current phase: Day / Dusk / Night / Dawn |
| Time slider | Top-right | Drag to manually set the hour; auto-advance continues from the new position |
| Auto-advance toggle | Top-right | Button to pause/resume automatic time progression |
| FPS counter | Bottom-right | Real-time frames-per-second display |
| Colour picker | Left panel | HTML colour input; changes emissive colour of all ride decoration bulbs in real time |
| Ride hotbar | Bottom centre | Row of ride name buttons; click any to enter FPV for that ride |

### 7.4 Usage Tips

1. **Start with key `1`** to see the entire park from above and orient yourself.
2. **Set time to 21–22** (drag the slider) to activate the night fireworks and see the park's night lighting.
3. **Click a control panel** to start a ride, then **press C** to enter FPV for an immersive experience.
4. **Use the colour picker at night** with the rides running to see the best of the phase-offset blinking decoration lights.
5. **Click any lamppost** to manually toggle it off for a darker area effect; the Auto state will restore it at dawn.
6. **Press Space** to freeze time and inspect a specific lighting condition (sunrise, golden hour, etc.).
7. **Scroll over a ride** to slow it down for a closer look at the animation mechanics.

---

## Appendix — Performance Notes

### A.1 Expected Frame Rate

The project targets 60 FPS on hardware capable of WebGL 2.0. On a MacBook Pro M2 Pro (tested), the following frame rates were observed:

| Scene Condition | Approximate FPS |
|---|---|
| Daytime, all rides stopped, overview (key 1) | ~60 FPS |
| Daytime, all rides running | ~60 FPS |
| Night, all rides running, lampposts on | ~55–60 FPS |
| Night, all rides running, fireworks active | ~50–60 FPS |
| FPV inside roller coaster | ~60 FPS |
| Shooting gallery FPV | ~60 FPS |

### A.2 Draw Call Budget

Three.js issues approximately **200–400 draw calls** per frame, depending on scene visibility. The main contributors are:

| System | Approx. Draw Calls |
|---|---|
| GLB ride models (shared geometry instancing) | 40–80 |
| NPC visitor meshes (10 NPCs × ~5 meshes each) | 50 |
| Environment props (trees, benches, stalls, fence) | 60–100 |
| Water, sky, fireworks (ShaderMaterial) | 3 |
| Shadow map pass (duplicates geometry pass) | +100–200 |

Three.js does not automatically merge draw calls across scene objects, but frustum culling (enabled on all objects except the sky mesh) eliminates draw calls for off-screen geometry.

### A.3 Triangle Budget

| System | Approximate Triangles |
|---|---|
| Roller coaster GLB (detailed track + carts) | ~120,000 |
| Ferris wheel GLB | ~40,000 |
| NPC visitors × 10 | ~50,000 |
| Carousel horses × 8 | ~20,000 |
| Shooting gallery pistol model | ~15,000 |
| Environment (trees, stalls, stage, gate) | ~80,000 |
| Procedural geometry (Tagada, paths, fence, water) | ~30,000 |
| **Total (approximate)** | **~355,000** |

### A.4 GPU Bottlenecks

- **PCF shadow map (4096² px)**: the main GPU memory consumer (~64 MB for the shadow map at 32-bit depth). The PCF multi-sample kernel also costs additional texture fetches per fragment during the main render pass.
- **UnrealBloomPass**: the bloom pass performs two full-resolution Gaussian blur passes and one composite pass on the framebuffer. At 1080p, this is the main rendering overhead after the shadow map.
- **Water shader vertex load**: the water mesh is `320 × 16 = 5,120` quads (30,720 vertices). The vertex shader executes a sum of 4 sine-wave functions per vertex, which is low cost but non-trivial at 60 FPS.
- **Fireworks GPU particles**: each burst contains ~300 particles with per-vertex shader physics. Bursts are short-lived (<3 s) and overlapping bursts are uncommon, so the GPU load is bounded.

### A.5 Frustum Culling Strategy

| Object Type | Frustum Culled? | Reason |
|---|---|---|
| Sky sphere | ❌ No | Must always be visible |
| All other meshes | ✅ Yes | Default Three.js behaviour |
| Water mesh | ✅ Yes | Only visible near the river |
| NPC meshes | ✅ Yes | Only visible in middle ground |
| Ride GLB meshes | ✅ Yes | `frustumCulled = true` is the default |

### A.6 GPU Memory Estimate

| Resource | Approximate GPU Memory |
|---|---|
| 4 HDR textures (4096×2048 RGBE, mipmapped) | ~128 MB |
| Shadow map (4096×4096, 32-bit depth) | ~64 MB |
| PBR texture maps (grass × 4, asphalt × 3, wood × 3) | ~30 MB |
| GLB mesh geometry (VBOs) | ~20 MB |
| Framebuffer + bloom pass targets | ~30 MB |
| **Total (approximate)** | **~272 MB** |

These figures are within the WebGL 2.0 memory limits of all modern discrete and integrated GPUs.
