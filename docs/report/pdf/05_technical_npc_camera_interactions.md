## Section 4 — Technical Implementation (Part B): NPC Visitors, Camera, and User Interactions

### 4.12 NPC Visitors and Procedural Walk Cycle

The park is populated by 10 non-player character (NPC) visitors that roam the entire park continuously. Their implementation spans approximately 900 lines of code in `Visitors.js` and covers pathfinding, a four-layer procedural gait engine, visual variety, and crowd separation — all without importing any animation data.

#### 4.12.1 State Machine and Waypoints

Each NPC operates a simple two-state machine: **WAIT** ↔ **WALK**. On arrival at a waypoint, the NPC waits for a randomly selected duration between 1 and 5 seconds, then selects a new destination from the waypoint graph and begins walking toward it.

The waypoint graph covers the entire park: path intersections, ride entrances, food stall areas, the stage perimeter, the bridge, the train platform, and the shooting gallery entrance. The graph was hand-authored by placing waypoints at semantically meaningful locations in world space.

#### 4.12.2 A* Pathfinding on a Navigation Grid

Continuous path queries between arbitrary waypoints use **A*** (A-star) on a coarse occupancy grid implemented in `NavGrid.js`. The grid divides the park area into cells of `CELL = 2` world-unit squares. Each cell is flagged as blocked if it overlaps any obstacle: rides, buildings, trees (seeded at load time), the river (except at the bridge crossing), or the fence perimeter.

The A* heuristic is the Euclidean distance from the current cell to the goal. The cost function adds a penalty for cells adjacent to obstacles, guiding visitors to prefer the centre of paths over walking close to walls.

After the A* search returns the shortest grid path, a **string-pulling** step removes redundant intermediate waypoints wherever a straight line-of-sight exists between non-adjacent path nodes. This produces smooth, direct-looking routes without the artificial stair-stepping of raw grid paths.

#### 4.12.3 Bridge and River Handling

The river runs diagonally across the park. The only crossing is the central bridge. The navigation grid marks all river cells as impassable except for the bridge cells. When an NPC walks over the bridge, its world Y position is overridden with a pre-baked bridge deck height, ensuring that it walks on top of the bridge planks rather than sinking into the river mesh.

#### 4.12.4 Procedural Gait Engine

The NPC walk cycle is fully synthesised in JavaScript — no AnimationMixer, no pre-recorded clips. The gait engine operates in four layers applied bottom-up each frame:

**Layer 1 — Foot Targets and Phase**: Each foot alternates between a *stance phase* (planted on the ground) and a *swing phase* (airborne). A single phase variable advances by `distance / GAIT.stride` each frame (proportional to distance travelled), ensuring that stride length and ground speed always agree — foot-skate is eliminated by construction.

In the *stance phase*, the planted foot target is held fixed in world space while the body moves over it, so the foot's world velocity is exactly zero.

In the *swing phase*, the foot follows a Hermite arc: it lifts to `GAIT.stepH × legLength` above the ground at the arc midpoint, with the take-off and landing velocities matched to the stance slide (ensuring C1 continuity at step transitions). Heel-strike dorsiflexion at landing and toe-off plantarflexion at take-off pivot the ankle realistically.

**Layer 2 — Two-Bone Leg IK**: Given the world-space foot target from Layer 1, analytic two-bone IK places the thigh and shin bones. The IK is calibrated from the skeleton's own geometry at spawn: the thigh length and shin length are measured from the actual bone positions in the bind pose, so the solution works correctly across all 14 outfit variants (which may have different proportions). The knee pole vector points forward along the NPC's facing direction.

**Layer 3 — Pelvis Rhythm**: The pelvis (root bone) is animated with:
- A vertical bob at twice the step frequency (`GAIT.bob × legLength × sin(2 × phase × 2π)`), so the pelvis rises when both feet are on the ground and dips at mid-swing.
- A lateral weight shift toward the stance leg (`GAIT.sway`).
- A yaw counter-rotation against the stepping leg and a roll (list) counter-phased with the lateral shift.

**Layer 4 — Trunk and Limbs**: The spine counter-rotates against the pelvis (to preserve visual centre of mass), the upper body leans slightly forward proportional to speed (`GAIT.lean`), the arms swing with `GAIT.armSwing × sin(phase × 2π + arm_lag)` (opposite phase to the same-side leg), the elbows flex during the forward swing (`GAIT.elbow`), and the head stabilises against the shoulder rotation.

#### 4.12.5 Visual Variety and Crowd Separation

Visual variety is achieved through two mechanisms:
1. **14 outfit variants**: the Quaternius character pack includes characters in casual, sports, formal, and other styles.
2. **HSL hue shift**: each NPC's outfit colour is randomised by rotating the hue channel of its base texture by a random offset, giving each character a subtly different colour without duplicating meshes.

To prevent NPCs from overlapping, a **separation force** is applied each frame: if any two NPCs are closer than a minimum distance, they are pushed apart along the direction between them.

---

### 4.13 Passenger System

The passenger system (`Passengers.js`) is a shared infrastructure used by all rides to populate seats with realistic human figures.

#### 4.13.1 Template Loading

`loadVisitorTemplates(n)` loads `n` distinct character GLBs from the Quaternius pack, strips all animation data, and returns an array of template `Object3D` trees. These templates are never added to the scene directly; they serve only as cloning sources.

#### 4.13.2 Rider Lifecycle

```
makeRider(template, scene)     → rider object (bones resolved, added to scene)
updateRider(rider, pos, quat, action)  → position + pose applied each frame
```

`makeRider` clones the template, traverses the skeleton to cache references to key bones by name (`Spine`, `Head`, `UpperArm.L`, etc.), and adds the clone to the scene at a temporary off-screen position.

`updateRider` is called once per frame per passenger. It sets the root's world position and quaternion, then applies a procedural pose from the `action` parameter. Available actions for seated passengers include: `'rest'`, `'lookL'`, `'lookR'`, `'lookUp'`, `'point'`, `'relax'`, `'cheer'`, `'wave'`.

#### 4.13.3 Seated Leg Pose

`applyChairSeatedLegs(rider)` sets the thigh bones to ~90° hip flexion and the shin bones to ~90° knee flexion, placing the feet naturally below the seat. This is called for carousel jockeys and Tagada disc riders, where the standard standing pose would result in legs clipping through the platform.

`setPassengerWorldHeight(rider, y)` overrides the rider root's world Y coordinate after the standard `updateRider` transform, used by the coaster to prevent riders from going underground when the cart passes through a dip.

---

### 4.14 Camera System

The camera system (`CameraManager.js`) manages four distinct camera modes: orbit, fly-to, preset, and FPV.

#### 4.14.1 Orbit Mode

The default camera mode uses Three.js `OrbitControls` with the following configuration:

| Parameter | Value | Effect |
|---|---|---|
| `enableDamping` | `true` | Smooth momentum decay after mouse release |
| `dampingFactor` | `0.08` | Moderate damping speed |
| `minDistance` | `5` | Prevents clipping into objects |
| `maxDistance` | `250` | Keeps the scene within view |
| `maxPolarAngle` | `0.49π` | Prevents camera from going underground |

#### 4.14.2 Click-to-Fly

A `THREE.Raycaster` tests every mouse click against all interactive scene objects (registered as `interactiveObjects`). If the ray intersects the ground plane or any mesh, the hit point becomes the new camera focus. A `TWEEN` animates both `camera.position` and `controls.target` over `FLY_DURATION = 1.2 s` with `Quadratic.InOut` easing:

```js
new TWEEN.Tween({ t: 0 })
  .to({ t: 1 }, FLY_DURATION * 1000)
  .easing(TWEEN.Easing.Quadratic.InOut)
  .onUpdate(({ t }) => {
    camera.position.lerpVectors(flyFrom, flyTo, t);
    controls.target.lerpVectors(lookFrom, lookTo, t);
  })
  .start();
```

The destination camera position is computed by offsetting 22 units from the hit point at a fixed height of 12 units, along the direction from the hit point toward the current camera position.

#### 4.14.3 Preset Viewpoints

Six hardcoded camera positions provide instant access to key views (keyboard keys 1–6):

| Key | Position | Target | View |
|---|---|---|---|
| 1 | (70, 60, 70) | (0, 0, 0) | Full park overview |
| 2 | (−10, 25, −10) | (−50, 22, −50) | Ferris Wheel close-up |
| 3 | (15, 18, −15) | (40, 5, −40) | Carousel |
| 4 | (−25, 25, 15) | (52, 15, 54) | Roller Coaster (full loop) |
| 5 | (−15, 18, 15) | (−40, 0, 40) | Tagada |
| 6 | (0, 14, −58) | (0, 4, −88) | Stage |

Each preset is reached via the same TWEEN animation as click-to-fly.

#### 4.14.4 First-Person View (FPV) Cameras

Pressing **C** when close to a ride enters FPV mode. The camera is attached to a ride-specific bone or node and updated each frame:

| Ride | FPV Attachment | Camera Offset |
|---|---|---|
| Ferris Wheel | Gondola seat bone | (0, +1.5, 0) — head height |
| Roller Coaster | Front cart seat | Rider head position |
| Tagada | Disc seat node | Rider head position |
| Train | Locomotive cabin | (0, +1.5, 0) |
| Hot Air Balloon | Basket rider head | (0, 0, 0) |

In FPV mode, `OrbitControls` is disabled and `camera.position` / `camera.quaternion` are set directly from the ride node's world transform each frame. Pressing **ESC** exits FPV: the camera tweens back to the pre-FPV position and target over 0.8 s.

---

## Section 5 — User Interactions

This section documents every user interaction implemented in the project, how it is triggered, and what happens internally.

### 5.1 Interaction Infrastructure

#### InteractionManager

`InteractionManager.js` maintains a single `THREE.Raycaster` that is updated on every `pointermove` and `click` event. All interactive objects (ride panels, lampposts, stage spotlights, ground, ride meshes) are registered in typed arrays. On click, the raycaster tests each typed array in priority order and dispatches the appropriate event via `eventBus`.

#### ControlPanel

Each ride has a 3D in-world control panel (`ControlPanel.js`), a small kiosk-style structure placed beside the attraction. The panel displays:
- A **semaphore bulb** that glows red (stopped) or green (running).
- A **lever** that tilts forward when the ride is on.

Clicking the panel emits `'ride-toggle'` on the event bus; the ride responds by starting or stopping its speed ramp.

#### RideHints

`RideHints.js` places four proximity-fade billboard sprites near the rides. When the camera approaches within a configurable radius, the sprite becomes visible and shows the text "Press C for FPV". The opacity is driven by `smoothstep(distance, minDist, maxDist)`.

#### RideHotbar

`RideHotbar.js` renders an HTML bar at the bottom of the screen with named buttons for each ride. Clicking a button is equivalent to pressing C near the corresponding ride — it immediately enters FPV mode for that attraction.

### 5.2 Complete Interaction Reference

| Interaction | Trigger | Internal Mechanism |
|---|---|---|
| Fly camera to point | Left-click on ground, ride, or scenery | `Raycaster` → `CameraManager.flyToWorldPoint()` TWEEN |
| Toggle ride on/off | Left-click on ride control panel | `Raycaster` → `ControlPanel.toggle()` → speed ramp TWEEN |
| Toggle lamppost | Left-click on lamppost | `Raycaster` → 3-state cycle (Auto → Manual-off → Manual-on → Auto) → 0.8 s intensity TWEEN |
| Toggle stage spotlight | Left-click on stage faretto | Same 3-state mechanism as lamppost |
| Adjust ride speed | Scroll wheel while hovering over ride | `InteractionManager` → `ride.adjustSpeed(±delta)` → speed clamped [0.2×, 1.5×] |
| Preset viewpoint 1–6 | Keys `1`–`6` | `CameraManager.flyToPreset(n)` TWEEN |
| Enter FPV | Key `C` when near a ride | `CameraManager.enterFPV(closestRide)` |
| Exit FPV / aim mode | `ESC` | `CameraManager.exitFPV()` → tween back to pre-FPV position |
| Pause/resume time | `Space` | Toggle `DayNightCycle` auto-advance flag |
| Orbit camera | Left mouse drag | `OrbitControls` |
| Pan camera | Right mouse drag | `OrbitControls` |
| Zoom camera | Scroll wheel (not over ride) | `OrbitControls` |
| Set time of day | HUD time slider | `DayNightCycle.setHour(value)` |
| Change decoration colour | HUD colour picker | `eventBus.emit('ride-color-change', hex)` → all ride PointLights + emissive mats update |
| Shoot (gallery) | Left-click in pointer-lock aim mode | Ray from screen centre, `Raycaster` vs targets → score += multiplier, target spins and resets |
| Hover cursor | Mouse move over any clickable object | `document.body.style.cursor = 'pointer'` / `'default'` driven by raycaster result |

### 5.3 Shooting Gallery Interaction

The shooting gallery (`ShootingGallery.js`) uses the browser's **Pointer Lock API** for a first-person aim experience:

1. The user clicks the shooting booth sign or the gallery's control panel to enter aim mode.
2. The camera flies to a fixed FPV position in front of the targets.
3. `canvas.requestPointerLock()` hides and locks the cursor; subsequent mouse movements rotate the aim reticle.
4. A large reticle HUD overlay (`<canvas>` positioned with CSS) shows a crosshair and the score.
5. Left-clicking fires a ray from the screen centre. If the ray hits a target, that target spins around its axis (a brief TWEEN), increments the score (with a distance-based multiplier), and resets after 2 s.
6. A countdown timer runs for 30 s; when it expires, the score is frozen and the game returns to orbit mode.
7. `ESC` exits aim mode at any time; `document.exitPointerLock()` is called and the camera tweens back to orbit.

### 5.4 Design Rationale for Key Interactions

**Click-to-fly** was chosen over a traditional WASD movement system because the park is large and spread out. Clicking a ride or stall and having the camera glide to it gives the user a sense of navigating a physical space without the friction of manual movement.

**3-state lamppost toggle** (Auto → Manual-off → Manual-on → Auto) was implemented because the day/night cycle auto-manages all lampposts. A simple on/off toggle would be immediately overridden the next time the cycle updated. The three-state design allows the user to override the auto state persistently while still being able to return to automatic control.

**Scroll-to-adjust-speed** was placed on ride hover (rather than a slider) to keep the 3D world immersive — the user can adjust a ride's speed while looking at it, without switching context to a 2D panel.
