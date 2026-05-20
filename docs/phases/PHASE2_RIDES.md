# Phase 2 — Rides & Hierarchical Models (1 → 2)

> Back to [README](../README.md)  
> Prerequisites: [Phase 1](PHASE1_ENVIRONMENT.md) complete

---

## Goal

Add all four animated rides as proper Three.js scene-graph hierarchies. All animations implemented in JavaScript. Rides start paused; each has a 3D control panel that starts/stops it with ease-in/out.

---

## Deliverables

- Ferris Wheel: hub + ring (Y rotation) + 8 gondolas (counter-rotation) + passengers
- Carousel: platform (Y rotation) + canopy + 8 poles + 8 horses (Y bob, phase offset) + jockeys
- Roller Coaster: CatmullRomCurve3 track + TubeGeometry + cart (Frenet orientation) + variable speed
- Tagada: base (Y rotation) + arm1 (X sin) + arm2 (Z sin×1.7) + seat (fast Y spin)
- 4× 3D control panels with semaphore + lever
- AnimationManager integrating all ride animators
- Ease-in / ease-out via tween.js on start/stop
- PBR materials (wood + painted metal) on all rides
- 60fps with all 4 rides running

---

## Step-by-Step

### Step 1 — AnimationManager

Create `js/animation/AnimationManager.js` before building any rides (rides will register themselves with it).

See `ANIMATION_SYSTEM.md` for interface specification.

---

### Step 2 — Ferris Wheel

**Key concepts demonstrated:** Composed hierarchical transforms (Lecture 05). Counter-rotation = child negates parent rotation.

Implementation location: `js/rides/FerrisWheel.js`

```
FERRIS WHEEL SCENE GRAPH:
  ferrisWheelRoot  (placed at world (-40, 0, -40))
    ├─ hubMesh     CylinderGeometry(1.5, 1.5, 3, 16)
    │   material: MAT_METAL_STEEL
    │   castShadow, receiveShadow
    │
    ├─ outerRing   THREE.Group  ← ROTATES Y each frame
    │   ├─ ringMesh  TorusGeometry(20, 0.6, 8, 48)
    │   │   material: MAT_METAL_PAINTED (yellow/gold)
    │   │
    │   ├─ spoke_0..7  (8× BoxGeometry(0.3, 20, 0.3) at ring radius)
    │   │   each rotated by (i × PI/4) on Z
    │   │
    │   └─ gondolaMount_0..7  (THREE.Group at each arm tip)
    │       position: (0, 20, 0) relative to outerRing, then rotated
    │       → world position = ring radius = 20 units from hub
    │
    │       ├─ gondolaMesh  BoxGeometry(2.5, 2, 1.2)
    │       │   rotation.y = -outerRing.rotation.y  ← COUNTER-ROTATION
    │       │   material: MAT_WOOD_PAINTED (blue or red)
    │       │
    │       ├─ passenger_A  CapsuleGeometry(0.2, 0.6, 4, 8)
    │       │   position: (-0.4, 0, 0)
    │       │   rotation.z = sin(time + phaseA) × 0.09  ← sway
    │       │
    │       └─ passenger_B  CapsuleGeometry(0.2, 0.6, 4, 8)
    │           position: (+0.4, 0, 0)
    │           rotation.z = sin(time + phaseB) × 0.09
    │
    └─ controlPanel  (see Control Panel step below)
        position: (-3, 0, 22)  relative to ferrisWheelRoot

ANIMATION:
  tick(delta, time):
    outerRing.rotation.y += 0.3 × speed × delta
    for each gondolaMount:
      gondolaMesh.rotation.y = -outerRing.rotation.y
      for each passenger:
        passenger.rotation.z = sin(time × 0.8 + phaseOffset[i]) × 0.09

ORAL EXAM PROOF:
  In browser console:
  ferrisWheel.gondolaMounts[0].gondoleMesh.getWorldQuaternion(q)
  console.log(q.y)  → should be ≈ 0 at all times
  This proves counter-rotation is working.
```

---

### Step 3 — Carousel

Implementation location: `js/rides/Carousel.js`

```
CAROUSEL SCENE GRAPH:
  carouselRoot  (placed at world (+40, 0, -40))
    ├─ platform  CylinderGeometry(12, 12, 0.5, 32)  ← ROTATES Y
    │   material: MAT_WOOD_PAINTED (red base)
    │   ├─ canopy  ConeGeometry(14, 4, 32)
    │   │   position: (0, 5, 0)
    │   │   material: striped (custom DataTexture or MAT_STALL_AWNING)
    │   │
    │   └─ poleHorse_0..7  (8× THREE.Group at radius 8)
    │       position: (8 × cos(i×PI/4), 0.5, 8 × sin(i×PI/4))
    │
    │       ├─ pole  CylinderGeometry(0.08, 0.08, 6, 8)
    │       │   position: (0, 3, 0)  (centred on pole height)
    │       │   material: MAT_METAL_STEEL (gold colour)
    │       │
    │       ├─ horse  (GLB import: carousel_horse.glb, or procedural shape)
    │       │   position.y = BASE_Y + sin(time × 1.5 + i × PI/4) × 1.0
    │       │   material: MAT_HORSE (white painted, specular)
    │       │
    │       └─ jockey  CapsuleGeometry(0.18, 0.4, 4, 6)
    │           child of horse  ← moves with horse automatically
    │           position: (0, 0.6, 0)  (sits on horse back)
    │
    └─ controlPanel  position: (-14, 0, 0)

ANIMATION:
  tick(delta, time):
    platform.rotation.y += 0.8 × speed × delta
    for i, horse of horses:
      horse.position.y = 0.5 + sin(time × 1.5 × speed + i × TWO_PI/8) × 1.0
```

---

### Step 4 — Roller Coaster

Implementation location: `js/rides/RollerCoaster.js`

```
ROLLER COASTER TRACK DEFINITION:

  trackControlPoints = [
    Vector3(0,  2, 0),     ← start
    Vector3(15, 2, 0),
    Vector3(25, 15, -10),  ← first climb
    Vector3(30, 18, -20),
    Vector3(25, 12, -30),
    Vector3(10, 2, -35),   ← valley
    Vector3(-5, 8, -25),   ← partial climb
    Vector3(-10, 12, -10),
    Vector3(-8, 18, 0),    ← second peak
    Vector3(-5, 8, 15),
    Vector3(5, 2, 20),
    Vector3(0, 2, 0)       ← back to start (closed loop)
  ]
  Offset all points by carouselRootWorldPos to place in SE quadrant

  curve = CatmullRomCurve3(trackControlPoints, closed=true, curveType='catmullrom')

TRACK MESH:
  trackGeo = TubeGeometry(curve, 200, 0.35, 8, true)  ← closed tube
  trackMesh = Mesh(trackGeo, MAT_METAL_PAINTED)
  Support pillars: CylinderGeometry below each control point, height = point.y

CART ANIMATION:
  cartT = 0.0  ← parametric position on curve [0, 1)
  
  tick(delta, time):
    // Variable speed (physics-inspired)
    pos       = curve.getPointAt(cartT)
    elevation = pos.y
    speedFactor = 1.0 + (maxHeight - elevation) / maxHeight × 0.8
    
    cartT = (cartT + 0.008 × speedFactor × speed × delta) % 1.0
    
    // Position
    cart.position.copy(curve.getPointAt(cartT))
    
    // Orientation (Frenet frame from Lecture 07)
    tangent = curve.getTangentAt(cartT).normalize()
    up      = Vector3(0, 1, 0)
    right   = new Vector3().crossVectors(tangent, up).normalize()
    trueUp  = new Vector3().crossVectors(right, tangent)
    
    rotMatrix = Matrix4().makeBasis(right, trueUp, tangent.negate())
    cart.quaternion.setFromRotationMatrix(rotMatrix)

PASSENGERS:
  4 passengers inside cart box, seated
  lean (rotation.z) = curvatureEstimate × LEAN_FACTOR
```

---

### Step 5 — Tagada (Mechanical Arm)

Implementation location: `js/rides/Tagada.js`

```
TAGADA SCENE GRAPH:
  tagadaRoot  (placed at world (-40, 0, +40))
    ├─ base     CylinderGeometry(3, 3, 1, 16)
    │   rotation.y += BASE_OMEGA × delta  ← SLOW Y ROTATION
    │   material: MAT_METAL_STEEL (grey)
    │
    ├─ arm1Group  THREE.Group  (pivot at base top: position(0, 1, 0))
    │   rotation.x = sin(time × 0.9) × 0.52  ← ±30° X OSCILLATION
    │   │
    │   ├─ arm1Mesh  BoxGeometry(0.8, 10, 0.8)
    │   │   position: (0, 5, 0)  (centred on arm length)
    │   │   material: MAT_METAL_PAINTED (orange)
    │   │
    │   └─ arm2Group  THREE.Group  (pivot at arm1 tip: position(0, 10, 0))
    │       rotation.z = sin(time × 1.7 + 1.0) × 0.42  ← ±24° Z OSCILLATION
    │       │
    │       ├─ arm2Mesh  BoxGeometry(0.8, 7, 0.8)
    │       │   position: (0, 3.5, 0)
    │       │   material: MAT_METAL_PAINTED (grey)
    │       │
    │       └─ seatPlatform  THREE.Group  (pivot at arm2 tip)
    │           rotation.y += SEAT_OMEGA × delta  ← FAST Y SPIN
    │           ├─ discMesh  CylinderGeometry(5, 5, 0.3, 32)
    │           │   position: (0, 0, 0)
    │           ├─ seat_0..7  BoxGeometry(0.8, 0.5, 1.2) × 8
    │           │   positioned at radius 4 around disc perimeter
    │           └─ passenger_0..7  (small capsules in each seat)
    │
    └─ controlPanel  position: (-6, 0, 6)

ANIMATION:
  tick(delta, time):
    t = time × speed
    base.rotation.y      += 0.4 × speed × delta
    arm1Group.rotation.x  = sin(t × 0.9) × 0.52
    arm2Group.rotation.z  = sin(t × 1.7 + 1.0) × 0.42
    seatPlatform.rotation.y += 2.5 × speed × delta
```

---

### Step 6 — 3D Control Panels

Implementation location: `js/interaction/ControlPanel.js`

```
CONTROL PANEL GEOMETRY:
  panelRoot  THREE.Group
    ├─ casing      BoxGeometry(2.2, 1.8, 0.6)
    │   material:  MAT_METAL_STEEL (dark, matte)
    ├─ semaphore   SphereGeometry(0.2, 12, 12)
    │   position:  (0, 0.4, 0.35)
    │   userData.state: 'off'
    │   material:  MeshStandardMaterial({ emissive: RED, emissiveIntensity: 1.5 })
    └─ lever       BoxGeometry(0.12, 0.6, 0.12)
        position:  (0, -0.1, 0.35)
        origin at bottom (so rotation pivots at base)
        rotation.x = 0 (stopped) or π/4 (running)

PANEL INTERACTIONS:
  panelMeshes.userData.rideRef = rideObject
  
  On click:
    ride.toggle()
    → if now running:
        semaphore.material.emissive.set(0x00CC00)
        tween(lever.rotation.x, 0 → PI/4, 300ms, Quadratic.Out)
    → if now stopped:
        semaphore.material.emissive.set(0xCC0000)
        tween(lever.rotation.x, PI/4 → 0, 300ms, Quadratic.Out)

LAYER ASSIGNMENT:
  casing.layers.enable(PANEL_LAYER)
  semaphore.layers.enable(PANEL_LAYER)
  lever.layers.enable(PANEL_LAYER)
```

---

### Step 7 — Phase 2 QA

```
ANIMATION CHECKS:
  □ Ferris wheel ring rotates; gondola world Y rotation stays ≈ 0
     (verify: gondola.getWorldQuaternion(q); q.y should be ~0)
  □ Carousel horses form visible sine-wave pattern (take screenshot at t=5s)
  □ Roller coaster cart stays exactly on track at all points
  □ Tagada seat platform compound motion looks convincingly mechanical
  □ All rides start paused (speed = 0 or active = false)

INTERACTION CHECKS:
  □ Click each control panel → ride starts (green light, lever tips)
  □ Click again → ride stops (red light, lever returns, ease-out)
  □ Ease-in: first 1.5s ride accelerates from 0 → full speed
  □ Ease-out: ride decelerates over 2s to stop

MATERIAL CHECKS:
  □ Wood texture visible on gondola / carousel floor
  □ Painted metal on ring / arms
  □ PBR materials respond to light direction changes

PERFORMANCE:
  □ 60fps with all 4 rides running + full environment
  □ renderer.info.render.calls < 100

GIT:
  □ Tag: v0.2-rides-complete
```
