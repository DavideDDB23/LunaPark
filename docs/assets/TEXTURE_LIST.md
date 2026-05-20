# Texture List — Luna Park 3D

> Back to [README](../README.md)  
> See also: [Material System](../graphics/MATERIAL_SYSTEM.md) | [Asset Pipeline](ASSET_PIPELINE.md)

---

## Texture Conventions

| Convention | Value |
|---|---|
| Colour space — albedo/emissive | sRGB |
| Colour space — normal/rough/metal/ao | Linear |
| Minimum resolution | 512×512 |
| Maximum resolution (ground) | 2048×2048 |
| Format — opaque | JPG (quality 90) |
| Format — alpha | PNG |
| Wrapping | RepeatWrapping (tiling surfaces) or ClampToEdgeWrapping (unique objects) |
| Mipmap | generateMipmaps = true (all POT textures) |

---

## TEX_01 — Grass Meadow (Ground)

| Field | Value |
|---|---|
| Material | MAT_GRASS |
| Resolution | 2048×2048 |
| Maps | Albedo, Normal, Roughness |
| Repeat | 40×40 (covers 200m ground plane at ~1 tile/5m) |
| Anisotropy | Max |

**Download:**
- **[Poly Haven — Grass Meadow](https://polyhaven.com/a/grass_meadow)** — CC0, 2K JPG pack
- Alternative: **[Sparse Grass](https://polyhaven.com/a/sparse_grass)** — thinner grass, more varied look
- Alternative: **[Grass Path 3](https://polyhaven.com/a/grass_path_3)** — if a more worn/patchy look is preferred

**Files:**
```
grass_meadow_albedo_2k.jpg
grass_meadow_normal_2k.jpg
grass_meadow_roughness_2k.jpg
```

---

## TEX_02 — Asphalt (Paths)

| Field | Value |
|---|---|
| Material | MAT_ASPHALT |
| Resolution | 2048×2048 |
| Maps | Albedo, Normal, Roughness |
| Repeat | 8×8 per path segment |
| Anisotropy | Max |

**Download:**
- **[Poly Haven — Asphalt 02](https://polyhaven.com/a/asphalt_02)** — CC0, weathered grey asphalt with cracks
- Browse full asphalt collection: **[Poly Haven — Asphalt textures](https://polyhaven.com/textures/asphalt)**
- Alternative (cobblestone look): **[Poly Haven — Road textures](https://polyhaven.com/textures/road)**

**Files:**
```
asphalt_02_albedo_2k.jpg
asphalt_02_normal_2k.jpg
asphalt_02_roughness_2k.jpg
```

---

## TEX_03 — Painted Wood (Ride Structures / Stall Frames)

| Field | Value |
|---|---|
| Material | MAT_WOOD_PAINTED |
| Resolution | 1024×1024 |
| Maps | Albedo, Normal, Roughness |
| Repeat | 2×4 on most surfaces |
| Wrapping | RepeatWrapping |

**Download:**
- **[ambientCG — Wood (search)](https://ambientcg.com/list?q=wood)** — CC0, multiple variants
- Recommended: search for "WoodPlanksWorn" or "WoodPlanks" for painted/worn plank look
- **[Poly Haven — Wood textures](https://polyhaven.com/textures/wood)** — CC0

**Files:**
```
wood_painted_albedo_1k.jpg
wood_painted_normal_1k.jpg
wood_painted_roughness_1k.jpg
```

---

## TEX_04 — Painted Metal (Ride Frames)

| Field | Value |
|---|---|
| Material | MAT_METAL_PAINTED |
| Resolution | 1024×1024 |
| Maps | Albedo, Normal, Roughness, Metalness |
| Wrapping | RepeatWrapping or ClampToEdge |

**Download:**
- **[ambientCG — Metal Painted](https://ambientcg.com/list?q=painted+metal)** — CC0
- Look for "MetalPaint" or "MetalPainted" variants with scratch/wear detail
- Alternative: **[ambientCG — Steel/Iron](https://ambientcg.com/list?q=steel)** for structural parts

**Files:**
```
metal_painted_albedo_1k.jpg
metal_painted_normal_1k.jpg
metal_painted_roughness_1k.jpg
metal_painted_metalness_1k.jpg
```

**Colour note:** Import a neutral grey/white base texture. Apply `material.color` (or `material.map` colour tint) to add the red/blue/yellow ride colours per ride.

---

## TEX_05 — Steel Plate (Lamppost, Structural)

| Field | Value |
|---|---|
| Material | MAT_METAL_STEEL |
| Resolution | 512×512 |
| Maps | Albedo, Normal, Roughness, Metalness |

**Download:**
- **[ambientCG — MetalPlate](https://ambientcg.com/list?q=metal+plate)** — CC0
- Good options: "MetalPlate007" or "Metal007" (riveted/bolted steel)

**Files:**
```
metal_plate_albedo_512.jpg
metal_plate_normal_512.jpg
metal_plate_roughness_512.jpg
metal_plate_metalness_512.jpg
```

---

## TEX_06 — Wooden Fence

| Field | Value |
|---|---|
| Material | MAT_FENCE_WOOD |
| Resolution | 512×512 |
| Maps | Albedo, Normal |

**Download:**
- **[ambientCG — Wood Weathered](https://ambientcg.com/list?q=wood+weathered)** — CC0
- Or derive from TEX_03 at half resolution — acceptable for small fence geometry

---

## TEX_07 — Stall Awning Stripes (Custom / Procedural)

| Field | Value |
|---|---|
| Material | MAT_STALL_AWNING |
| Resolution | 512×512 |
| Maps | Albedo (+ optional Alpha for fringe) |
| Generation | Procedural via Canvas 2D API at startup |

**Generation algorithm:**
```
Canvas 2D context (512×512):
  - Fill background: white
  - Draw 8 angled stripes at 45°, alternating red (#E53935) / white
  - Stripe width: 64px
  - Optional: add fringe at bottom edge (small triangles or scallops)
  - Create DataTexture from ImageData
```

No external download needed. Generate once at startup.

---

## TEX_08 — Day Sky (HDRI → Environment)

| Field | Value |
|---|---|
| Application | scene.background + scene.environment |
| Format | EXR (Equirectangular HDRI) |
| Resolution | 2048 (HDRI) → 512 cubemap (PMREMGenerator) |

**Download:**
- **[Poly Haven HDRIs — Outdoor](https://polyhaven.com/hdris/outdoor)** — CC0
- **[Poly Haven HDRIs — Skies](https://polyhaven.com/hdris/skies)** — CC0
- Recommended: "Kloppenheim" or "Blue Lagoon" or "Dikhololo Night" depending on desired mood
- **[Poly Haven — Sunrise/Sunset HDRIs](https://polyhaven.com/hdris/sunrise-sunset)** for golden hour atmosphere

**Three.js loading:**
```
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
exrLoader.load('sky_day_2k.exr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  const pmremGen = new THREE.PMREMGenerator(renderer)
  const envMap = pmremGen.fromEquirectangular(texture).texture
  scene.background   = envMap
  scene.environment  = envMap  // PBR IBL reflections
  pmremGen.dispose()
})
```

**Files:**
```
sky_day_2k.exr
```

---

## TEX_09 — Night Sky (Starfield)

| Field | Value |
|---|---|
| Application | Night skybox BoxGeometry inner faces |
| Format | JPG |
| Resolution | 1024×1024 |

**Download:**
- **[Poly Haven HDRIs — Night Outdoor](https://polyhaven.com/hdris/night/outdoor)** — CC0
- Convert to equirectangular, then apply to BoxGeometry with `side: BackSide`
- Alternative: find a pre-made star texture on freepbr.com or ambientcg.com

**Files:**
```
night_sky_stars_1k.jpg
```

---

## TEX_10 — Emissive Bulb

| Field | Value |
|---|---|
| Application | MAT_EMISSIVE_BULB on ride light meshes |
| Resolution | Not needed (solid colour only) |
| Generation | No texture — use `emissive: 0xFFDD88` colour directly |

No texture download needed. `MeshStandardMaterial.emissive` is a colour value, not requiring a texture for uniform emission.

---

## Texture Summary Table

| ID | Name | Resolution | Source | Download URL |
|---|---|---|---|---|
| TEX_01 | Grass Meadow | 2K | Poly Haven | [polyhaven.com/a/grass_meadow](https://polyhaven.com/a/grass_meadow) |
| TEX_02 | Asphalt 02 | 2K | Poly Haven | [polyhaven.com/a/asphalt_02](https://polyhaven.com/a/asphalt_02) |
| TEX_03 | Wood Painted | 1K | ambientCG | [ambientcg.com/list?q=wood](https://ambientcg.com/list?q=wood) |
| TEX_04 | Metal Painted | 1K | ambientCG | [ambientcg.com/list?q=painted+metal](https://ambientcg.com/list?q=painted+metal) |
| TEX_05 | Metal Plate | 512 | ambientCG | [ambientcg.com/list?q=metal+plate](https://ambientcg.com/list?q=metal+plate) |
| TEX_06 | Wood Fence | 512 | ambientCG | Derived from TEX_03 |
| TEX_07 | Stall Awning | 512 | Procedural | Generated at startup |
| TEX_08 | Day Sky HDRI | 2K EXR | Poly Haven | [polyhaven.com/hdris/skies](https://polyhaven.com/hdris/skies) |
| TEX_09 | Night Sky | 1K | Poly Haven | [polyhaven.com/hdris/night/outdoor](https://polyhaven.com/hdris/night/outdoor) |
| TEX_10 | Emissive Bulb | N/A | Solid colour | — |
