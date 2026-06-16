# Phase 1 — Environment (0 → 1)

> Back to [README](../README.md)  
> This is the **current active phase**.

---

## Goal

Build a complete, beautiful, demoable park environment with no rides.  
When Phase 1 is done, you should be able to open the scene and say  
*"This already looks like a real project."*

---

## Deliverables

- Grass ground plane (200×200) with PBR texture
- Four asphalt paths (cross layout) + central circle
- Skybox (daytime HDRI)
- HemisphereLight + DirectionalLight (static)
- PCF shadow maps on ground
- Park perimeter fence
- 12 decorative lampposts (geometry + PointLight nodes)
- 6 food stalls (GLB models)
- Central stage platform + SpotLight
- No console errors
- 60fps on test machine

---

## Step-by-Step Implementation Guide

### Step 1 — Project Skeleton (~2 hours)

**Goal:** `index.html` opens without errors, black canvas renders.

Implementation tasks (in order):

1. Create `index.html`:
   - `<canvas id="c">` filling 100vw × 100vh
   - Import map pointing to `libs/three.module.js` and `libs/tween.esm.js`
   - `<script type="module" src="js/main.js">`

2. Vendor libraries into `libs/`:
   - Three.js: download from [threejs.org](https://threejs.org/build/three.module.js) — or use importmap with CDN for development
   - tween.js: download from [unpkg.com/tween.js/dist/tween.esm.js](https://unpkg.com/@tweenjs/tween.js/dist/tween.esm.js)
   - Addons: copy `three/addons/` folder for OrbitControls, GLTFLoader, EXRLoader, EffectComposer

3. Create `js/main.js`:
   - `WebGLRenderer` (antialias: true, setPixelRatio, setSize)
   - `PerspectiveCamera(60, aspect, 0.1, 2000)`
   - `Scene()`
   - `Clock()`
   - `OrbitControls(camera, renderer.domElement)`
   - Empty `animate()` loop calling `renderer.render(scene, camera)`
   - Window resize handler
   - Append renderer canvas to `document.body`

4. Verify: blank grey canvas renders, no console errors.

---

### Step 2 — Ground Plane (~1 hour)

**Required assets:** TEX_01 (grass_meadow_albedo_2k.jpg, grass_meadow_normal_2k.jpg, grass_meadow_roughness_2k.jpg)  
**Download from:** [polyhaven.com/a/grass_meadow](https://polyhaven.com/a/grass_meadow)

Implementation (in `js/environment/Ground.js`):

```
GROUND SPECIFICATION:
  geometry: PlaneGeometry(200, 200, 1, 1)
  rotation.x = -Math.PI / 2
  position.y = 0
  receiveShadow = true
  
  material: MeshStandardMaterial
    map:          TextureLoader → grass_meadow_albedo_2k.jpg
    normalMap:    TextureLoader → grass_meadow_normal_2k.jpg
    roughnessMap: TextureLoader → grass_meadow_roughness_2k.jpg
    
    For each texture:
      colorSpace:  albedo = SRGBColorSpace; normal/rough = LinearSRGBColorSpace
      wrapS = wrapT = RepeatWrapping
      repeat.set(40, 40)
      anisotropy = renderer.capabilities.getMaxAnisotropy()
    
    roughness:   1.0 (fully driven by map)
    metalness:   0.0
```

**Visual check:** From a camera height of 60 units, the grass texture should be visible, slightly blurry at distance but sharp underfoot. Normal map should show slight surface bumpiness when light angle is low.

---

### Step 3 — Path Network (~1 hour)

**Required assets:** TEX_02 (asphalt_02_albedo_2k.jpg, asphalt_02_normal_2k.jpg, asphalt_02_roughness_2k.jpg)  
**Download from:** [polyhaven.com/a/asphalt_02](https://polyhaven.com/a/asphalt_02)

Implementation (in `js/environment/Paths.js`):

```
PATH LAYOUT (all planes, rotation.x = -PI/2, y = 0.01):

  path_NS:    PlaneGeometry(6, 200)  position(0, 0.01, 0)
  path_EW:    PlaneGeometry(200, 6)  position(0, 0.01, 0)
  path_centre: CircleGeometry(10, 32) position(0, 0.01, 0)

  Note: y = 0.01 lifts paths 1cm above ground — prevents z-fighting

  material: MeshStandardMaterial
    map:          asphalt_02_albedo_2k.jpg  repeat(8, 16)  (adjust per path)
    normalMap:    asphalt_02_normal_2k.jpg  same repeat
    roughnessMap: asphalt_02_roughness_2k.jpg same repeat
    anisotropy: max
    receiveShadow = true
```

**Visual check:** Dark grey paths clearly visible against grass. No z-fighting at path/grass boundary.

---

### Step 4 — Skybox (~1.5 hours)

**Required assets:** TEX_08 (sky_day_2k.exr)  
**Download from:** [polyhaven.com/hdris/skies](https://polyhaven.com/hdris/skies) — pick an outdoor blue sky HDRI

Implementation (in `js/environment/Sky.js`):

```
SKYBOX SETUP:

  import EXRLoader from 'three/addons/loaders/EXRLoader.js'
  
  Load EXR file:
    texture.mapping = THREE.EquirectangularReflectionMapping
  
  Convert with PMREMGenerator:
    pmremGen = new PMREMGenerator(renderer)
    pmremGen.compileEquirectangularShader()
    envMap = pmremGen.fromEquirectangular(exrTexture).texture
  
  Assign:
    scene.background  = envMap
    scene.environment = envMap   ← enables PBR Image-Based Lighting
  
  Cleanup:
    exrTexture.dispose()
    pmremGen.dispose()
  
  Night skybox (prepare but hide):
    nightBox = Mesh(BoxGeometry(1800, 1800, 1800), MeshBasicMaterial({
      map: TextureLoader → night_sky_stars_1k.jpg,
      side: BackSide,
      transparent: true,
      opacity: 0   ← hidden during day
    }))
    scene.add(nightBox)
```

**Visual check:** Sky visible from all camera angles. No seams. Environment reflections visible on metallic test sphere.

---

### Step 5 — Lighting (Static) (~1 hour)

Implementation (in `js/lighting/LightManager.js`):

```
HEMISPHERE LIGHT:
  HemisphereLight(0x87CEEB, 0x8B7355, 0.8)
  position: (0, 100, 0)  [position not critical for hemisphere]

DIRECTIONAL LIGHT (sun):
  DirectionalLight(0xFFFAE0, 2.5)
  position: (50, 80, 30)  ← late afternoon position
  castShadow: true
  
  shadow.mapSize: (2048, 2048)
  shadow.camera:
    left = -120, right = 120
    top = 120, bottom = -120
    near = 0.1, far = 300
  shadow.bias:       -0.001
  shadow.normalBias:  0.02
  shadow.type:  PCFSoftShadowMap  (set on renderer)
  
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

RENDERER CONFIG:
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
```

**Visual check:** Clear shadows on ground from fence/stalls once they exist. No shadow acne or floating objects.

---

### Step 6 — Fence (~1.5 hours)

**Assets:** TEX_06 (wood fence texture) OR procedural geometry

**Recommended approach: Procedural + merged geometry**

```
FENCE SEGMENT (procedure, 4m wide × 1.2m tall):
  post_L:   BoxGeometry(0.1, 1.2, 0.1)  position(-1.95, 0.6, 0)
  post_R:   BoxGeometry(0.1, 1.2, 0.1)  position(+1.95, 0.6, 0)
  rail_top: BoxGeometry(4.0, 0.1, 0.05) position(0, 1.1, 0)
  rail_mid: BoxGeometry(4.0, 0.1, 0.05) position(0, 0.6, 0)
  
  Merge all into one BufferGeometry (one draw call per segment)

PLACEMENT:
  North edge (z = -95): segments at x = -94, -90, ..., +94  (48 segments)
  South edge (z = +95): same
  East  edge (x = +95): segments at z = -94, ..., +94
  West  edge (x = -95): same
  
  Corner pieces: slightly larger post

MATERIAL:
  MeshStandardMaterial:
    map: TextureLoader → wood_fence texture (repeat 1, 1)
    normalMap: same set
    roughness: 0.9, metalness: 0.0
    castShadow: true, receiveShadow: true

MERGE OPTIMISATION:
  Collect all fence segment geometries (positioned + merged with world matrix)
  BufferGeometryUtils.mergeGeometries([...allFenceGeos])
  Single Mesh(mergedGeo, fenceMat) → 1 draw call for entire fence
```

---

### Step 7 — Lampposts (~2 hours)

**Required model:** MODEL_01 (lamppost_lowpoly.glb)  
**Download from:** [Sketchfab — Low Poly Garden Lamp](https://sketchfab.com/3d-models/low-poly-garden-lamp-stylized-outdoor-light-6c945121ca0c41bf988b6e4f5769b414)

```
LAMPPOST STRUCTURE (per instance):
  lampRoot: THREE.Group
    └── lampMesh: imported GLB (clone of base geometry)
          castShadow = true
          receiveShadow = true
          // Replace GLB material with MAT_METAL_STEEL
    └── pointLight: PointLight(0xFFDD88, 0, 15, 2)
          intensity = 0  ← OFF by default (day)
          position: relative to lamp head in GLB

  lampRoot.userData.lampId = 'lamp_N'
  lampRoot.userData.on     = false
  lampMesh.userData.lampRef = lampRoot  ← for raycasting

PLACEMENT (12 lampposts):
  North arm (z < 0, offset x = ±4):
    lamp_0: (-4, 0, -25),  lamp_1: (-4, 0, -50),  lamp_2: (-4, 0, -75)
  South arm (z > 0, offset x = ±4):
    lamp_3: (+4, 0, +25),  lamp_4: (+4, 0, +50),  lamp_5: (+4, 0, +75)
  East arm (x > 0, offset z = ±4):
    lamp_6: (+25, 0, -4),  lamp_7: (+50, 0, -4),  lamp_8: (+75, 0, -4)
  West arm (x < 0, offset z = ±4):
    lamp_9: (-25, 0, +4),  lamp_10: (-50, 0, +4), lamp_11: (-75, 0, +4)

LAYER ASSIGNMENT:
  lampMesh.layers.enable(LAMPPOST_LAYER)  ← only lampposts on this layer
  raycaster.layers.set(LAMPPOST_LAYER)    ← when testing lamp clicks
```

---

### Step 8 — Food Stalls (~1.5 hours)

**Required model:** MODEL_02 (food_stall_carnival.glb)  
**Download from:** [Sketchfab — Stylized Carnival Booth](https://sketchfab.com/3d-models/stylized-carnival-booth-d8b4a661d433494184403c621818a424)

```
STALL PLACEMENT (6 stalls):
  stall_NE:  (+12, 0, -12)   rotation.y = Math.PI * 0.25
  stall_NW:  (-12, 0, -12)   rotation.y = -Math.PI * 0.25
  stall_SE:  (+12, 0, +12)   rotation.y = Math.PI * 0.75
  stall_SW:  (-12, 0, +12)   rotation.y = Math.PI * 1.25
  stall_far_N: (0, 0, -60)   rotation.y = 0
  stall_far_S: (0, 0, +60)   rotation.y = Math.PI

MATERIAL OVERRIDE:
  After GLB load, traverse all meshes and replace materials:
    mesh.material = (isAwning ? MAT_STALL_AWNING : MAT_WOOD_PAINTED)
  (This ensures PBR materials and removes any embedded non-PBR from GLB)

SHADOWS:
  traverse(mesh => mesh.castShadow = mesh.receiveShadow = true)
```

---

### Step 9 — Central Stage (~0.5 hours)

```
STAGE:
  platformMesh: CylinderGeometry(8, 8, 0.5, 32)
    position: (0, 0.25, -80)
    material: MAT_WOOD_PAINTED (or concrete variant)
    receiveShadow = true, castShadow = true
  
  backdropMesh: PlaneGeometry(18, 8)
    position: (0, 4, -81)
    material: MeshStandardMaterial({ color: 0xCC2211, roughness: 0.8 })
  
  stageLetter: Text geometry or sprite "🎭" (optional)
  
  stageSpotLight: SpotLight(0xFFFFFF, 0, 50, Math.PI/8, 0.2, 1)
    position: (0, 20, -75)
    target.position: (0, 0, -80)
    castShadow: true
    shadow.mapSize: (1024, 1024)
    intensity: 0  ← OFF during day
```

---

### Step 10 — Phase 1 QA

Before tagging `v0.1-env-complete`:

```
VISUAL CHECKS:
  □ Ground grass visible, normal map adds texture depth
  □ Paths visible, clearly different from grass
  □ No z-fighting between path and ground
  □ Skybox fills the background with no seams
  □ Fence visible on all 4 sides
  □ 12 lampposts in correct positions along paths
  □ 6 food stalls distributed at junctions
  □ Stage visible at far north end of scene
  □ Shadows on ground from all objects

PERFORMANCE CHECKS:
  □ Chrome DevTools → Performance → record 5s → max frame time < 8ms
  □ renderer.info.render.calls < 60
  □ renderer.info.render.triangles < 200,000 (environment only)
  □ No memory leaks (dispose() called on all loaded textures and geometries)

CORRECTNESS CHECKS:
  □ No console errors or warnings
  □ All textures loaded (no 404 in Network tab)
  □ Shadow camera frustum correct (test: move camera to see full scene)
  □ Renderer outputColorSpace = SRGBColorSpace
  □ anisotropy applied to ground/path textures

GIT:
  □ Commit all files: feat(phase1): complete environment build
  □ Tag: v0.1-env-complete
  □ Push to main
```

---

## Next: Phase 2

After Phase 1 is verified, proceed to [PHASE2_RIDES.md](PHASE2_RIDES.md) to add all four hierarchical rides.
