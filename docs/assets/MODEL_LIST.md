# Model List — Luna Park 3D

> Back to [README](../README.md)  
> See also: [Asset Pipeline](ASSET_PIPELINE.md)

---

## Rules

1. **No imported animations.** Every GLB used must have animations stripped before import. Verify with gltf.report before adding to the project.
2. **Geometry only.** Meshes are used for their shape and UV layout. All materials are replaced with Three.js PBR materials.
3. **Attribution.** Record license and author for every externally sourced model.

---

## Production Models (for rides) — PROCEDURAL

All four rides are built **entirely from Three.js primitive geometry**. No external models needed for ride structures. This ensures full control over the scene graph hierarchy and eliminates animation stripping risk.

**Primitive geometry used for rides:**

| Ride Part | Geometry Type | Notes |
|---|---|---|
| Ferris wheel hub | `CylinderGeometry(1, 1, 2, 16)` | Central axle |
| Ferris wheel ring | `TorusGeometry(20, 0.5, 8, 48)` | Outer ring |
| Gondola box | `BoxGeometry(2, 1.5, 1)` | 8 gondolas |
| Carousel platform | `CylinderGeometry(12, 12, 0.5, 32)` | Flat disc |
| Carousel canopy | `ConeGeometry(13, 4, 32)` | Conical roof |
| Horse (simplified) | `BoxGeometry` kit + `CylinderGeometry` | Head, body, legs |
| Coaster track | `TubeGeometry(curve, 200, 0.3, 8)` | Parametric |
| Coaster cart | `BoxGeometry(2.5, 1, 1.5)` | |
| Tagada arms | `BoxGeometry(1, N, 1)` | Multiple arms |
| Seat platform | `CylinderGeometry(5, 5, 0.3, 32)` | |
| Control panel box | `BoxGeometry(2, 1.5, 0.5)` | |
| Lever | `BoxGeometry(0.1, 0.5, 0.1)` | |
| Semaphore | `SphereGeometry(0.15, 8, 8)` | |

---

## Environment Models — EXTERNAL (GLB)

These are downloaded from external sources and used as static geometry.

---

### MODEL_01 — Lamppost

| Field | Detail |
|---|---|
| **Name** | `lamppost_lowpoly.glb` |
| **Purpose** | 12× park lamp poles with ornate head |
| **Polygon budget** | < 500 triangles per instance |
| **UV requirements** | Clean UV for texture application |
| **Normal map needed** | No (simple geometry) |
| **Animation** | NONE — strip any if present |
| **Scale** | ~5–6 metres tall |

**Recommended sources:**
1. **[Low-Poly Garden Lamp – Stylized Outdoor Light](https://sketchfab.com/3d-models/low-poly-garden-lamp-stylized-outdoor-light-6c945121ca0c41bf988b6e4f5769b414)** — Sketchfab, CC license, 1.7k triangles, GLB export available
2. **[Low-Poly Lamp Post by Memorie](https://sketchfab.com/3d-models/low-poly-lamp-post-c466684e819a4428b6d8ed50537615e4)** — Sketchfab, free
3. **[Double Street Light – Low Poly/Game Ready](https://sketchfab.com/3d-models/double-street-light-low-polygame-ready-free-0d465ab50a164d388dace8448ea2c120)** — Sketchfab, free

**Style requirement:** Ornate/vintage fairground style preferred. Avoid modern fluorescent poles.

**Three.js integration note:** The PointLight is NOT part of the GLB — it is created programmatically and attached as a child to the imported mesh.

---

### MODEL_02 — Food Stall / Bancarella

| Field | Detail |
|---|---|
| **Name** | `food_stall_carnival.glb` |
| **Purpose** | 6× carnival food/game booths |
| **Polygon budget** | < 2000 triangles |
| **UV requirements** | Separate UV islands for awning, frame, counter |
| **Normal map needed** | Yes (wood planks detail) |
| **Animation** | NONE |
| **Scale** | ~3m wide × 3m tall |

**Recommended sources:**
1. **[Stylized Carnival Booth by Keyotine](https://sketchfab.com/3d-models/stylized-carnival-booth-d8b4a661d433494184403c621818a424)** — Sketchfab, free, CC license
2. **[Sketchfab carnival tag](https://sketchfab.com/tags/carnival)** — browse for additional options
3. **[CGTrader food stall models](https://www.cgtrader.com/3d-models/food-stall)** — some free options

**Style requirement:** Colourful, festive. Striped awning important. Similar style across all 6 stalls (consistent art direction).

---

### MODEL_03 — Fence Segment

| Field | Detail |
|---|---|
| **Name** | `fence_segment.glb` OR procedural |
| **Purpose** | Park perimeter fence, tiled every 4m |
| **Polygon budget** | < 200 triangles per segment |
| **UV requirements** | Simple planar UV |
| **Normal map needed** | Optional (wood grain) |
| **Animation** | NONE |
| **Scale** | 4m wide × 1.2m tall |

**Recommended sources:**
1. **Procedural (preferred for performance):** Build from `BoxGeometry` (3 posts + 2 horizontal rails) in code — no external dependency, fully controlled
2. **[Low Poly Wooden Fence by oconop23](https://sketchfab.com/3d-models/low-poly-wooden-fence-bd590dd5ea604253a04c1bdafb5ccc71)** — Sketchfab, game-ready, textured
3. **[Low Poly - Wooden Fence by tadeus](https://sketchfab.com/3d-models/low-poly-wooden-fence-d7811e6bc132478b9ac9b3ba21365148)** — Sketchfab, free

---

### MODEL_04 — Carousel Horse (optional)

| Field | Detail |
|---|---|
| **Name** | `carousel_horse.glb` |
| **Purpose** | 8× horses on carousel poles |
| **Polygon budget** | < 1500 triangles |
| **UV requirements** | Full UV unwrap for painted texture |
| **Normal map needed** | Yes (horse muscle/saddle detail) |
| **Animation** | NONE — vertical bob is coded in JS |
| **Scale** | ~1.5m tall |

**Recommended sources:**
1. **[Sketchfab search: "carousel horse low poly"](https://sketchfab.com/search?q=carousel+horse+low+poly&type=models)** — search and filter by free/CC
2. **Procedural alternative:** A simplified horse shape from `CylinderGeometry` + `SphereGeometry` + `BoxGeometry` parts — acceptable for this project's style if no suitable free model found

---

### MODEL_05 — Visitor / NPC Character

| Field | Detail |
|---|---|
| **Name** | Procedural (no external model) |
| **Purpose** | 8–12 walking park visitors |
| **Polygon budget** | < 200 triangles per character (stylised) |
| **UV requirements** | Simple UV for coloured body texture |
| **Animation** | NONE — walk cycle coded in JS |
| **Scale** | ~1.75m |

**Implementation:** Built from Three.js primitives:
- Body: `CylinderGeometry(0.3, 0.3, 1.2)`
- Head: `SphereGeometry(0.25, 8, 8)`
- Arms: `CylinderGeometry(0.08, 0.08, 0.7)` × 2
- Legs: `CylinderGeometry(0.1, 0.1, 0.8)` × 2

Applied painted flat-colour texture (different colours per visitor for variety).

---

## Model LOD Strategy

| Model | LOD 0 (< 30 units) | LOD 1 (30–70 units) | LOD 2 (> 70 units) |
|---|---|---|---|
| Lamppost | Full GLB | Half-res | BoxGeometry |
| Food stall | Full GLB | Full GLB | Half-res |
| Fence segment | Merged | — | Merged (same, frustum culled) |
| Carousel horse | Full GLB | Low-poly | BoxGeometry |
| Visitor | Full | Low-poly | Single cylinder |

---

## Polygon Count Summary

| Model | Triangles (LOD0) | Instances | Total Triangles |
|---|---|---|---|
| Lamppost | ~500 | 12 | 6,000 |
| Food stall | ~2,000 | 6 | 12,000 |
| Fence segment | ~200 | ~200 | 40,000 |
| Carousel horse | ~1,500 | 8 | 12,000 |
| Visitors | ~200 | 12 | 2,400 |
| Ride geometry (procedural) | ~5,000 total | 4 rides | 20,000 |
| Ground/paths | ~50 | 1 each | 300 |
| **TOTAL** | | | **~93,000** |

Target: < 500,000 triangles for 60fps on integrated GPU. We are well within budget.
