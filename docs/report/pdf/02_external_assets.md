## Section 3 — External Assets

This section provides a complete, attributed listing of every external asset incorporated into the project that was not created by the author. All assets are available under open licences (primarily Creative Commons Zero / CC0 or MIT), ensuring the project is fully distributable.

### 3.1 Asset Pipeline Overview

All 3D models are distributed in the **GLB** format (binary GLTF 2.0), which bundles geometry, materials, textures, and — where present — animation data into a single self-contained file. The project uses a custom `loadGLB()` wrapper around Three.js's `GLTFLoader` that immediately discards all embedded animation data (`gltf.animations = []`) before returning the scene graph. This enforces the project policy that *every motion in the scene is hand-written JavaScript math* — no imported animation clip is ever played back through an `AnimationMixer`.

PBR texture sets follow the **ambientCG / Poly Haven convention**: separate image files for the albedo (colour) map, tangent-space normal map, roughness map, and (where available) metalness and ambient-occlusion maps. They are loaded with Three.js's `TextureLoader`, configured with `anisotropy = renderer.capabilities.getMaxAnisotropy()` (typically 16×), and supplied to `MeshStandardMaterial` via the corresponding material properties.

HDR sky environments are distributed in the **RGBE `.hdr`** format and loaded by Three.js's `RGBELoader`. Each HDR is then processed by `PMREMGenerator` to produce a pre-filtered, mip-mapped radiance environment map (PMREM) that drives image-based lighting (IBL) across all PBR materials in the scene.

### 3.2 Three-Dimensional Models

#### 3.2.1 Rides

| Model | File | Source | Licence |
|---|---|---|---|
| Ferris Wheel | `assets/models/rides/ferris_wheel.glb` | Quaternius free pack / Sketchfab | CC0 |
| Carousel Horse | `assets/models/rides/carousel_horse.glb` | Quaternius creature pack | CC0 |
| Roller Coaster Track | `assets/models/rides/coaster_track.glb` | "Animated roller coaster" by assetfactory, Sketchfab | CC0 |
| Wacky Worm (Train) | `assets/models/rides/wacky_worm_coaster.glb` | Poly Pizza | CC0 |

**Ferris Wheel** (`ferris_wheel.glb`): The model ships with one baked keyframe animation track that is stripped on load. The project uses only the GLB geometry — the rotating ring (`wheel` node), the gondola meshes (`cabin` children), and the static A-frame support (`mount` node) — to construct the procedural counter-rotation described in Section 4.2.

**Carousel Horse** (`carousel_horse.glb`): A single GLB representing one horse figure, cloned eight times to populate the carousel platform. An embedded pole mesh is hidden programmatically, replaced by procedural `CylinderGeometry` poles so that pole height can be tuned independently of the model scale.

**Roller Coaster Track** (`coaster_track.glb`): The GLB geometry encodes the rail as a swept-circle tube mesh (`Circle.023_build_gen_1_0`, 24 vertices per ring × 395 rings). The track's centre-line is recovered algorithmically from this geometry (see Section 4.4) rather than read from any embedded data. The six cart meshes included in the GLB are used as cloning templates for the animated carriages.

**Wacky Worm / Train** (`wacky_worm_coaster.glb`): A single GLB containing a locomotive and three wagons. Loaded at scale 0.013; a `Box3` bounding-box auto-calibration step determines the correct vertical offset so the wheels sit flush on the track surface.

#### 3.2.2 Buildings and Structures

| Model | File | Source | Licence |
|---|---|---|---|
| Carnival Shooting Booth | `assets/models/buildings/stylized_carnival_booth.glb` | Sketchfab | CC0 |
| Food Stall props | Embedded in the environment pack | Quaternius | CC0 |

#### 3.2.3 Human Characters (Visitors and Riders)

All human figures come from the **Quaternius "Ultimate Animated Character Pack"** (CC0, https://quaternius.com). The pack supplies a set of rigged, skinned GLB humanoids in various outfits (casual, sports, kimono, etc.). The project:

1. Loads up to 14 distinct character GLBs as templates at startup.
2. Strips all embedded animation data from each template.
3. Clones each template on demand to produce individual NPC visitors and ride passengers.
4. Drives all bone transformations procedurally through JavaScript (see Sections 4.12–4.13).

The kimono variant is excluded from the carousel and Tagada passenger pools because its single-piece skirt geometry does not support the leg-spread pose required for seated riders.

#### 3.2.4 Props and Interactables

| Model | File | Source | Licence |
|---|---|---|---|
| 9 mm Pistol | `assets/models/9mm_pistol_low_poly_gun.glb` | Sketchfab | CC0 |
| 9 mm Bullet | `assets/models/9mm_bullet_low_poly.glb` | Sketchfab | CC0 |
| Carnival prizes | `assets/models/prizes/` (multiple GLBs) | Poly Pizza | CC0 |
| Environment props (trees, bushes, rocks, benches, etc.) | `assets/models/environment/` | Quaternius environment pack | CC0 |

### 3.3 PBR Texture Sets

All PBR texture sets are sourced from **ambientCG** (https://ambientcg.com), a repository of CC0-licensed physically based rendering materials. Each set consists of separate image files loaded as `sRGB` (colour) or `LINEAR` (non-colour data) textures:

| Surface | Local Path | ambientCG Asset | Maps Included |
|---|---|---|---|
| Grass | `assets/textures/grass/` | GrassField001 | color.jpg, normal.jpg, roughness.jpg, ao.jpg |
| Asphalt / Paths | `assets/textures/asphalt/` | Asphalt026 | color.jpg, normal.jpg, roughness.jpg |
| Wood (Carousel) | `assets/textures/wood/` | WoodFloor050 | color.jpg, normal.jpg, roughness.jpg |

Colour maps are loaded with `THREE.SRGBColorSpace`; normal and roughness maps are loaded as linear data (`THREE.LinearSRGBColorSpace`) to avoid the double-gamma correction that would distort normals and roughness values if they were mistakenly treated as sRGB.

All texture maps are configured with `texture.wrapS = texture.wrapT = THREE.RepeatWrapping` and a per-material repeat factor (e.g., `[8, 8]` for the grass ground) to tile them across large surfaces without visible seaming.

### 3.4 HDR Sky Environments

Four RGBE equirectangular HDR maps from **Poly Haven** (https://polyhaven.com, CC0) are used as sky backgrounds and IBL environment sources:

| Preset | File | Poly Haven Asset |
|---|---|---|
| Day | `assets/hdr/day.hdr` | Kloofendal 48d Partly Cloudy (or equivalent outdoor day HDRI) |
| Sunrise | `assets/hdr/sunrise.hdr` | Sunrise / golden hour HDRI |
| Sunset | `assets/hdr/sunset.hdr` | Sunset / warm evening HDRI |
| Night | `assets/hdr/night.hdr` | Night sky HDRI |

Each HDR is loaded once and shared between the sky sphere shader (which samples two HDRs simultaneously for the crossfade) and the PMREM generator (which bakes it into a mip-mapped environment map for IBL). The PMREM baking is performed once at startup and cached; the bake is not repeated at runtime because crossfading two PMREM maps in real time is prohibitively expensive in Three.js.

### 3.5 JavaScript Libraries

The JavaScript libraries are credited here for completeness; they are described in detail in Section 2.

| Library | Version | Licence | URL |
|---|---|---|---|
| Three.js | r170 | MIT | https://threejs.org |
| tween.js | 23.1.3 | MIT | https://github.com/tweenjs/tween.js |

### 3.6 Licence Compliance Summary

| Asset Category | Licence | Commercial Use | Attribution Required |
|---|---|---|---|
| Quaternius models (rides, people, props, environment) | CC0 | Yes | No |
| Poly Pizza models | CC0 | Yes | No |
| Sketchfab models (booth, pistol, bullet) | CC0 | Yes | No |
| ambientCG textures | CC0 | Yes | No |
| Poly Haven HDRIs | CC0 | Yes | No |
| Three.js | MIT | Yes | Yes (in source headers) |
| tween.js | MIT | Yes | Yes (in source headers) |

All assets used in this project are distributed under terms that permit free use, modification, and redistribution, with no royalty obligations. MIT-licenced libraries require the licence notice to be retained in the source distribution, which is satisfied by the `node_modules` and `package.json` mechanism or the CDN import map as applicable.
