# Animation System — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Design Principle

**All animations are parametric functions of elapsed time `t`.**  
No imported keyframe data. No Blender/Maya animation clips. Every motion is described mathematically in JavaScript.

This is the core requirement of the project and a direct demonstration of Lecture 18 (Computer Animations) content.

---

## 2. Animation Architecture

### AnimationManager

```
AnimationManager:
  animators  = []     // all registered Animator objects
  elapsedTime = 0.0  // accumulated time in seconds
  
  register(animator):
    animators.push(animator)
  
  update(deltaSeconds):
    deltaSeconds = min(deltaSeconds, 0.05)  // clamp delta
    elapsedTime += deltaSeconds
    
    for a of animators:
      if a.active:
        a.tick(deltaSeconds, elapsedTime)
  
  setAllActive(bool):
    animators.forEach(a => a.active = bool)
```

### Animator Interface

Each animated object (ride, character, shader) implements:

```
{
  active:  boolean,
  speed:   number,    // multiplier; 1.0 = normal speed
  
  tick(delta, time): void
    // delta = seconds since last frame (max 0.05)
    // time  = total elapsed seconds
  
  easeIn(duration):  void  // tween speed: 0 → 1 over duration ms
  easeOut(duration): void  // tween speed: 1 → 0 over duration ms
}
```

The `speed` multiplier gates how fast `time` advances for that animator:
```
effectiveTime = globalTime × ride.speed
```
So faster speed = compressed time = faster motion.

---

## 3. Ferris Wheel Animation

**Degrees of freedom:**
- `outerRing.rotation.y` — continuous rotation
- `gondola[i].rotation.y` — counter-rotation (keeps gondola upright)
- `passenger[i][j].rotation.z` — sway oscillation

```
FerrisWheelAnimator.tick(delta, time):
  
  // 1. Ring rotation
  omega = BASE_OMEGA × speed          // rad/s
  outerRing.rotation.y += omega × delta
  
  // 2. Gondola counter-rotation (maintains world vertical)
  for gondola of gondoles:
    gondola.rotation.y = -outerRing.rotation.y
    // NOTE: Because gondola is a CHILD of outerRing,
    // gondola.worldRotation.y = outerRing.rotation.y + gondola.rotation.y = 0
    // This is the textbook hierarchical transform from Lecture 05
  
  // 3. Passenger sway (each pair of passengers has its own phase)
  for i, gondola of gondoles:
    phaseOffset = i × (TWO_PI / 8)
    swayAngle = sin(time × 0.8 + phaseOffset) × 0.09  // ±5°
    gondola.children.forEach(passenger => 
      passenger.rotation.z = swayAngle
    )
```

**Constants:**
```
BASE_OMEGA = 0.3        // rad/s at speed=1
```

---

## 4. Carousel Animation

**Degrees of freedom:**
- `platform.rotation.y` — continuous rotation
- `horse[i].position.y` — bob up/down (phase-offset sine)

```
CarouselAnimator.tick(delta, time):
  
  // 1. Platform rotation
  platform.rotation.y += PLATFORM_OMEGA × speed × delta
  
  // 2. Horse bob (each horse has its own phase offset)
  for i, horse of horses:
    phaseOffset  = i × (TWO_PI / 8)    // evenly distributed: i × 45°
    effectiveT   = time × HORSE_BOB_FREQ × speed
    horse.position.y = HORSE_BASE_Y + sin(effectiveT + phaseOffset) × BOB_AMP
    
    // Jockey follows automatically (is a child of horse)
```

**Constants:**
```
PLATFORM_OMEGA   = 0.8    // rad/s
HORSE_BOB_FREQ   = 1.5    // cycles per second
BOB_AMP          = 1.0    // metres
HORSE_BASE_Y     = 0.5    // default height on pole
```

**Visual effect:** At any given time, different horses are at different heights, creating a wave that propagates around the carousel. The formula `sin(t + i × π/4)` for 8 horses creates exactly one full wavelength around the carousel.

---

## 5. Roller Coaster Animation

**Degrees of freedom:**
- `cart.position` — follows parametric curve
- `cart.quaternion` — aligned to Frenet frame
- `cart.speed` — varies by elevation (faster downhill)

```
RollerCoasterAnimator.tick(delta, time):
  
  // 1. Advance cart along curve
  // Variable speed: faster at low points, slower at high points
  currentPoint = curve.getPointAt(cartT)
  elevation    = currentPoint.y
  
  speedFactor  = 1.0 + (maxHeight - elevation) / maxHeight × 0.8
  // → speedFactor: 1.0 at top, 1.8 at bottom
  
  cartT = (cartT + CART_BASE_SPEED × speedFactor × speed × delta) % 1.0
  
  // 2. Position cart
  pos = curve.getPointAt(cartT)
  cart.position.copy(pos)
  
  // 3. Orient cart using Frenet frame (Lecture 07 — Surfaces)
  tangent  = curve.getTangentAt(cartT)
  normal   = frenetFrames.normals[Math.floor(cartT × FRAMES_COUNT)]
  binormal = new THREE.Vector3().crossVectors(tangent, normal)
  
  rotMatrix.makeBasis(binormal, normal, tangent.negate())
  cart.quaternion.setFromRotationMatrix(rotMatrix)
  
  // 4. Passenger lean (simplified centripetal force simulation)
  curvature = getCurvatureAt(cartT)   // approximate second derivative
  leanAngle = curvature × LEAN_FACTOR × speed²
  passengers.forEach(p => p.rotation.z = leanAngle)
```

**Course connection:** The Frenet frame (tangent T, normal N, binormal B) at each point of the curve determines the cart's local coordinate system. This is a direct application of the differential geometry of curves from Lecture 07 (Surfaces).

---

## 6. Tagada Animation

**Three degrees of freedom** — three rotational joints creating chaotic compound motion:

```
TagadaAnimator.tick(delta, time):
  
  t = time × speed
  
  // 1. Base: slow continuous Y rotation
  base.rotation.y += BASE_OMEGA × delta × speed
  
  // 2. Arm 1: X oscillation (±30°, primary swing)
  arm1Group.rotation.x = sin(t × 0.9) × 0.52
  
  // 3. Arm 2: Z oscillation (±24°, phase-shifted, different frequency)
  arm2Group.rotation.z = sin(t × 1.7 + 1.0) × 0.42
  
  // 4. Seat platform: fast Y spin
  seatPlatform.rotation.y += SEAT_SPIN_OMEGA × delta × speed
  
  // Result: the seat platform's world position follows a complex
  // 3D Lissajous-like curve defined by the composition of three
  // sine-driven joint rotations — looks convincingly mechanical
```

**Constants:**
```
BASE_OMEGA     = 0.4     // rad/s slow base rotation
SEAT_SPIN_OMEGA = 2.5   // rad/s fast seat spin
```

**Why this looks convincing:** The three frequencies (0.9, 1.7, base) are mutually irrational multiples — the motion never exactly repeats, creating apparent unpredictability. This is the same principle as Lissajous figures.

---

## 7. NPC Visitor Animation

```
VisitorAnimator.tick(delta, time):
  
  // 1. Path following (state machine: walking → waiting → walking)
  if state == 'walking':
    direction = nextWaypoint - visitor.position
    distance  = direction.length()
    
    if distance < ARRIVAL_THRESHOLD:
      state         = 'waiting'
      waitTimer     = random(2, 6)  // wait 2–6 seconds
      nextWaypointIndex = pickNextWaypoint(currentWaypointIndex)
    else:
      visitor.position.addScaledVector(direction.normalize(), WALK_SPEED × delta)
      visitor.lookAt(nextWaypoint)
  
  elif state == 'waiting':
    waitTimer -= delta
    if waitTimer <= 0: state = 'walking'
  
  // 2. Walk animation (simplified: stride-based arm swing)
  stridePhase = time × STRIDE_FREQ
  armL.rotation.x = sin(stridePhase) × 0.4
  armR.rotation.x = sin(stridePhase + PI) × 0.4    // opposite phase
  
  // 3. Body sway
  body.rotation.z = sin(stridePhase × 2) × 0.03    // very subtle
```

---

## 8. Ease-In / Ease-Out for Ride Start/Stop

When a ride starts or stops, the speed doesn't jump instantly — it tweens:

```
ride.easeIn(durationMs):
  TWEEN.Tween({ speed: 0 })
    .to({ speed: 1 }, durationMs)
    .easing(TWEEN.Easing.Quadratic.In)
    .onUpdate(({ speed }) => ride.animator.speed = speed)
    .start()

ride.easeOut(durationMs):
  TWEEN.Tween({ speed: ride.animator.speed })
    .to({ speed: 0 }, durationMs)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(({ speed }) => ride.animator.speed = speed)
    .onComplete(() => ride.animator.active = false)
    .start()
```

Duration: easeIn = 1500ms, easeOut = 2000ms (deceleration is slightly slower for realism).

---

## 9. Animation Debug Checklist

- [ ] Gondola world Y rotation remains ≈ 0 while ring rotates (verify with getWorldQuaternion)
- [ ] Carousel horses form a visible sine wave pattern
- [ ] Roller coaster cart never leaves the track (position exactly on curve)
- [ ] Tagada arm2 Z oscillation is at 1.7× frequency of arm1 (verify sin argument)
- [ ] Ride speed multiplier: scroll wheel changes speed smoothly
- [ ] Ease-in/out: no snap at start/stop
- [ ] All animations use `delta` from the clock — frame-rate independent
- [ ] Visitors never clip below ground (y position clamped to 0)
