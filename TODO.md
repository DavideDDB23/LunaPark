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

---

## 🔴 RIDES — The Core of the Project

All four rides must be built from scratch using Three.js geometry.
No imported animations — all motion is JavaScript math.

### 1. Ferris Wheel
- [ ] Large rotating ring with 8 gondolas hanging from it
- [ ] The gondolas must stay upright while the ring spins — **counter-rotation**: each gondola rotates in the opposite direction of the ring by the exact same amount, so it always stays level
- [ ] 2 passengers per gondola, gently swaying
- [ ] Placed in the **northwest** area of the park (around −40, 0, −40)

### 2. Carousel
- [ ] Rotating platform with a decorated canopy (cone roof) on top
- [ ] 8 horses mounted on poles around the platform
- [ ] Horses bob up and down as the carousel spins — each horse at a different phase so they form a wave
- [ ] A small jockey figure sitting on each horse, moving with it
- [ ] Placed in the **northeast** area (around +40, 0, −40)

### 3. Roller Coaster
- [ ] A looping curved track built from a smooth mathematical curve (CatmullRom spline)
- [ ] The track forms a closed loop with climbs and valleys
- [ ] A cart rides along the track, always facing the direction of travel and tilting with the curves (Frenet frame orientation)
- [ ] Cart goes faster in valleys and slower on climbs (physics-inspired variable speed)
- [ ] Placed in the **southeast** area (around +40, 0, +40)

### 4. Tagada (Mechanical Arm Ride)
- [ ] A heavy mechanical arm that oscillates back and forth on two axes simultaneously, creating a compound unpredictable motion
- [ ] At the end of the arm, a circular seat platform that spins fast independently
- [ ] 8 seats arranged around the disc, each with a passenger
- [ ] Placed in the **southwest** area (around −40, 0, +40)

---

## 🔴 CONTROL PANELS — One Per Ride

Each ride has a small 3D control panel placed next to it.

- [ ] Each panel has a **semaphore light** (red = stopped, green = running)
- [ ] Each panel has a **lever** that tips forward when the ride is on
- [ ] Clicking a panel starts or stops its ride
- [ ] Starting a ride: speed eases in gradually over ~1.5 seconds
- [ ] Stopping a ride: speed eases out gradually over ~2 seconds

---

## 🔴 CAMERA & NAVIGATION

- [ ] **Click-to-fly**: click anywhere in the scene (ground, ride, stall) and the camera smoothly flies to that point over ~1.2 seconds with easing
- [ ] **6 preset viewpoints**: pressing keys 1–6 flies instantly to preset camera positions (overview, Ferris Wheel close-up, Carousel, Roller Coaster, Tagada, Stage)
- [ ] **FPV Gondola Camera**: press C when close to the Ferris Wheel → camera enters a gondola and you ride it from the inside. Press ESC to exit back to normal view.

---

## 🔴 INTERACTIONS

- [ ] **Click lampposts**: individual lamppost click toggles that lamp on or off (with a smooth tween, 0.8s)
- [ ] **Scroll wheel near a ride**: hovering the mouse over a ride and scrolling changes that ride's speed (up = faster, down = slower)
- [ ] **Ride decoration light colour picker**: an HTML colour picker that changes the colour of all the decorative lights on the rides
- [ ] **Space bar**: toggles the time-of-day auto-advance on/off (time automatically moves forward)
- [ ] **Hover cursor**: cursor changes to a pointer hand when hovering over anything clickable

---

## 🔴 TIME OF DAY HUD

A heads-up display showing the current time of day. Already partially designed — needs to be wired in.

- [ ] Digital clock showing the current hour:minute (e.g. "14:30")
- [ ] Semicircular arc with a sun/moon icon tracking its position across the sky
- [ ] Day / Dusk / Night phase label
- [ ] Manual time slider (drag to change time of day)
- [ ] Auto-advance toggle button

---

## 🔴 NPC VISITORS

- [ ] 8–12 human visitors walking around the park between waypoints
- [ ] Each visitor is a simple human figure (body, head, two arms)
- [ ] They walk toward a destination, stop and wait 1–5 seconds, then pick a new destination
- [ ] While walking, arms swing back and forth (walk animation in JS)
- [ ] Various body colours / outfits so they look different from each other
- [ ] They follow the paths — waypoints placed at path intersections and near each ride

---

## 🔴 RIDE DECORATION LIGHTS

- [ ] Coloured point lights attached to each ride structure
- [ ] During the day: off
- [ ] During the night: blinking/pulsing with a sine wave, each light slightly out of phase with the others so they don't all blink at the same time
- [ ] Colour controlled by the HTML colour picker

---

## 🔴 HTML UI OVERLAY (top-left panel)

A small HUD panel overlaid on the scene with:

- [ ] Time of day slider (0–24h) — already partially wired
- [ ] Ride light colour picker
- [ ] "?" help button that opens a list of all keyboard/mouse controls
- [ ] Auto day/night toggle button

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

## 🔴 SUBMISSION

- [ ] Register on Infostud for the **June 24** exam session
- [ ] Send email before **June 20 at 23:59** to `marco.schaerf@uniroma1.it`:
  - Subject: `Interactive Graphics Project — Luna Park — Davide De Blasio — June Session`
  - Body: GitHub repo link + GitHub Pages live demo link + brief feature list
- [ ] Tag the final commit: `v1.0-submission`
- [ ] `luna_park_report.pdf` committed in the repository root
- [ ] No `node_modules` or build artifacts in the repository

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

---

## 📋 Order to Build Things

```
1st  →  AnimationManager + Ferris Wheel (counter-rotation is the key graded feature)
2nd  →  Carousel (horses bobbing)
3rd  →  Roller Coaster (track curve + Frenet cart)
4th  →  Tagada (compound arm)
5th  →  Control panels for all 4 rides
6th  →  Click-to-fly camera + raycasting interactions
7th  →  FPV gondola camera
8th  →  NPC visitors
9th  →  Time HUD + UI overlay fully wired
10th →  Emissive blink lights on rides
11th →  Performance check + GitHub Pages
12th →  Technical report
13th →  Submit
```
