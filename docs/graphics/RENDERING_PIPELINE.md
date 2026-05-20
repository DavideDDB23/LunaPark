# Rendering Pipeline — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Pipeline Overview

The rendering pipeline is a standard rasterisation pipeline exposed through Three.js / WebGL 2.0, augmented with custom GLSL shaders for specific effects. This section maps each stage to the course lecture content and describes the implementation strategy.

```
CPU Side                                   GPU Side
────────────────────────────────────────────────────────
Scene Graph Update
  ↓
Matrix Computations (matrixWorldNeedsUpdate)
  ↓
Frustum Culling (Three.js built-in)
  ↓
Render Queue Sort (opaque → transparent)
  ↓                                  ┌────────────────────┐
Draw Call Dispatch ──────────────────►  Vertex Shader      │
  (VAO bind, uniform upload)        │  (transform + uv)   │
                                    │         ↓            │
                                    │  Rasterisation       │
                                    │  (fragment gen)      │
                                    │         ↓            │
                                    │  Fragment Shader     │
                                    │  (PBR lighting)      │
                                    │         ↓            │
                                    │  Depth Test          │
                                    │  Blending            │
                                    └────────────────────┘
                                             ↓
                                    Framebuffer Output
```

**Course connection:** This maps directly to Lecture 06 (GPU pipeline). The vertex shader applies the MVP transform chain (M = model matrix, V = view matrix, P = projection matrix), which is the composition of transformations from Lectures 04–05.

---

## 2. MVP Transform Chain

For every vertex `v_local` in model space:

```
v_clip = P × V × M × v_local
```

Where:
- `M` = object's `matrixWorld` (accumulated from scene graph hierarchy)
- `V` = camera's `matrixWorldInverse`
- `P` = camera's `projectionMatrix` (perspective: FOV 60°, aspect, near 0.1, far 2000)

Three.js computes and uploads `modelViewMatrix = V × M` and `projectionMatrix = P` as GLSL uniforms automatically.

**For normal vectors** (Lecture 12 — shading transformations):
```
n_world = normalize(transpose(inverse(M)) × n_local)
```
Three.js provides `normalMatrix` (the 3×3 upper-left of transpose(inverse(M))) as a built-in uniform.

---

## 3. Shadow Pass

Executed **before** the main pass. The DirectionalLight's shadow camera (orthographic) renders the scene from the sun's point of view into a depth texture (shadow map).

**Configuration:**
- Shadow map size: 2048 × 2048
- Shadow type: PCFSoftShadowMap (Percentage Closer Filtering — softer edges)
- Shadow camera: OrthographicCamera with frustum tuned to ±120 units (matches park footprint)
- Bias: -0.001 (prevents shadow acne on flat surfaces)
- normalBias: 0.02 (shifts surface slightly along normal before shadow test)

**Course connection:** Lecture 16 (Shadows). PCF shadows are a common approximation of area-light soft shadows, discussed as a rasterisation-based alternative to ray-traced area lights.

**Implementation note:**
```
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(2048, 2048)
directionalLight.shadow.camera.left   = -120
directionalLight.shadow.camera.right  =  120
directionalLight.shadow.camera.top    =  120
directionalLight.shadow.camera.bottom = -120
directionalLight.shadow.camera.near   =  0.1
directionalLight.shadow.camera.far    =  300
directionalLight.shadow.bias          = -0.001
directionalLight.shadow.normalBias    =  0.02
```

---

## 4. Main Render Pass — PBR Shading

All opaque materials use `THREE.MeshStandardMaterial`, which implements the metalness/roughness PBR workflow.

**BRDF:** Cook-Torrance microfacet model (real-time approximation):
```
f_r = f_diffuse + f_specular

f_diffuse  = albedo / π × (1 − metalness)
f_specular = DFG / (4 × (n·l) × (n·v))

D = GGX distribution (roughness)
F = Schlick Fresnel approximation
G = Smith geometry term
```

**Texture inputs per material slot:**
| Slot | Texture | Notes |
|---|---|---|
| map | albedo (baseColor) | sRGB colour space |
| normalMap | tangent-space normal | Linear colour space |
| roughnessMap | perceptual roughness (R channel) | Linear |
| metalnessMap | metalness (B channel) | Linear |
| emissiveMap | self-emission colour | sRGB (only active at night) |
| aoMap | ambient occlusion | Linear, multiplied with ao |

**Course connection:** Lecture 11 (Shading) — Phong model to PBR progression. Lecture 13 (Rendering Equation) — MeshStandardMaterial implements a real-time approximation of L_o = L_e + ∫ f_r × L_i × cos(θ) dω.

---

## 5. Transparency Pass

Rendered after all opaque geometry. Uses Three.js `transparent: true, depthWrite: false`.

Objects using transparency:
- Food stall awning alpha-edge fringe (`alphaTest: 0.5`)
- Potential particle effects (if added in Phase 4)
- Night-sky fade overlay (opacity tween during day/night transition)

---

## 6. Render Order and Sorting

Three.js sorts render batches automatically:
1. Opaque objects, sorted front-to-back (minimises overdraw)
2. Transparent objects, sorted back-to-front (correct blending)

Custom `renderOrder` values used:
- Ground: `renderOrder = 0` (drawn first, always under everything)
- Paths: `renderOrder = 1` (drawn over ground, z-offset +0.01 in world space)
- Skybox: `renderOrder = -1` (drawn last via `depthTest: false` or inner-box trick)

---

## 7. Post-Processing (Phase 4)

To be added via `THREE.EffectComposer` (from Three.js addons):

### 7.1 FXAA Anti-Aliasing
Fast approximate anti-aliasing as a post-process pass. Replaces hardware MSAA for better compatibility with deferred-like setups.

### 7.2 Bloom (optional)
`UnrealBloomPass` applied to emissive surfaces (ride lights at night). Settings:
- strength: 0.4
- radius: 0.5  
- threshold: 0.8 (only very bright pixels bloom)

Full detail: [POST_PROCESSING.md](POST_PROCESSING.md)

---

## 8. Texture Sampling Strategy

**Mipmap generation:** Three.js generates mipmaps automatically for power-of-two textures. Non-POT textures use `ClampToEdgeWrapping` and no mipmaps — avoid non-POT if possible.

**Anisotropic filtering:**
```
const maxAniso = renderer.capabilities.getMaxAnisotropy()
texture.anisotropy = maxAniso  // typically 8 or 16
```
Applied to all ground and path textures to correct the blurring at oblique viewing angles.

**Course connection:** Lecture 17 (Sampling) — mipmaps solve the Nyquist aliasing problem for textures viewed at distance. Anisotropic filtering extends isotropic MIP selection to handle non-uniform foreshortening.

---

## 9. Renderer Configuration

```
renderer = new THREE.WebGLRenderer({
  antialias: true,          // MSAA 4× on initial pass
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: false  // not needed for this scale
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
```

**Tone mapping:** ACESFilmic provides cinematic contrast and natural highlight rolloff, suitable for the warm fairground aesthetic. The HDRI sky environment is HDR by nature; tone mapping converts it to LDR for display.

---

## 10. Performance Budget

| Stage | Target Time | Max Allowed |
|---|---|---|
| Shadow pass | 1.5ms | 3ms |
| Main opaque pass | 4ms | 8ms |
| Transparency pass | 0.5ms | 1ms |
| Post-processing | 1ms | 2ms |
| **Total GPU frame** | **7ms** | **14ms** |
| **CPU (JS + submit)** | **2ms** | **5ms** |
| **Total frame** | **9ms** | **16ms (= 60fps)** |
