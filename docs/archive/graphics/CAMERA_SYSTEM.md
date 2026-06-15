# Camera System — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Camera Specification

```
THREE.PerspectiveCamera:
  fov:    60°           (wide enough for immersive park views)
  aspect: window.innerWidth / window.innerHeight
  near:   0.1           (close enough for cockpit/gondola view)
  far:    2000          (sky is at ~800 units)
```

The camera is updated on every `resize` event:
```
camera.aspect = newWidth / newHeight
camera.updateProjectionMatrix()
renderer.setSize(newWidth, newHeight)
```

---

## 2. Three Camera Modes

### Mode 1: Orbit (default)
Standard three-axis orbit around a target point.

**Implementation:** Use `THREE.OrbitControls` from Three.js addons as the initial solution. Replace with a custom lightweight controller in Phase 4 if performance is a concern.

```
orbitControls:
  target:      Vector3(0, 0, 0)  (park centre)
  minDistance: 5    (can get close to inspect)
  maxDistance: 200  (can zoom out to see full park)
  maxPolarAngle: Math.PI / 2 - 0.05  (prevent going below ground)
  enableDamping: true
  dampingFactor: 0.05
  enablePan:   true
  screenSpacePanning: false
```

**State:** Active whenever `mode == 'orbit'` and no tween is running.

---

### Mode 2: Fly-To (click-triggered)
Triggered when user clicks on any point in the scene (ground or object). The camera smoothly interpolates to a viewpoint near the clicked point using tween.js.

**Algorithm:**

```
flyTo(hitPoint):
  // Compute destination
  lookTarget  = hitPoint
  flyHeight   = max(hitPoint.y + FLY_HEIGHT, MIN_HEIGHT)  // stay above ground
  backOffset  = camera.position.clone()
                  .sub(hitPoint)
                  .normalize()
                  .multiplyScalar(FLY_BACK_DISTANCE)
  destination = hitPoint.clone().add(backOffset).setY(flyHeight)
  
  // Disable orbit controls during flight
  orbitControls.enabled = false
  
  // Tween camera position
  startPos = camera.position.clone()
  startTarget = orbitControls.target.clone()
  
  TWEEN.Tween({ t: 0 })
    .to({ t: 1 }, FLY_DURATION_MS)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(({ t }) => {
      camera.position.lerpVectors(startPos, destination, t)
      orbitTarget.lerpVectors(startTarget, lookTarget, t)
      camera.lookAt(orbitTarget)
    })
    .onComplete(() => {
      orbitControls.target.copy(lookTarget)
      orbitControls.enabled = true
    })
    .start()
```

**Constants:**
```
FLY_HEIGHT         = 8      (units above hit point)
MIN_HEIGHT         = 2      (absolute minimum — never below 2)
FLY_BACK_DISTANCE  = 15     (units behind hit point relative to current view)
FLY_DURATION_MS    = 1200   (milliseconds for full tween)
```

**Course connection:** The ray from camera through the clicked pixel and its intersection with scene geometry is the same algorithm as ray tracing (Lecture 15), applied in real-time at 1 ray per click rather than 1 ray per pixel.

---

### Mode 3: First-Person View (FPV) — Gondola Camera
The camera becomes a child of a gondola node in the Ferris Wheel scene graph. Since it is part of the hierarchy, it automatically follows the gondola's world transform without any per-frame code.

**Activation:**
```
activateFPV(gondolaGroup):
  mode = 'fpv'
  orbitControls.enabled = false
  
  // Remove camera from scene, reparent to gondola
  scene.remove(camera)
  gondolaGroup.add(camera)
  
  // Position camera at eye level inside gondola
  camera.position.set(0, 1.2, 0)
  camera.rotation.set(0, 0, 0)
  
  // Override all parent rotations except the gondola's own
  // (The gondola counter-rotation keeps it upright, so
  //  the camera naturally faces outward)
```

**Deactivation (C key or ESC):**
```
deactivateFPV():
  gondolaGroup.remove(camera)
  scene.add(camera)
  camera.position.copy(savedOrbitPosition)
  orbitControls.target.copy(savedOrbitTarget)
  orbitControls.enabled = true
  mode = 'orbit'
```

**Experience description:** The user sees the park from the gondola, the ground swinging below, the sky above. The counter-rotation ensures the gondola stays upright, so the camera view is always horizon-level — a genuine fairground experience. This is the most dramatic interactive moment in the demo.

---

## 3. Camera State Machine

```
State: 'orbit'
  ↓  left-click on scene
State: 'flyto'  (orbit controls disabled, tween running)
  ↓  tween completes
State: 'orbit'  (orbit controls re-enabled at new target)

State: 'orbit'
  ↓  C key pressed (within 20 units of Ferris Wheel)
State: 'fpv'  (orbit controls disabled, camera parented to gondola)
  ↓  C key or ESC pressed
State: 'orbit'  (camera removed from gondola, orbit re-enabled)
```

---

## 4. Camera Constraints

To prevent the user from getting lost or going underground:

```
// Prevent camera from going below ground
if camera.position.y < MIN_HEIGHT:
  camera.position.y = MIN_HEIGHT
  orbitControls.target.y = max(orbitControls.target.y, 0)

// Prevent orbit target from going underground
orbitControls.minPolarAngle = 0.05   // small gap from vertical up
orbitControls.maxPolarAngle = 1.55   // ~89° — just above horizon

// Limit max distance
orbitControls.maxDistance = 200
orbitControls.minDistance = 3
```

---

## 5. Camera Shake (optional, Phase 4)

During the FPV gondola ride, a subtle camera shake can be added to simulate the real experience:

```
FPV shake:
  shakeAmplitude = 0.02
  camera.position.x += sin(time × 8 + 0.3) × shakeAmplitude
  camera.position.y += cos(time × 12) × shakeAmplitude × 0.5
```

Amplitude is low enough to be barely perceptible but contributes to immersion.

---

## 6. Initial Camera Positions

Pre-defined viewpoints for demo mode:

```
VIEWPOINTS = {
  overview:     { pos: (0, 80, 120),   target: (0, 0, 0)   },
  ferrisWheel:  { pos: (-40, 25, -15), target: (-40, 15, -40) },
  carousel:     { pos: (+40, 20, -15), target: (+40, 10, -40) },
  rollerCoaster:{ pos: (+20, 15, +60), target: (+40, 5, +40)  },
  tagada:       { pos: (-20, 15, +60), target: (-40, 5, +40)  },
  stage:        { pos: (0, 15, -55),   target: (0, 2, -80)    }
}
```

Pressing number keys 1–6 could fly to these presets (optional UI feature).
