# Scene Structure — Luna Park 3D

> Back to [README](../README.md)

---

## 1. World Coordinate System

- **Origin (0, 0, 0):** Center of park, center of the crossing paths
- **Y-axis:** Up
- **X-axis:** East
- **Z-axis:** South (Three.js default right-hand Z-toward-camera convention)
- **World scale:** 1 unit = 1 metre (approximate)
- **Park footprint:** 200 × 200 units (−100 to +100 on X and Z)

---

## 2. Scene Graph Hierarchy

### Top-Level Groups

```
THREE.Scene
├── environmentGroup   (THREE.Group, static, no per-frame update)
├── ridesGroup         (THREE.Group, per-frame animated)
├── charactersGroup    (THREE.Group, per-frame animated)
└── lightGroup         (THREE.Group, partially per-frame updated by DayNightCycle)
```

All groups are added to the scene root. Groups allow bulk visibility toggling, layer assignment, and frustum-culling optimisation.

---

## 3. Environment Group Detail

### 3.1 Ground Plane
```
groundMesh (THREE.Mesh)
  geometry: PlaneGeometry(200, 200, 1, 1)
  rotation.x = -Math.PI / 2
  position.y = 0
  receiveShadow = true
  material: MeshStandardMaterial {
    map: grass_albedo_2k,
    normalMap: grass_normal_2k,
    roughnessMap: grass_roughness_2k,
    repeat: (40, 40),
    anisotropy: maxAniso
  }
```

### 3.2 Path Network

Four rectangular path planes forming a cross, plus a central circle:

```
pathGroup (THREE.Group)
  ├── path_north  PlaneGeometry(6, 92)  position(0, 0.01, -46)
  ├── path_south  PlaneGeometry(6, 92)  position(0, 0.01, +46)
  ├── path_east   PlaneGeometry(92, 6)  position(+46, 0.01, 0)
  ├── path_west   PlaneGeometry(92, 6)  position(-46, 0.01, 0)
  └── path_center CircleGeometry(8, 32) position(0, 0.01, 0)
```

All path meshes share one material instance (same PBR texture set, different repeat scale).

### 3.3 Fence

```
fenceGroup (THREE.Group)
  ├── fenceSegment_N_0 .. fenceSegment_N_n   (North edge)
  ├── fenceSegment_S_0 .. fenceSegment_S_n   (South edge)
  ├── fenceSegment_E_0 .. fenceSegment_E_n   (East edge)
  └── fenceSegment_W_0 .. fenceSegment_W_n   (West edge)
```

Fence segment spacing: 4 units. Corner posts handled by a single corner piece.

**Optimisation:** If performance allows, merge all fence geometry into a single `THREE.BufferGeometry` using `BufferGeometryUtils.mergeGeometries()`. This reduces draw calls from ~200 to 1 for the fence.

### 3.4 Lamppost Group

```
lampostGroup (THREE.Group)
  └── lamppost_0 .. lamppost_11  (12 instances)
      Each lamppost:
        lamppostRoot (THREE.Group)
          ├── poleMesh     (from GLB, castShadow=true)
          ├── headMesh     (from GLB, castShadow=true)
          └── pointLight   (THREE.PointLight, initially OFF)
                intensity = 0 (off) or 2.5 (on)
                distance  = 15
                decay     = 2
                castShadow = false (performance: only 4 cast shadows)
```

Lamppost positions (12 total, 3 per path arm, 20–80 units from centre):
```
North arm: (0, 0, -25), (0, 0, -50), (0, 0, -75) — offset ±4 on X
South arm: same, positive Z
East arm: (+25, 0, 0), (+50, 0, 0), (+75, 0, 0) — offset ±4 on Z
West arm: same, negative X
```

### 3.5 Food Stalls

```
stallGroup (THREE.Group)
  ├── stall_NE   position(+12, 0, -12)  rotation.y = π/4
  ├── stall_NW   position(-12, 0, -12)  rotation.y = -π/4
  ├── stall_SE   position(+12, 0, +12)  rotation.y = -π/4 + π
  ├── stall_SW   position(-12, 0, +12)  rotation.y = π/4 + π
  ├── stall_N    position(0, 0, -60)    rotation.y = 0
  └── stall_S    position(0, 0, +60)    rotation.y = π
```

Each stall is the same GLB model, repositioned and rotated.

### 3.6 Skybox

Two skybox meshes managed by DayNightCycle:

```
skyGroup (THREE.Group)
  ├── daySkyMesh   (HDRI-based environment, rendered via scene.background)
  └── nightSkyMesh (BoxGeometry(1000), inner faces, star texture, opacity=0)
```

During day/night transition, `nightSkyMesh.material.opacity` tweens 0 → 1 as sun intensity drops.

### 3.7 Central Stage

```
stageGroup (THREE.Group)
  position(0, 0, -80)
  ├── platformMesh  CylinderGeometry(8, 8, 0.5, 32)  receiveShadow
  ├── backdropMesh  PlaneGeometry(16, 8) position(0, 4, -1)
  └── spotLight     THREE.SpotLight(0xFFFFFF, 2)
        position(0, 20, -80), target=(0, 0, -80)
        angle=π/8, penumbra=0.2
        castShadow=true, shadow.mapSize=1024×1024
```

---

## 4. Rides Group Detail

### 4.1 Ferris Wheel (Ruota Panoramica)
```
ferrisWheelRoot (THREE.Group)
  position(-40, 0, -40)    ← NW quadrant

  ├── hubMesh     CylinderGeometry(1, 1, 2)  [static]
  ├── outerRing   (THREE.Group, rotates Y each frame)
  │   ├── ringMesh TorusGeometry(20, 0.5, 8, 48)
  │   ├── spoke_0..7  (8× BoxGeometry arms)
  │   └── gondolaMount_0..7  (THREE.Group at arm tips)
  │       ├── gondolaMesh  BoxGeometry(2, 1.5, 1)
  │       │   rotation.y compensates ring rotation each frame
  │       ├── passenger_A  CapsuleGeometry(0.2, 0.5)
  │       └── passenger_B  CapsuleGeometry(0.2, 0.5)
  └── controlPanel (THREE.Group)  position(-3, 0, 22)
      userData.ride = ferrisWheelRef
```

### 4.2 Carousel (Giostra Cavalli)
```
carouselRoot (THREE.Group)
  position(+40, 0, -40)    ← NE quadrant

  ├── platform   CylinderGeometry(12, 12, 0.5, 32)  [rotates Y]
  │   ├── canopyMesh  (ConeGeometry or imported GLB)
  │   └── poleHorse_0..7  (THREE.Group at r=8 from centre)
  │       ├── poleMesh    CylinderGeometry(0.1, 0.1, 6)
  │       ├── horseMesh   (imported or procedural horse shape)
  │       │   position.y = initialY + sin(time + phaseOffset) × 1.0
  │       └── jockeyMesh  CapsuleGeometry  [child of horseMesh]
  └── controlPanel  position(-14, 0, 0)
```

### 4.3 Roller Coaster (Ottovolante)
```
rollerCoasterRoot (THREE.Group)
  position(+40, 0, +40)    ← SE quadrant

  ├── trackMesh  TubeGeometry(curve, 200, 0.3, 8, false)
  │   (curve = CatmullRomCurve3 with 12 control points)
  ├── structureMesh (support pillars, procedural BoxGeometry)
  └── cartGroup  (THREE.Group, follows curve each frame)
      ├── cartMesh  BoxGeometry(2.5, 1, 1.5)
      ├── passenger_0..3
      └── [position/quaternion set from curve.getPointAt + FrenetFrames]
```

### 4.4 Tagada (Braccio Meccanico)
```
tagadaRoot (THREE.Group)
  position(-40, 0, +40)    ← SW quadrant

  ├── baseMesh     CylinderGeometry(3, 3, 1)  [slow Y rotation]
  ├── arm1Group    (THREE.Group, pivot at base top)
  │   rotation.x = sin(time) × 0.5     ← ±30°
  │   ├── arm1Mesh  BoxGeometry(1, 12, 1)  translated (0, 6, 0)
  │   └── arm2Group  (THREE.Group, pivot at arm1 tip)
  │       rotation.z = sin(time × 1.7) × 0.4
  │       ├── arm2Mesh  BoxGeometry(1, 8, 1)  translated (0, 4, 0)
  │       └── seatPlatform (THREE.Group, pivot at arm2 tip)
  │           rotation.y = time × 2.0   ← fast spin
  │           ├── platformMesh  CylinderGeometry(5, 5, 0.3, 32)
  │           └── seat_0..7  (BoxGeometry seats around perimeter)
  └── controlPanel  position(-5, 0, 5)
```

---

## 5. Characters Group

```
charactersGroup (THREE.Group)
  └── visitor_0 .. visitor_11  (8–12 NPCs)
      Each visitor:
        visitorRoot (THREE.Group)
          ├── bodyMesh   CylinderGeometry(0.3, 0.3, 1.2)  [painted texture]
          ├── headMesh   SphereGeometry(0.25, 8, 8)
          └── armL, armR BoxGeometry(0.15, 0.6, 0.15)  [swing with stride]
```

Visitors follow a waypoint graph defined by an array of `Vector3` positions along the path network.

---

## 6. Light Group

```
lightGroup (THREE.Group)
  ├── hemisphereLight  HemisphereLight(skyColor, groundColor, intensity)
  ├── sunLight         DirectionalLight(sunColor, intensity)  [orbits in DayNightCycle]
  │   └── sunLight.target  (Object3D at origin)
  ├── [lamppost PointLights live inside lampostGroup, not here]
  ├── stageSpotLight   SpotLight(0xFFFFFF, 2)
  └── ridePointLights  [4× small PointLights on ride structures]
```

---

## 7. Scene Bounds Summary

| Object | World Position | Approximate Radius |
|---|---|---|
| Ground | (0, 0, 0) | 100 |
| Ferris Wheel | (-40, 0, -40) | 22 |
| Carousel | (+40, 0, -40) | 14 |
| Roller Coaster | (+40, 0, +40) | 30 |
| Tagada | (-40, 0, +40) | 10 |
| Stage | (0, 0, -80) | 9 |
| Food Stalls | ±12 from centre | 3 each |
| Lampposts | Along paths | 0.5 each |
| Fence | ±95 perimeter | — |

---

## 8. Camera Initial Position

```
camera.position.set(0, 80, 120)
camera.lookAt(0, 0, 0)
```

This gives a dramatic top-angled "arriving at the park" view as the opening shot.
