# Performance Optimization — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Targets

| Scenario | Target FPS | Minimum FPS |
|---|---|---|
| Day, no rides running | 60 | 60 |
| Day, all 4 rides running | 60 | 50 |
| Night, all rides + all lamps on | 60 | 45 |
| FPV gondola mode | 60 | 45 |
| Oral exam machine (integrated GPU) | 45 | 30 |

---

## 2. Draw Call Budget

The single biggest performance lever in WebGL is the number of draw calls (one per mesh material pair rendered). Target: **< 80 draw calls** for the full scene.

### Draw Call Inventory (estimated)

| Object | Draw Calls | Optimisation |
|---|---|---|
| Ground | 1 | — |
| 4 paths + centre | 1 | merged geometry |
| Fence (~200 segments) | 1 | merged via BufferGeometryUtils |
| 12 lampposts | 2–4 | InstancedMesh (pole + head) |
| 6 food stalls | 6–12 | GLB reuse, shared materials |
| Central stage | 2 | — |
| Ferris wheel | 6–10 | hub, ring, 8 gondola instances |
| Carousel | 5–8 | platform, 8 horse instances |
| Roller coaster | 3–5 | track, structure, cart |
| Tagada | 4–6 | base, arms, platform |
| 12 NPC visitors | 2 | InstancedMesh (body + head) |
| **Total estimate** | **~55–65** | well within budget |

---

## 3. Geometry Optimisation

### 3.1 Static Geometry Merging

All static environment objects that share a material can be merged into a single `BufferGeometry`:

```
MERGE CANDIDATES:
  Fence segments → merge into fenceMerged (1 draw call)
  Path planes    → merge into pathsMerged (1 draw call)
  Lamppost poles → use InstancedMesh(1 GLB geometry, 12 instances)
```

Tool: `THREE.BufferGeometryUtils.mergeGeometries([...geometries])`

Warning: merged geometry cannot be individually culled. Only merge objects that are always visible together.

### 3.2 InstancedMesh for Repeated Objects

For objects rendered multiple times identically (different position/rotation only):

```
Lampposts:
  poleInstanced = new THREE.InstancedMesh(poleGeo, poleMat, 12)
  headInstanced = new THREE.InstancedMesh(headGeo, headMat, 12)
  for i in 0..11:
    matrix.compose(positions[i], quaternions[i], scale)
    poleInstanced.setMatrixAt(i, matrix)
  poleInstanced.instanceMatrix.needsUpdate = true

Visitors (NPCs):
  bodyInstanced = new THREE.InstancedMesh(capsuleGeo, bodyMat, 12)
  // Update instance matrices per frame as visitors move
```

**Performance gain:** 12 draw calls → 1 draw call for lampposts.

### 3.3 LOD (Level of Detail)

Apply `THREE.LOD` to food stalls and trees (if any):

```
lod = new THREE.LOD()
lod.addLevel(highDetailMesh, 0)    // < 30 units: full detail
lod.addLevel(midDetailMesh,  30)   // 30–70 units: reduced poly
lod.addLevel(lowDetailMesh,  70)   // > 70 units: box approximation
```

---

## 4. Texture Optimisation

### 4.1 Resolution Strategy

| Surface | Albedo | Normal | Roughness | Rationale |
|---|---|---|---|---|
| Ground | 2K | 2K | 2K | Large; close viewing; repeat 40× |
| Paths | 2K | 1K | 1K | Large but smaller detail |
| Rides (main structures) | 1K | 1K | 1K | Medium size |
| Fence | 512 | 512 | — | Thin geometry; distance viewing |
| Lamp / stall | 512 | 512 | 512 | Small objects |
| Sky | 2K | — | — | Full view; no normal needed |
| Night sky | 1K | — | — | Barely moves |
| Characters | 256 | — | — | Very small; stylised |

Total VRAM estimate: ~60–80MB — fine for integrated GPU (2GB VRAM minimum).

### 4.2 Texture Atlas for Small Objects

Combine all small object textures (stall signs, lamp details) into a single 1K atlas. Reduces texture switches between draw calls.

### 4.3 Mipmaps

Ensure all power-of-two textures (512, 1024, 2048) have `generateMipmaps: true` (Three.js default). Non-POT textures: use `ClampToEdgeWrapping` and `minFilter: LinearFilter`.

### 4.4 Anisotropic Filtering

Apply only to ground and paths (viewed at oblique angles). Not needed for vertical surfaces.

```
const maxAniso = renderer.capabilities.getMaxAnisotropy()
grassMat.map.anisotropy = maxAniso
asphaltMat.map.anisotropy = maxAniso
```

---

## 5. Lighting Optimisation

### 5.1 Shadow-Casting Light Limits

Only 2 lights cast shadows:
- `DirectionalLight` (sun): PCFSoft, 2048×2048
- `SpotLight` (stage): PCF, 1024×1024

No `PointLight` casts shadows. (Shadow-casting PointLights require 6-face cubemap shadow maps = 6× the cost — prohibitive with 12 lampposts.)

### 5.2 PointLight Count

WebGL forward rendering caps hardware-defined. Three.js's default implementation supports up to 8 PointLights per material in its standard shaders. With more lights, it creates multiple render passes internally or adjusts the shader.

**Mitigation:** Use `light.layers` to partition lights by zone so only 4–6 lights affect any single object.

### 5.3 Night Performance

At night, the DirectionalLight is disabled (intensity = 0). This eliminates the shadow pass entirely, saving ~1.5–3ms of GPU time. Night performance may actually be faster than midday despite more PointLights being on.

---

## 6. JavaScript / CPU Optimisation

### 6.1 Delta Clamping

```
delta = clock.getDelta()
delta = Math.min(delta, 0.05)  // cap at 50ms (20fps minimum equiv.)
```
Prevents animation explosions if the browser tab loses focus and resumes.

### 6.2 Avoid Per-Frame Object Allocation

Never create `Vector3`, `Quaternion`, or `Matrix4` objects inside the render loop. Pre-allocate and reuse:

```
// WRONG (allocates new object every frame)
animate() {
  const pos = new THREE.Vector3(x, y, z)  // GC pressure!
}

// CORRECT
const _tempVec = new THREE.Vector3()
animate() {
  _tempVec.set(x, y, z)  // reuse existing object
}
```

### 6.3 Raycaster Frequency

The raycaster is only invoked on `mousedown` events — never on `mousemove`. No per-frame raycasting. This avoids a major CPU overhead.

### 6.4 Visitor Path-Following Optimisation

Visitor positions are updated every frame but the pathfinding (next waypoint selection) only runs when a visitor reaches a waypoint. Path queries are O(1) array lookups, not runtime graph searches.

---

## 7. Profiling Workflow

### Chrome DevTools — Performance Tab
1. Record a 5-second capture of the running scene
2. Look for long frames (red bars) in the overview
3. Drill into the "Main" thread — identify JS vs. render vs. GPU wait

### Three.js Built-in Stats
```
import Stats from 'three/addons/libs/stats.module.js'
stats = new Stats()
document.body.appendChild(stats.dom)
// In render loop:
stats.update()
```

### renderer.info
```
console.log(renderer.info.render)
// → { calls, triangles, points, lines, frame }
```

Target: `calls < 80`, `triangles < 500K`

### Chrome GPU tab
Open `chrome://gpu` to verify hardware acceleration is active on the exam machine.

---

## 8. Optimization Checklist

- [ ] `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` — cap retina scaling
- [ ] Frustum culling: confirm no `frustumCulled = false` on large objects
- [ ] Merged fence geometry: 1 draw call, not 200
- [ ] Instanced lampposts: 2 draw calls, not 24
- [ ] No per-frame `new THREE.Vector3()` in animation functions
- [ ] Raycaster only on click, not on mousemove
- [ ] Shadow frustum tight around park (no oversized shadow camera)
- [ ] Texture resolutions follow the budget above
- [ ] FPS stable in Chrome on test hardware before submission
