# Material System — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Material Workflow

All materials use the **metalness/roughness PBR workflow** via `THREE.MeshStandardMaterial`. This maps directly to the Cook-Torrance BRDF discussed in the shading lectures and provides realistic response to the dynamic lighting system.

**Colour space rules:**
- `map` (albedo): `THREE.SRGBColorSpace`
- `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`: `THREE.LinearSRGBColorSpace`
- `emissiveMap`: `THREE.SRGBColorSpace`

All textures sourced from Poly Haven / ambientCG use the correct colour space in their filenames (look for `_srgb` vs `_linear` suffixes, or use the GL format exports which handle this automatically).

---

## 2. Material Catalogue

### MAT_GRASS
Application: Ground plane

```
MeshStandardMaterial:
  map:          grass_meadow_albedo_2k.jpg    repeat(40,40)
  normalMap:    grass_meadow_normal_2k.jpg    repeat(40,40)
  roughnessMap: grass_meadow_rough_2k.jpg     repeat(40,40)
  roughness:    1.0  (driven entirely by roughnessMap)
  metalness:    0.0  (grass is not metallic)
  normalScale:  Vector2(0.8, 0.8)            (subtle, not overdone)
  side:         FrontSide
```

**Source:** [Poly Haven — Grass Meadow](https://polyhaven.com/a/grass_meadow) or [Sparse Grass](https://polyhaven.com/a/sparse_grass)

---

### MAT_ASPHALT
Application: Park paths

```
MeshStandardMaterial:
  map:          asphalt_02_albedo_2k.jpg    repeat(8, 8)
  normalMap:    asphalt_02_normal_2k.jpg    repeat(8, 8)
  roughnessMap: asphalt_02_rough_2k.jpg     repeat(8, 8)
  roughness:    1.0
  metalness:    0.0
  normalScale:  Vector2(1.0, 1.0)
```

**Source:** [Poly Haven — Asphalt 02](https://polyhaven.com/a/asphalt_02)

---

### MAT_WOOD_PAINTED
Application: Carousel platform, gondola boxes, stall frames

```
MeshStandardMaterial:
  map:          wood_planks_painted_albedo_1k.jpg  repeat(2, 4)
  normalMap:    wood_planks_painted_normal_1k.jpg  repeat(2, 4)
  roughnessMap: wood_planks_painted_rough_1k.jpg   repeat(2, 4)
  roughness:    1.0
  metalness:    0.0
  normalScale:  Vector2(1.2, 1.2)
```

**Source:** [ambientCG — WoodPlanks (various)](https://ambientcg.com/list?q=wood)

---

### MAT_METAL_PAINTED
Application: Ferris wheel ring, Tagada arm structure, ride frames

```
MeshStandardMaterial:
  map:          metal_painted_albedo_1k.jpg  (bright red/blue/yellow)
  normalMap:    metal_painted_normal_1k.jpg  (rivets, weld seams)
  roughnessMap: metal_painted_rough_1k.jpg   (0.4–0.6 range)
  metalnessMap: metal_painted_metal_1k.jpg   (0.7–1.0 range)
  roughness:    1.0  (map-driven)
  metalness:    1.0  (map-driven)
```

**Source:** [ambientCG — MetalPaint](https://ambientcg.com/list?q=painted+metal)

**Colour variants:** Each ride gets a distinct hue applied via `map` colour tint:
- Ferris Wheel: white + gold accents
- Carousel: red/blue/gold
- Roller Coaster: dark blue + yellow
- Tagada: orange + grey

---

### MAT_METAL_STEEL
Application: Lamppost pole, structural supports

```
MeshStandardMaterial:
  map:          metal_plate_albedo_1k.jpg
  normalMap:    metal_plate_normal_1k.jpg   (bolt patterns, surface detail)
  roughnessMap: metal_plate_rough_1k.jpg    (0.3–0.5)
  metalnessMap: metal_plate_metal_1k.jpg    (~0.9)
  roughness:    1.0
  metalness:    1.0
```

**Source:** [ambientCG — MetalPlate](https://ambientcg.com/list?q=metal+plate)

---

### MAT_FENCE_WOOD
Application: Park perimeter fence

```
MeshStandardMaterial:
  map:          wood_fence_albedo_1k.jpg
  normalMap:    wood_fence_normal_1k.jpg
  roughnessMap: wood_fence_rough_1k.jpg
  roughness:    1.0
  metalness:    0.0
```

**Source:** [ambientCG — Wood (weathered)](https://ambientcg.com/list?q=wood+weathered)

---

### MAT_STALL_AWNING
Application: Food stall striped fabric canopy

```
MeshStandardMaterial:
  map:          stall_awning_stripes.jpg  (custom 512×512, procedural stripes)
  roughness:    0.9
  metalness:    0.0
  side:         DoubleSide
  alphaTest:    0.5                        (fringe edge cutout)
  transparent:  true
```

**Custom texture generation:** The striped awning texture can be generated procedurally via an offscreen canvas:
- Alternating stripes of red/white or blue/yellow
- 8 stripes at 45°
- Saved to ImageData and loaded as a DataTexture

---

### MAT_HORSE (Carousel horses)
Application: Carousel horse mesh

```
MeshStandardMaterial:
  map:          horse_painted_albedo_1k.jpg  (cream/white base)
  normalMap:    horse_sculpt_normal_1k.jpg   (muscle detail, if available)
  roughnessMap: horse_rough_1k.jpg           (shiny lacquer finish)
  roughness:    1.0
  metalness:    0.0
  normalScale:  Vector2(0.5, 0.5)
```

---

### MAT_EMISSIVE_BULB
Application: Ride decoration light bulbs, lamppost glass

```
MeshStandardMaterial:
  emissive:          0xFFDD88  (warm yellow)
  emissiveIntensity: 0.0       (OFF during day)
  →                  2.0       (ON at night, driven by shader/uniform)
  roughness:         0.1
  metalness:         0.0
```

At night, `emissiveIntensity` is animated via the emissive blink shader (see SHADER_PLAN.md).

---

### MAT_EMISSIVE_RIDE_LIGHT
Application: Coloured ride decoration lights (user-changeable colour)

```
MeshStandardMaterial:
  emissive:          STATE.rides[rideId].lightColor  (hex, user-set)
  emissiveIntensity: 0.0  (day) → 1.5 + sin(t×3) × 0.5 (night)
  roughness:         0.05
  metalness:         0.0
  transparent:       false
```

Colour updated at runtime via:
```
material.emissive.set(newColor)
```

---

### MAT_STAGE_FLOOR
Application: Central stage platform

```
MeshStandardMaterial:
  map:          wood_stage_albedo_1k.jpg
  normalMap:    wood_stage_normal_1k.jpg
  roughnessMap: wood_stage_rough_1k.jpg
  roughness:    1.0
  metalness:    0.0
```

---

### MAT_NIGHT_SKY
Application: Night skybox inner cube

```
MeshBasicMaterial:
  map:        night_sky_stars_2k.jpg  (equirectangular star map)
  side:       BackSide
  transparent: true
  opacity:    0.0 → 1.0  (tweened during day/night transition)
```

**Source:** [Poly Haven HDRIs — Night/Outdoor](https://polyhaven.com/hdris/night/outdoor) converted to cubemap, or use a pre-made star texture from [ambientCG](https://ambientcg.com).

---

## 3. Material Sharing and Instancing

Three.js shares material instances across multiple meshes automatically when the same object reference is used. To ensure this:

```
// Good: shared material
const woodMat = new THREE.MeshStandardMaterial({ ... })
fencePost_0.material = woodMat
fencePost_1.material = woodMat
// ↑ Both meshes share the same GPU program

// Bad: duplicate materials
fencePost_0.material = new THREE.MeshStandardMaterial({ ... })
fencePost_1.material = new THREE.MeshStandardMaterial({ ... })
// ↑ Two GPU state changes, twice the driver overhead
```

**Material catalogue singleton:** Create all materials once in `MaterialSystem.js` and export them as named constants. Never create materials inside loops or constructors.

---

## 4. LOD Material Strategy

For objects viewed at distance:
- Swap from `MeshStandardMaterial` (PBR) to `MeshLambertMaterial` (faster, no specular) when `distanceToCamera > 80`
- This is handled by `THREE.LOD` objects on food stalls and fence segments

---

## 5. Material Debug Checklist

- [ ] All albedo textures assigned to `map`, not `color`
- [ ] Normal maps are tangent-space (blue-dominant), not world-space
- [ ] `normalScale` not set too high (>2.0 looks broken)
- [ ] Roughness/metalness maps are in linear space
- [ ] Emissive materials have `emissiveIntensity = 0` during the day
- [ ] No materials use `.color = white` AND `.map` simultaneously without testing
- [ ] All `repeat` settings tested — no obvious tiling patterns visible
- [ ] Materials shared (not duplicated) across same-type meshes
- [ ] `outputColorSpace = SRGBColorSpace` set on renderer (required for correct PBR output)
