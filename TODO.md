# Luna Park — What Still Needs to Be Built
> Environment is complete. Everything below is what's missing.
> Deadline: email to marco.schaerf@uniroma1.it before **June 20, 2026 at 23:59**
> Exam session: **June 24, 2026**

---

## ✅ Already Done — Environment

- [x] Grass ground with PBR textures
- [x] Asphalt paths (cross layout + central circle)
- [x] HDR sky with day / sunrise / sunset / night crossfade shader
- [x] Day/night cycle — sun orbit, hemisphere light, tone mapping, bg intensity
- [x] 12 lampposts that auto-turn on at night
- [x] Stage spotlight that activates at night
- [x] Park perimeter fence
- [x] 6 food stalls
- [x] Central stage with octagonal platform, pillars, roof, curtains, marquee bulbs
- [x] Entrance gate with "LUNA PARK" canvas sign
- [x] Vegetation — trees, bushes, plants, grass, flowers (Quaternius models)
- [x] Park benches
- [x] River with animated water shader (waves, caustics, foam, specular)
- [x] Fish in the river (animated clown fish with skeleton)
- [x] Rocks
- [x] Ferris Wheel (counter-rotating gondolas, 8 gondolas, 2 passengers each, passenger sway)
- [x] Carousel (rotating platform, cone canopy, 8 horses with phase-offset bobbing, jockeys, control panel)
- [x] Night fireworks (particle burst system synced with day/night cycle — 3 burst types: spherical, corona, willow)
- [x] Hot air balloon (drifts with wind, 3 tether cables, night glow, random initial position)
- [x] Panoramic train (CatmullRom ring track, locomotive + 3 wagons, control panel, night bulbs)
- [x] Shooting gallery (10 targets, FPV aim mode with pointer lock, score + timer, camera shake on hit)

---

## 🔴 RIDES — The Core of the Project

All four rides must be built from scratch using Three.js geometry.
No imported animations — all motion is JavaScript math.

### 1. Ferris Wheel ✅
- [x] Large rotating ring with 8 gondolas hanging from it
- [x] The gondolas must stay upright while the ring spins — **counter-rotation**: each gondola rotates in the opposite direction of the ring by the exact same amount, so it always stays level
- [x] 2 passengers per gondola, gently swaying
- [x] Placed in the **northwest** area of the park (around −40, 0, −40)

### 2. Carousel ✅
- [x] Rotating platform with a decorated canopy (cone roof) on top
- [x] 8 horses mounted on poles around the platform
- [x] Horses bob up and down as the carousel spins — each horse at a different phase so they form a wave
- [x] A small jockey figure sitting on each horse, moving with it
- [x] Placed in the **northeast** area (around +40, 0, −40)
- [x] Fix legs in `passengers.js` (use `applyChairSeatedLegs` and apply some rotation)

### 3. Roller Coaster ✅
- [x] A looping curved track built from a smooth mathematical curve (CatmullRom spline)
- [x] The track forms a closed loop with climbs and valleys
- [x] A cart rides along the track, always facing the direction of travel and tilting with the curves (parallel-transport frame, better than Frenet)
- [x] Cart goes faster in valleys and slower on climbs (physics-inspired variable speed)
- [x] Placed in the **southeast** area (around +52, 0, +54)

### 4. Tagada (Mechanical Arm Ride) ✅
- [x] A heavy mechanical arm that oscillates back and forth on two axes simultaneously, creating a compound unpredictable motion
- [x] At the end of the arm, a circular seat platform that spins fast independently
- [x] 8 seats arranged around the disc, each with a passenger
- [x] Placed in the **southwest** area (around −40, 0, +40)
- [x] Fix legs in `passengers.js` (`applyChairSeatedLegs`)
- [x] Fix position of some passenger models (some are clipped into the chair)
- [x] Fix arm override (hands-up animation) when the ride is on
- [x] When the ride is off, the platform must return to a neutral position to allow passenger loading and unloading
- [x] Remove the two pistons that cross the central mast ("albero") of the Tagada

---

## 🔴 CONTROL PANELS — One Per Ride

Each ride has a small 3D control panel placed next to it.

- [x] Each panel has a **semaphore light** (red = stopped, green = running)
- [x] Each panel has a **lever** that tips forward when the ride is on
- [x] Clicking a panel starts or stops its ride
- [x] Starting a ride: speed eases in gradually over ~1.5 seconds
- [x] Stopping a ride: speed eases out gradually over ~2 seconds
- [x] **Verificare e unificare i tempi di RAMP_UP/RAMP_DOWN** in tutti i pannelli. Attualmente:
  - `ControlPanel.js` default: 0.5s up, 0.5s down
  - `Train.js`: passa `rampUp: 1.5, rampDown: 2.0` ✅
  - `FerrisWheel.js`: dichiara `RAMP_UP=1.5, RAMP_DOWN=2.0` ma **NON** li passa al costruttore — usa i default 0.5s (bug!) ✅ **FIXED**
  - `Coaster.js`, `Tagada.js`, `Carousel.js`: usano i default 0.5s — deciso di lasciare 0.5s per coerenza col comportamento rapido di toggle

---

## 🔴 CAMERA & NAVIGATION

- [x] **Click-to-fly**: click anywhere in the scene (ground, ride, stall) and the camera smoothly flies to that point over ~1.2 seconds with easing
- [x] **6 preset viewpoints**: pressing keys 1–6 flies instantly to preset camera positions (overview, Ferris Wheel close-up, Carousel, Roller Coaster, Tagada, Stage)
- [x] **FPV Gondola Camera**: press C when close to the Ferris Wheel → camera enters a gondola and you ride it from the inside. Press ESC to exit back to normal view.
- [x] **FPV Train Camera**: press C when close to the train → camera enters the locomotive cabin. Press ESC to exit.
- [x] **FPV Roller Coaster Camera**: press C when close to the roller coaster → FPV view from the front car.
- [x] **FPV Tagada Camera**: press C when close to the Tagada → FPV view from a seat.

---

## 🔴 INTERACTIONS

- [x] **Click lampposts**: individual lamppost click toggles that lamp on or off (with a smooth tween, 0.8s)
- [x] **Scroll wheel near a ride**: hovering the mouse over a ride and scrolling changes that ride's speed (up = faster, down = slower)
- [x] **Ride decoration light colour picker**: an HTML colour picker that changes the colour of all the decorative lights on the rides
- [x] **Space bar**: toggles the time-of-day auto-advance on/off (time automatically moves forward)
- [x] **Hover cursor**: cursor changes to a pointer hand when hovering over anything clickable
- [x] **In-world ride hints**: show a small in-scene hint near a ride when close (not only HUD 'press C' message) — implemented via `RideHints.js`, 4 sprite billboards with proximity fade

---

## 🔴 TIME OF DAY HUD

A heads-up display showing the current time of day. Already partially designed — needs to be wired in.

- [x] Digital clock showing the current hour:minute (e.g. "14:30")
- [x] Semicircular arc with a sun/moon icon tracking its position across the sky (`drawTimeArc()` in `main.js:498`)
- [x] Day / Dusk / Night phase label (inside `drawTimeArc()`, lines 558–564)
- [x] Manual time slider (drag to change time of day)
- [x] Auto-advance toggle button
- [x] Slow down auto-advance speed (reduce rate of time progression)

---

## 🔴 NPC VISITORS

- [x] 8–12 human visitors walking around the park between waypoints (10 NPCs in `Visitors.js`, 864 lines)
- [x] Each visitor is a simple human figure (body, head, two arms) (procedural gait + analytic leg IK)
- [x] They walk toward a destination, stop and wait 1–5 seconds, then pick a new destination (state machine: wait ↔ walk)
- [x] While walking, arms swing back and forth (walk animation in JS) (speed-scaled arm swing with elbow flex)
- [x] Various body colours / outfits so they look different from each other (14 outfits + HSL shift per NPC)
- [x] They follow the paths — waypoints placed at path intersections and near each ride (A* pathfinding with cost-weighted grid)
---

## 🔴 NPC MODEL CLEANUP

- [ ] **Rimuovere modelli che camminano storti all'indietro** — priorità massima
- [ ] **Rimuovere modelli con caschetto da lavoro** — modifica semplice (cambio outfit/colore)
- [ ] **Rimuovere modelli che danno problemi con le sedute delle giostre** — priorità più bassa

---

## 🔴 VISITOR PATHFINDING — NEW WAYPOINTS

- [x] **Train area waypoints**: add landmarks near train sign (`[76, -65]`) and control panel (`[68, -60]`) in `Visitors.js:465-469`
- [x] **Shooting gallery waypoints**: add landmarks near the booth (`[12, 24]`) and sign (`[11, 20]`)

---

## 🔴 RIDE DECORATION LIGHTS

- [x] Coloured point lights attached to each ride structure
- [x] During the day: off
- [x] During the night: blinking/pulsing with a sine wave, each light slightly out of phase with the others so they don't all blink at the same time
- [x] Colour controlled by the HTML colour picker
- [x] Apply the colour-picker colour to **Tagada** and **Carousel** decoration lights as well (currently only Ferris Wheel and Roller Coaster update)
  ✅ Both now fully update. **Fixed**: `FerrisWheel.js` — `ferrisRimBulbs[]`, `ferrisSpokeBulbs[]`, `ferrisBeaconMat` are now updated by the colour picker too.

---

## 🔴 NIGHT LIGHTING

- [x] **Moonlight**: blue `DirectionalLight` (`0x4466aa`) opposite the sun, intensity 6.0 at zenith ✅ (`DayNightCycle.js:117`)
- [x] **Night hemisphere fill**: intensity baseline 1.20, sky `0x6a8aba` / ground `0x3a3a4a` ✅
- [x] **Tone mapping exposure**: night min 0.80, smoothstep to 1.0 by day ✅
- [x] **Background intensity**: night min 0.65 ✅
- [x] **Environment intensity**: night min 0.75 ✅
- [x] **Lamppost radius**: distance=90 for coverage overlap ✅ (`Lampposts.js`)
- [x] **Water night tint**: `uNight` uniform in `Water.js` brightens river at night ✅
- [x] **Fix spotlight toggle in auto time mode**: 3-state click cycle (Auto → Manual opposite → Manual matching → Auto) ✅
- [x] **Fence string lights**: emissive bulbs along perimeter fence, day/night + color picker aware ✅
- [ ] **Water night tint**: fiume troppo luminoso, sembra emettere luce propria (diminuire o aggiungere faretti su fondale/sponde)

---

## 🔴 HTML UI OVERLAY (top-left panel)

A small HUD panel overlaid on the scene with:

- [x] Time of day slider (0–24h) — already partially wired
- [x] Ride light colour picker
- [x] "?" help button that opens a list of all keyboard/mouse controls
- [x] Auto day/night toggle button
- [x] Improve GUI (top-left): reorganize layout, clarify labels, group controls, and review the actual control content (default values, tooltips, label consistency) ✅

---

## 🔴 TRAIN IMPROVEMENTS

- [x] **Front headlight**: implement a `SpotLight` + visible emissive bulb on the locomotive ✅ (`Train.js:282-313`)
- [x] **Train colour fix**: the train appears white in the browser — fix material cloning in `Train.js:216-242` (shared materials between cloned wagons are not being overridden by `carriageColors`) ✅ (carriageColors applied per-wagon)
- [x] **Train passengers**: add riders to the train wagons using `makeRider`/`updateRider` pattern. ~2 passengers per wagon, 5 wagons total. ✅ (`Train.js:327-348`)
- [x] **Wagons**: the 3 wagons are procedural (BoxGeometry) — find a better GLB model or improve the procedural geometry ✅ Replaced with wacky worm coaster model (locomotive + 3 wagons from single GLB, scale 0.013, auto-calibrated via Box3)

---

## 🔴 BALLOON IMPROVEMENTS

- [x] **Zone-based positioning**: 3 balloons placed in zones with varied heights and drift areas ✅ (`Balloon.js:10-14`)
- [x] **Riders**: passengers seated in each balloon basket ✅ (`Balloon.js` uses `makeRider`/`updateRider`)
- [x] **Drift trajectory**: smooth curved drift using waypoint steering, noise-based wander, wind-affected speed ✅ (multiple commits)
- [x] **FPV camera height**: camera positioned at rider head level inside the basket ✅ (`Balloon.js:126`, `cameraLocalY`)

---

## 🔴 COASTER IMPROVEMENTS

- [x] **Centerline extraction**: rewrote `extractCenterline` with Parallel Transport for correct banking orientation ✅ (commit `d72db69`)
- [x] **Cart orientation**: removed parasitic Z rotation, cart now faces forward with Parallel Transport frame ✅ (commit `df0d2d9`)
- [x] **Passenger seat positioning**: refined rider position, rotation, and elevation on seats ✅ (commits `fbf2636`, `16c61d8`)
- [x] **FPV camera underground at stop**: FPV now tracks rider head position dynamically, no longer goes underground ✅ (unstaged fix in `App.js`)

---

## 🔴 TECHNICAL REPORT (PDF, 10+ pages)

The report is submitted alongside the code. Sections required:

- [ ] **Section 1** — What the project is (concept, tech: Three.js + WebGL + tween.js, author: Davide De Blasio)
- [ ] **Section 2** — Tools used (Three.js r158+, WebGL 2.0, tween.js, GitHub Pages)
- [ ] **Section 3** — All external assets credited (textures, models, HDRIs — licences, sources, authors)
- [ ] **Section 4** — Technical deep-dive (4 pages minimum):
  - Scene graph structure with a diagram showing parent-child relationships
  - How the Ferris Wheel counter-rotation works (mathematical explanation)
  - Carousel horse bobbing formula (phase-offset sine)
  - Roller coaster orientation using Frenet frame (tangent/normal/binormal)
  - Tagada compound oscillation (two simultaneous sine waves on different axes)
  - All lighting types and their roles in the scene
  - PBR material workflow and which texture maps are used
  - Shadow maps: PCF soft shadows, frustum configuration
  - Custom shaders: water (waves + caustics), sky crossfade, emissive blink
- [ ] **Section 5** — All user interactions described (how each one works internally)
- [ ] **Section 6** — Table connecting each course lecture topic to the project feature that demonstrates it
- [ ] **Section 7** — User manual (how to open the project + all controls listed)
- [ ] **Appendix** — Performance numbers (FPS day/night/all rides, draw call count, triangle count)
- [ ] Exported as `luna_park_report.pdf`, placed in the repository root

---

## 🔴 GITHUB PAGES DEPLOYMENT

- [ ] Push everything to a public GitHub repository
- [ ] All asset paths must be relative (no leading `/` — breaks on GitHub Pages)
- [ ] Enable GitHub Pages: Settings → Pages → Deploy from branch → main → / (root)
- [ ] Test the live URL in an incognito window to make sure everything loads
- [ ] Check that `.hdr` files load correctly (GitHub Pages serves them fine; `.exr` sometimes has issues)
- [ ] Add the live URL to `README.md`

---

## 🔴 CAMERA PRESETS

- [x] **Roller Coaster preset (key 4)**: currently `pos: [0, 30, -5], target: [52, 10, 54]` — review framing, may need a more distant/angled position to show the entire loop ✅ **FIXED: pos [-25, 25, 15], target [52, 15, 54]**

---

## 🔴 SHOOTING GALLERY IMPROVEMENTS

- [x] **Move position**: currently at `(30, 0, 25)` — move to a more appropriate location (moved to X=12)
- [x] **Improve structure**: currently all procedural (BoxGeometry/CylinderGeometry) — find a GLB model of a carnival shooting booth (loaded stylized booth GLB and programmatically hid sign text)
- [x] **Implement shooting mode**: the pointer-lock aim system already exists (`ShootingGallery.js`) — verify it works correctly and improve the experience (implemented smooth FPV flight transition, pointer lock camera rotation, custom HUD overlays, Option A moving targets with distance multipliers, and physical pendulum spin damping animation)
- [ ] **Replace booth GLB**: find/import a different carnival booth model to replace `stylized_carnival_booth.glb`
- [ ] **Shooting performance**: clamp `aimYaw` to ±0.18 rad from the initial yaw to prevent looking behind the booth (`ShootingGallery.js:254`). ❌ **Reverted (approccio iniziale non riuscito bene — da rifare con approccio diverso: lock yaw a `euler.y` finché non esce da aim mode)**

---

## 🔴 SUBMISSION

- [ ] Register on Infostud for the **June 24** exam session
- [ ] Send email before **June 20 at 23:59** to `marco.schaerf@uniroma1.it`:
  - Subject: `Interactive Graphics Project — Luna Park — Davide De Blasio — June Session`
  - Body: GitHub repo link + GitHub Pages live demo link + brief feature list
- [ ] Tag the final commit: `v1.0-submission`
- [ ] `luna_park_report.pdf` committed in the repository root
- [ ] **Browser console check**: open the live page and check for any JS warnings/errors, leftover `console.log`, or dead code paths — cleanup before submission
- [ ] No `node_modules` or build artifacts in the repository
- [x] Remove leftover `test_coaster.js` from repository root ✅ **RIMOSSO**

---

## 🔴 ORAL EXAM — Things to Be Ready to Explain

The examiner will ask you to demo the project live and then ask technical questions.

- [ ] Know how to show the Ferris Wheel gondola counter-rotation in the browser console:
  `ferrisWheel.gondolaMounts[0].gondolaMesh.getWorldQuaternion(q)` → the Y value stays ≈ 0 at all times
- [ ] Be able to explain **what the Frenet frame is** and why the roller coaster cart uses it
- [ ] Be able to explain **what raycasting is** and how it differs from ray tracing
- [ ] Be able to explain **what PBR is** and what each texture map (albedo, normal, roughness, metalness) does
- [ ] Be able to explain **PCF shadow maps** — what the filter does and why it avoids hard aliased edges
- [ ] Be able to explain **the rendering equation** and how the hemisphere light approximates it
- [ ] Record a **backup video** of the full demo at 60fps in case the live demo has technical problems
