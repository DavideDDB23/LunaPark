# Asset Pipeline — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Asset Categories

| Category | Format | Source | Count |
|---|---|---|---|
| 3D Models | GLB (GLTF 2.0 binary) | Sketchfab CC / procedural | ~6 models |
| Textures — Albedo | JPG 1K–2K | Poly Haven / ambientCG CC0 | ~12 sets |
| Textures — Normal | JPG 1K–2K | Same as albedo | ~10 maps |
| Textures — Roughness | JPG 512–1K | Same as albedo | ~10 maps |
| Textures — Emissive | PNG / JPG 512 | Custom / ambientCG | ~3 |
| HDRIs (sky) | EXR/HDR 2K | Poly Haven CC0 | 2 |
| Audio (optional) | MP3 / OGG | freesound.org CC0 | 3–5 |

---

## 2. Acquisition Protocol

### Step 1 — Download

For Poly Haven:
1. Go to `polyhaven.com/textures` or `polyhaven.com/hdris`
2. Search for the asset
3. Download at **2K** resolution for primary surfaces, **1K** for secondary
4. Export format: JPG (for opaque textures), PNG (for alpha textures), EXR (for HDRIs)

For ambientCG:
1. Go to `ambientcg.com`
2. Search by category
3. Download **2K** JPG pack (includes Albedo, Normal, Roughness, Metal in one zip)

For Sketchfab:
1. Search for model
2. Filter: **Free download** + **CC** license
3. Download as **GLB** (preferred) or **GLTF** + textures folder
4. In the download dialog, select "Original format" or "glTF"

---

### Step 2 — Validation

Before adding any model to the project:

```
Model validation checklist:
  [ ] Confirm no embedded animations in GLB
      → Tool: gltf.report (drag & drop GLB, check Animations tab)
      → If animations found: remove them in Blender (remove all actions)
  [ ] Polygon count < budget (see MODEL_LIST.md)
  [ ] Scale is reasonable (not 0.001 or 1000 — will need adjustment)
  [ ] UV maps present (check in gltf.report or Blender)
  [ ] No broken texture references
  [ ] License confirmed (CC, CC0, or CC-BY) — note attribution if required

Texture validation checklist:
  [ ] Colour space correct (albedo = sRGB; normal/rough = Linear)
  [ ] File size < 2MB per texture
  [ ] Power-of-two dimensions (512, 1024, 2048) — required for mipmaps
  [ ] No obvious compression artefacts on normal maps
```

---

### Step 3 — Processing

**Models:**

If the GLB contains embedded animations:
```
Blender processing:
  1. Import GLB
  2. Object → Animation → NLA Editor → delete all strips
  3. Object Data → Shape Keys → delete if any
  4. Export → GLB → ✓ Geometry only, ✗ Animation
```

If the model scale is wrong:
```
  1. Select mesh in Object mode
  2. Scale to correct size (1 unit = 1 metre)
  3. Object → Apply → Scale (Ctrl+A → Scale)
  4. Re-export GLB
```

**Textures:**

If HDRI needs to be converted to a Three.js-compatible environment map:
```
Three.js processing:
  1. Load EXR with EXRLoader
  2. Pass through PMREMGenerator.fromEquirectangular()
  3. Result = envMap for scene.background and scene.environment
```

If albedo texture is too large (>2K):
```
  1. Open in Krita / GIMP / Squoosh
  2. Resize to 2048×2048
  3. Export JPG quality 90
```

---

### Step 4 — Integration

Place assets in the correct directories:
```
assets/
  models/
    lamppost_lowpoly.glb
    food_stall_carnival.glb
    ...
  textures/
    environment/
      grass_meadow_albedo_2k.jpg
      grass_meadow_normal_2k.jpg
      grass_meadow_roughness_2k.jpg
      asphalt_02_albedo_2k.jpg
      ...
    rides/
      metal_painted_albedo_1k.jpg
      wood_planks_albedo_1k.jpg
      ...
    sky/
      sky_day_2k.exr
      night_sky_stars_1k.jpg
```

---

## 3. Loading Strategy

All assets load at startup via `AssetLoader.loadAll()`. The render loop starts only after all assets are loaded:

```
async function init():
  showLoadingScreen()
  await assetLoader.loadAll()
  buildScene()
  hideLoadingScreen()
  animate()
```

**Asset manifest** (loaded from `asset-manifest.json`):
```json
{
  "models": [
    { "name": "lamppost", "path": "assets/models/lamppost_lowpoly.glb" },
    { "name": "foodStall", "path": "assets/models/food_stall_carnival.glb" }
  ],
  "textures": [
    { "name": "grassAlbedo", "path": "assets/textures/environment/grass_meadow_albedo_2k.jpg",
      "colorSpace": "srgb", "repeat": [40, 40] },
    { "name": "grassNormal", "path": "assets/textures/environment/grass_meadow_normal_2k.jpg",
      "colorSpace": "linear", "repeat": [40, 40] }
  ],
  "hdris": [
    { "name": "skyDay", "path": "assets/textures/sky/sky_day_2k.exr" }
  ]
}
```

---

## 4. Attribution Log

All assets that require attribution under CC-BY must be documented here:

| Asset | Source | Author | License | URL |
|---|---|---|---|---|
| _(fill in as assets are downloaded)_ | | | | |

Poly Haven and ambientCG assets are CC0 — no attribution required, but good practice to list them anyway for the project report.

---

## 5. VRAM Budget

Estimated GPU memory for all textures:

| Texture | Format | Size | VRAM |
|---|---|---|---|
| Grass albedo 2K | JPG | 2048² × 3 bytes | 12 MB (with mipmaps × 1.33) |
| Grass normal 2K | JPG | 2048² × 3 bytes | 12 MB |
| Asphalt albedo 2K | JPG | 2048² × 3 bytes | 12 MB |
| ... (other surfaces, ~8 sets) | JPG | 1024² × 3 bytes | 4 MB each ≈ 32 MB |
| Sky HDRI (cube, 6 faces) | EXR | 512² × 6 × 16 | ~25 MB |
| Night sky 1K | JPG | 1024² × 3 | 4 MB |
| **Estimated total** | | | **~100–120 MB** |

Modern integrated GPUs have 1–2GB shared VRAM. 120MB is well within budget.
