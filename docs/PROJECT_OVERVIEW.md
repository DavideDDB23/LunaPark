# Project Overview — Luna Park 3D

> Back to [README](README.md)

---

## 1. Vision Statement

Luna Park is a real-time interactive 3D amusement park that runs entirely in the browser. The scene transports the viewer into a fully lit, textured fairground populated with four operational rides, wandering visitors, decorative structures, and a sky that transitions from day to night. Every animated element is driven by JavaScript code — no imported animations — demonstrating explicit mastery of hierarchical transformations, shading, textures, and raycasting as taught in the Interactive Graphics course.

The goal is not just to satisfy the minimum requirements, but to create a showcase project: visually impressive, technically rigorous, and pleasant to demonstrate during the oral exam.

---

## 2. Core Concept

### Theme
A classic European-style luna park at the golden hour, transitioning into evening. Think warm-lit carousels, glowing Ferris wheels against a darkening sky, food stalls with striped awnings, and the smell of popcorn (metaphorically).

### Uniqueness Factors
- **Counter-rotation gondolas:** The Ferris wheel gondolas apply inverse rotation of their parent ring — a textbook demonstration of composed hierarchical transforms that professors immediately recognise.
- **Click-to-fly navigation:** The user never touches a traditional orbit control; they click any point in the world and the camera smoothly interpolates there, making presentations feel cinematic.
- **3D control panels:** Rides are started/stopped by clicking physical levers inside the scene — raycasting on arbitrary mesh geometry, not HTML buttons.
- **Day/night cycle with automatic lamp activation:** As the sun dips below the horizon, all lampposts and ride lights activate automatically — demonstrating dynamic light management.

---

## 3. Technical Stack

| Component | Choice | Rationale |
|---|---|---|
| 3D Engine | Three.js r158+ | Course-approved; large ecosystem; WebGL abstraction matches course GPU pipeline lecture |
| Smooth tweening | tween.js 21+ | Explicitly recommended in the project requirements slide |
| Asset format | GLB/GLTF 2.0 | Standard Three.js loader; supports PBR materials, no embedded animations needed |
| Texture source | Poly Haven + ambientCG | CC0 license; 8K PBR sets; no attribution needed |
| Model source | Sketchfab (CC license) + procedural | Geometry-only imports; all animations written in JS |
| Hosting | GitHub Pages | Required by project steps |
| Build | No bundler — ES modules | Zero toolchain friction; works on GitHub Pages out of the box |

---

## 4. Scene Composition Overview

### Environment Layer (Phase 1 — current)
- Flat rectangular ground plane (200×200 units) — grass texture
- Paved circular paths connecting ride areas — asphalt/cobblestone texture
- Park perimeter fence — wooden picket style
- 12× decorative lampposts distributed along paths
- 6× food stalls / bancarelle placed at path junctions
- Central stage / performance area with spotlight
- Dynamic skybox: daytime HDRI → night starfield swap
- Ambient HemisphereLight (sky blue / ground brown)
- DirectionalLight (sun) orbiting on a day/night arc

### Rides Layer (Phase 2)
- Ferris Wheel (Ruota Panoramica) — 8-arm hierarchical rotation
- Carousel (Giostra Cavalli) — platform + 8 horses with phase-offset bob
- Roller Coaster (Ottovolante) — cart along CatmullRomCurve3
- Mechanical Arm (Tagada) — 3-joint articulated arm

### Characters Layer (Phase 3)
- 8–12 low-poly visitors walking between waypoints
- Simple capsule + sphere geometry with painted textures
- Path-following state machine (idle → walk → queue → ride)

### Interaction Layer (Phase 3)
- Raycaster on every click event
- Click-to-fly system (tween camera position + lookAt)
- 3D control panel toggle per ride
- Day/night slider
- Lamppost toggle
- Speed modifier per ride (scroll wheel)
- FPV gondola camera (C key)

---

## 5. Course Material Connections

### Lecture 04 — 2D Transformations
Rotation, translation, and scale matrices form the foundation of every animation in the project. The carousel platform rotation, horse bob, and Ferris wheel ring rotation are all 2D rotations lifted to 3D.

### Lecture 05 — 3D Transformations
The gondola counter-rotation is the canonical example: `gondola.rotation.y = -ring.rotation.y` at each frame, demonstrating how child transforms compose with parent transforms in the scene graph.

### Lecture 06 — GPU Pipeline & WebGL
Three.js wraps WebGL. Understanding the vertex → fragment shader pipeline informs custom emissive materials, normal-mapped surfaces, and the post-processing (when added). The VAO/VBO model maps directly to Three.js BufferGeometry.

### Lecture 07–08 — Surfaces & Triangular Meshes
The CatmullRomCurve3 for the roller coaster track is a direct application of parametric surface theory. TubeGeometry wraps the curve into renderable mesh. The Frenet frame (tangent/normal/binormal) from curve theory orients the cart.

### Lecture 09–10 — Textures on GPU
Every surface in the park uses a PBR texture set. UV mapping, MIP-map generation, anisotropic filtering, and texture atlasing are all applied, directly mapping to the GPU texture upload pipeline taught in lectures 09–10.

### Lecture 11–12 — Shading & Shading Transformations
MeshStandardMaterial (PBR) implements the Cook-Torrance BRDF approximated in real-time. Normal maps transform surface normals in tangent space. The conversion of normal vectors under non-uniform scaling (using the inverse-transpose matrix) is applied correctly.

### Lecture 13 — The Rendering Equation
The HemisphereLight + DirectionalLight combination approximates the rendering equation's ambient + direct illumination terms. Emissive materials add a self-illumination term independent of incident light, representing L_e in the equation.

### Lecture 15 — Ray Tracing
Raycasting (Three.js Raycaster) is the real-time sibling of ray tracing: a ray is cast from the camera through the pixel and tested for intersection with scene geometry. Used for both click-to-fly and 3D control panel interaction.

### Lecture 16 — Shadows & Reflections
PCF shadow maps on the DirectionalLight cast soft shadows across the park. Shadow camera frustum is carefully tuned to the scene bounds to avoid wasted shadow map resolution.

### Lecture 17 — Sampling
MIP-map generation prevents texture aliasing on distant ground surfaces. Anisotropic filtering (anisotropy: 8) corrects textures viewed at oblique angles, especially the grass and asphalt ground planes.

### Lecture 18 — Computer Animations
Every animation — ring rotation, horse bobbing, cart path-following, arm oscillation — is implemented as a parametric function of time `t` in the animation loop. No imported animation data.

### Lecture 19 — Physics-based Animations
Gondola pendulum: angular acceleration ∝ −sin(angle), damped. Rider lean in roller coaster cart: centripetal acceleration from curve tangent change produces lean angle. These are simplified physics models integrated in the animation loop.

---

## 6. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Raycaster performance with many objects | Medium | Medium | Use object layers; only raycast against specific layer |
| Shadow map aliasing on large scene | High | Medium | Tune shadow camera frustum; use PCF shadows |
| Frame rate drops with multiple PointLights | Medium | High | Limit to 8 shadow-casting lights; rest are non-shadow |
| GLB model file size too large | Low | Medium | Check poly count before use; retopologise if needed |
| Day/night skybox swap causes visual pop | Low | Medium | Cross-fade using two skybox meshes with opacity tween |
| GitHub Pages CORS issues with asset loading | Medium | High | Use relative paths; vendor all libs |

---

## 7. Evaluation Maximisation Strategy

See [MILESTONES.md](MILESTONES.md) for the graded checkpoint strategy.

Key principles:
1. **Show the scene graph explicitly during the demo:** open browser console, print the hierarchy. Professors love to see you understand what you built.
2. **Have a "wow moment" prepared:** the first-person gondola camera ride is that moment.
3. **Keep performance above 30fps on integrated graphics:** test on a budget machine before the exam.
4. **Document every technical decision:** the accompanying report must reference specific course topics.
5. **Never import animations:** this is stated twice in the requirements — a violation is an automatic deduction.
