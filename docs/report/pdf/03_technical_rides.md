## Section 4 — Technical Implementation (Part A): Rides and Animations

### 4.1 Scene Graph and Hierarchical Models

The scene is structured as a standard Three.js scene graph — a tree of `THREE.Object3D` nodes whose transforms compose from parent to child. The root `THREE.Scene` contains two immediate children: `environmentGroup` (static scenery, lighting, sky) and the individual ride/attraction groups. Every node stores a local transform (position, rotation, scale) as a 4×4 matrix; the world transform of any node is the product of all ancestor matrices from root to that node:

```
worldMatrix(node) = worldMatrix(parent) × localMatrix(node)
```

This multiplication is what enables hierarchical animation: rotating a parent rotates all its children in world space without any explicit per-child update.

**Project policy**: every motion in the scene is hand-written JavaScript math. When GLB models are loaded, the custom `loadGLB()` wrapper immediately discards all embedded animation data:

```js
gltf.animations = [];  // strip imported keyframe tracks
```

No `AnimationMixer` is ever instantiated. This guarantees that the motion demonstrated to the examiner is the student's own work.

The full top-level scene graph is:

```
THREE.Scene
├── sky (sky-sphere mesh, frustumCulled = false)
├── sun (DirectionalLight, shadow enabled)
├── moon (DirectionalLight, no shadow)
├── hemi (HemisphereLight)
├── environmentGroup
│   ├── ground, paths, fence, externalScenery
│   ├── lampposts (×12), pathLights (×6)
│   ├── foodStalls (×6), benches, rocks, vegetation
│   ├── stage, entranceGate
│   ├── river (River.js geometry) + water (Water.js ShaderMesh)
│   ├── fish (Fish.js, animated clownfish)
│   └── fireworks (Fireworks.js, GPU particles)
├── ferrisWheel (Group)
├── carousel (Group)
├── coaster (Group → coaster_rideScaled → GLB model)
├── tagada (Group)
├── balloon[0..2] (Group)
├── train (Group)
└── shootingGallery (Group)
```

Each ride group encapsulates its entire sub-tree. For example, the Tagada's hierarchy is:

```
tagada (Group, world position [-40, 0, 40])
├── foundation (Mesh)
├── baseSkirt (Mesh)
├── armPivot (Group)        ← pitch + roll + yaw applied here
│   ├── arm (Mesh)
│   ├── armExtension (Group) ← telescopes vertically for boarding
│   │   └── disc (Group)    ← spins continuously when ride is on
│   │       ├── platform (Mesh)
│   │       ├── canopy (Mesh)
│   │       └── seat[0..7] (Group each, with passenger)
│   └── pistons (Mesh ×2)
└── controlPanel (Group)
```

This three-level Group structure (pivot → arm → disc) allows the compound Tagada oscillation to be implemented by writing to three different `rotation` properties on three different nodes — each node's children inherit all parent rotations automatically.

---

### 4.2 Ferris Wheel — Counter-Rotation

**Construction**: The Ferris Wheel GLB contains a `wheel` node (the rotating ring) and a `cabin` node whose children are the ten individual gondola meshes. The model is authored Z-up with a −90° X-rotation on the root, so the real wheel axis and hub position are measured from world matrices at load time rather than assumed from local coordinates.

**Rotation accumulator**: Each frame, a scalar `wheelSpin` (in radians) is incremented by `rampedSpeed × delta`, where `rampedSpeed = MAX_SPEED × smoothstep(ramp)` and `ramp` is a [0,1] parameter eased in over `RAMP_UP = 1.5 s` and out over `RAMP_DOWN = 2.0 s` when the ride starts or stops.

```js
wheelSpin += rampedSpeed * delta;
wheelNode.setRotationFromAxisAngle(axis, wheelSpin);
```

**Counter-rotation principle**: The fundamental requirement is that every gondola must remain upright (i.e., its opening always faces down) regardless of where it is on the rotating ring. Each gondola node is the child of a `mount` Group that is positioned at the gondola's orbit radius. The mount co-rotates with the ring (it inherits the ring's rotation). The gondola mesh itself is then rotated by exactly `−wheelSpin` about the same axis:

```js
gondolaMesh.setRotationFromAxisAngle(axis, -wheelSpin);
```

The world orientation of the gondola is therefore:

```
worldRot(gondola) = parentRot(mount) + localRot(gondola)
                  = (+wheelSpin) + (−wheelSpin)
                  = 0
```

The gondola's world orientation is identically zero at all times — it is always aligned with the world frame, always upright, exactly as a real Ferris wheel gondola behaves. This is verifiable in the browser console:

```js
const q = new THREE.Quaternion();
ferrisWheel.gondolaMounts[0].gondolaMesh.getWorldQuaternion(q);
// q.y ≈ 0 at all times
```

**Passenger sway**: Each gondola carries 2 passengers. Their bodies lean by `SWAY_AMP × sin(SWAY_FREQ × t + phaseOffset)` radians — a gentle swaying motion that mimics the inertia of a real gondola passenger.

---

### 4.3 Carousel — Phase-Offset Horse Bobbing

**Structure**: The carousel platform is a procedural `CylinderGeometry` disk. Eight horses (carousel_horse.glb, cloned) are mounted at equal angular spacing around a radius of approximately 7.5 world units. Each horse sits atop a procedural pole (`CylinderGeometry`, height ≈ 5 units).

**Platform rotation**: Each frame, `platformAngle += PLATFORM_OMEGA × rampedSpeed × delta`, where `PLATFORM_OMEGA = 0.8 rad/s`. The platform Group is rotated by `platformAngle` about the Y axis.

**Horse bobbing formula**: Each horse `i` (0 ≤ i < 8) has a vertical displacement:

```
y_i(t) = HORSE_BASE_Y + BOB_AMP × sin(2π × HORSE_BOB_FREQ × t + φ_i)
```

where:
- `HORSE_BASE_Y = 2.53` m (rest height on pole)
- `BOB_AMP = 0.9` m (peak-to-peak 1.8 m)
- `HORSE_BOB_FREQ = 1.5` cycles/s
- `φ_i = i × (2π / 8)` — the phase offset is evenly distributed around the full circle

The uniform distribution of phases `{0, π/4, π/2, 3π/4, π, 5π/4, 3π/2, 7π/4}` means that at any instant the eight horses form one complete spatial cycle of a sine wave around the platform — a Mexican-wave (travelling wave) pattern. As the platform rotates, each horse bobs up and down at its own phase, and the wave appears to propagate around the ring.

**Jockeys**: Each of the 8 jockey passengers (`makeRider` clones of the Quaternius pack) is positioned at its horse's world position and inherits the horse's rotation each frame via `updateRider(rider, horseWorldPos, horseWorldQuat, action)`.

---

### 4.4 Roller Coaster — Parallel Transport Frame

The roller coaster implementation is the most algorithmically complex part of the project. It proceeds in four stages: track extraction, spline fitting, frame-field precomputation, and real-time cart placement.

#### 4.4.1 Track Extraction

The rail tube mesh (`Circle.023_build_gen_1_0` in the GLB) is a circle of 24 vertices swept along the track, storing `24 × 395 = 9,480` vertices sequentially. The centroid of each 24-vertex ring is a point on the rail centre-line:

```js
for (let r = 0; r < nRings; r++) {
  const cen = new THREE.Vector3();
  for (let j = 0; j < RAIL_RING; j++) {
    const idx = r * RAIL_RING + j;
    cen.x += pos.getX(idx); cen.y += pos.getY(idx); cen.z += pos.getZ(idx);
  }
  cen.multiplyScalar(1 / RAIL_RING);
  rawPts.push(cen);
}
```

The 395 raw centroids are then low-pass filtered (3 iterations of `(p_{i-1} + 2p_i + p_{i+1})/4`) to remove high-frequency mesh-vertex noise, and down-sampled to `CURVE_SAMPLES = 80` evenly-spaced control points.

#### 4.4.2 CatmullRom Spline

The 80 control points are passed to `THREE.CatmullRomCurve3(ctrlPts, true, 'catmullrom', 0.5)`. The `true` flag closes the curve into a loop. `arcLengthDivisions = 20000` is set so that `curve.getPointAt(u)` and `curve.getTangentAt(u)` are accurate arc-length parameterisations — `u ∈ [0,1]` maps linearly to distance along the track.

#### 4.4.3 Parallel Transport Frame (Bishop Frame)

The Frenet frame (tangent / principal-normal / binormal) is the standard approach for orienting objects along a curve. However, it suffers from a well-known defect: the principal normal flips discontinuously at inflection points and is undefined on straight segments (where curvature is zero). For a roller coaster with long straight sections and loops, the Frenet frame would produce unpleasant twisting artefacts.

Instead, the code uses a **Parallel Transport (Bishop) frame**. This frame is initialised at ring 0 with the rail spoke direction closest to world-up, then propagated along the curve by applying the rotation that maps the previous tangent to the current tangent:

```js
const qTrans = new THREE.Quaternion().setFromUnitVectors(prevT, currT);
const projectedPrevU = rawUps[r-1].clone().applyQuaternion(qTrans);
// then snap to the closest spoke of the current ring
```

The result is a frame field that is globally consistent (no twist accumulation) and matches the physical banking of the rail as modelled by the artist. The precomputed field is stored at `NUM_FRAMES = 4000` equally-spaced samples and interpolated by `lerp` each frame.

#### 4.4.4 Cart Orientation

For each carriage at arc-length parameter `u`, the orientation is:

```js
function frameQuat(u, out) {
  curve.getTangentAt(u % 1, _tan).normalize().negate();  // face forward
  getUpVectorAt(u, _up);                                  // parallel-transport up
  _mtx.lookAt(_origin, _tan, _up);
  return out.setFromRotationMatrix(_mtx);
}
```

The negated tangent is used because `Matrix4.lookAt(origin, target, up)` points the object's `−Z` axis toward `target`; negating the tangent makes the cart face the direction of travel.

#### 4.4.5 Energy Model

The coaster's speed varies with altitude to simulate the effect of gravity on a frictionless track. At any position with world height `y`, the speed is:

```
v² = v₀² + 2g(y_top − y)
v = clamp(√(v₀² + 2g(y_top − y)), V_COAST_MIN, V_LAUNCH_MAX)
```

where `y_top` is the highest point on the track, `g = 9.8 world-units/s²`, `V_COAST_MIN = 14`, `V_LAUNCH_MAX = 26`. This produces the characteristic roller coaster rhythm: the cart accelerates on descents and decelerates on crests.

#### 4.4.6 Station State Machine

The ride implements a four-state machine:

| State | Duration | Speed | Transition |
|---|---|---|---|
| `STOP` | `STATION_PAUSE = 3 s` | 0 | → `LAUNCH` after pause |
| `LAUNCH` | until `v ≥ V_LAUNCH_MAX` | accelerates | → `COAST` |
| `COAST` | most of the circuit | energy model | → `BRAKE` near station |
| `BRAKE` | until `v = 0` | decelerates | → `STOP` |

Two trains of four carriages each run simultaneously, offset by 0.5 (half-circuit apart), so the track is always occupied by moving carts.

---

### 4.5 Tagada — Compound Oscillation

The Tagada is a mechanical arm ride. Its characteristic motion arises from the simultaneous application of three independent oscillations on different axes of the `armPivot` Group:

#### 4.5.1 Three-Axis Oscillation

```js
const ramp = smoothstep(speedRamp);  // 0 → 1 as ride starts
armPivot.rotation.x = BASE_PITCH + PITCH_AMP * Math.sin(PITCH_FREQ * t * ramp);
armPivot.rotation.z = ROLL_AMP  * Math.sin(ROLL_FREQ  * t * ramp);
armPivot.rotation.y += ARM_YAW_SPEED * delta * ramp;
```

Constants: `BASE_PITCH = 0.28 rad` (rest tilt), `PITCH_AMP = 0.16 rad`, `PITCH_FREQ = 2.6 rad/s`, `ROLL_AMP = 0.22 rad`, `ROLL_FREQ = 1.9 rad/s`, `ARM_YAW_SPEED = 0.4 rad/s`.

The disc platform at the end of the arm spins at `MAX_SPIN_SPEED = 2.0 rad/s` independently.

#### 4.5.2 Quasi-Periodicity

The pitch frequency (2.6) and roll frequency (1.9) are incommensurable — their ratio `2.6/1.9 = 26/19` is a rational approximation, but the period at which the motion exactly repeats is:

```
T = LCM(2π/2.6, 2π/1.9) ≈ 2π × 19/2.6 ≈ 45.9 s
```

At practical timescales (a few seconds), the combined motion appears quasi-periodic — it never exactly repeats its pattern within the duration of a typical ride cycle. This is what gives the Tagada its characteristic unpredictability.

The trajectory in the (pitch, roll) phase plane traces a Lissajous figure with a near-irrational frequency ratio, filling the bounding rectangle densely over time.

#### 4.5.3 Boarding Mode

When the ride is stopped, passengers need to board at a reasonable height. The code telescopes the arm down by `BOARDING_DROP = 7.5 units`:

```js
new TWEEN.Tween({ t: 0 })
  .to({ t: 1 }, 1000)
  .onUpdate(({ t }) => {
    armExtension.position.y = THREE.MathUtils.lerp(0, -BOARDING_DROP, t);
  })
  .start();
```

When the ride starts, the arm extends back to its full length over the same 1-second duration.

#### 4.5.4 Passenger Jitter

While the ride is running, each seated passenger receives a high-frequency rotational jitter to simulate the physical shaking of the platform:

```
jitter = JITTER_AMP × sin(JITTER_FREQ × t + phaseOffset_i)
```

with `JITTER_FREQ = 14 Hz` and `JITTER_AMP = 0.02 rad`. An additional `BUMP_AMP = 0.04 rad` bump jitter at `BUMP_FREQ = 18 Hz` simulates sharp lateral jolts. The two jitter signals are summed and applied to the passenger's body rotation each frame.
