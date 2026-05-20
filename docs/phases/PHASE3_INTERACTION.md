# Phase 3 — Interaction & Characters (2 → 3)

> Back to [README](../README.md)  
> Prerequisites: [Phase 2](PHASE2_RIDES.md) complete

---

## Goal

Make the scene fully interactive and add NPC visitors. By end of this phase, the project satisfies all core requirements and is examinable.

---

## Deliverables

- Click-to-fly camera navigation (raycaster → tween)
- Day/night cycle (sun orbit + sky transition + auto-lamp activation)
- Individual lamppost click-to-toggle
- Ride speed scroll-wheel modifier
- FPV gondola camera (C key)
- Ride decoration light colour picker
- 8–12 NPC visitors with waypoint-following walk cycle
- HTML UI panel (day/night slider, colour picker, help text)

---

## Step-by-Step

### Step 1 — InteractionManager & Raycaster

Location: `js/interaction/InteractionManager.js`

```
RAYCASTER SETUP:
  raycaster = new THREE.Raycaster()
  
  LAYER CONSTANTS:
    LAYER_DEFAULT  = 0
    LAYER_PANELS   = 1
    LAYER_LAMPS    = 2
    LAYER_RIDES    = 3
    LAYER_GROUND   = 4
  
  INTERACTIVE OBJECT LISTS:
    panelMeshes[]    ← populated when ControlPanel instances created
    lampMeshes[]     ← populated when Lamppost instances created
    rideMeshes[]     ← populated when rides created
    groundMesh       ← the single ground plane
  
  CLICK HANDLER:
    Priority 1: panels → toggleRide
    Priority 2: lamps  → toggleLamp
    Priority 3: rides  → selectRide + flyTo
    Priority 4: ground → flyTo
    
    (See INTERACTION_DESIGN.md for full algorithm)

HOVER HANDLER (throttled 30fps):
  Check intersections on interactive objects
  Change cursor to 'pointer' if anything hit
```

---

### Step 2 — Click-to-Fly Camera

Location: `js/camera/CameraController.js`

```
FLY-TO ALGORITHM:
  flyTo(hitPoint):
    lookTarget  = hitPoint.clone()
    
    // Compute fly position: behind and above the hit point
    // "behind" = direction from hit toward current camera position
    backDir = camera.position.clone().sub(hitPoint).normalize()
    flyPos  = hitPoint.clone()
                .add(backDir.multiplyScalar(15))  // 15 units back
                .setY(max(hitPoint.y + 8, 3))      // 8 above, min 3
    
    startPos    = camera.position.clone()
    startTarget = orbitControls.target.clone()
    
    orbitControls.enabled = false
    
    TWEEN.Tween({ t: 0 })
      .to({ t: 1 }, 1200)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate(({ t }) => {
        camera.position.lerpVectors(startPos, flyPos, t)
        currentTarget.lerpVectors(startTarget, lookTarget, t)
        camera.lookAt(currentTarget)
      })
      .onComplete(() => {
        orbitControls.target.copy(lookTarget)
        orbitControls.enabled = true
      })
      .start()
```

---

### Step 3 — Day/Night Cycle

Location: `js/lighting/DayNightCycle.js`

```
DAY/NIGHT SYSTEM:

  Properties:
    time          = 12.0   (0–24, hour of day)
    autoAdvance   = false
    advanceSpeed  = 0.5    (hours per second when auto)
  
  update(delta):
    if autoAdvance:
      time = (time + advanceSpeed × delta) % 24
    
    // Sun orbit
    angle = (time / 24) × TWO_PI - HALF_PI
    // angle: -PI/2 at midnight, +PI/2 at noon
    
    sunX = cos(angle) × 120
    sunY = sin(angle) × 80
    directionalLight.position.set(sunX, max(sunY, -10), 30)
    directionalLight.target.position.set(0, 0, 0)
    directionalLight.target.updateMatrixWorld()
    
    // Sun intensity
    sunIntensity = max(0, sin(angle))
    directionalLight.intensity = sunIntensity × 2.5
    
    // Sky colour transition
    t = 1 - sunIntensity  // 0 = day, 1 = night
    scene.background = (use PMREMGenerator envMap for day; night mesh for night)
    nightSkyMesh.material.opacity = smoothstep(0.1, 0.4, t)
    
    // HemisphereLight
    skyColor.lerpColors(DAY_SKY_COLOR, NIGHT_SKY_COLOR, t)
    groundColor.lerpColors(DAY_GROUND_COLOR, NIGHT_GROUND_COLOR, t)
    hemisphereLight.color.copy(skyColor)
    hemisphereLight.groundColor.copy(groundColor)
    hemisphereLight.intensity = 0.8 - t × 0.65
    
    // Lamp activation threshold
    IF sunIntensity < 0.15 AND !lampsAlreadyOn:
      Actions.setAllLamps(true)   ← triggers tween via StateEvents
      lampsAlreadyOn = true
    IF sunIntensity > 0.2 AND lampsAlreadyOn:
      Actions.setAllLamps(false)
      lampsAlreadyOn = false
    
    // Ride decoration lights
    rideDecorLightIntensity = max(0, t × 1.5)  ← brighter at night
  
  setTime(hours):
    time = clamp(hours, 0, 24)
    // triggers immediate update (not waiting for next delta tick)
    updateImmediate()
  
  toggleAutoAdvance():
    autoAdvance = !autoAdvance
```

**HTML Slider binding:**
```
daySlider.addEventListener('input', () => {
  Actions.setTime(parseFloat(daySlider.value))
})
// slider: min=0, max=24, step=0.1, value=12
```

---

### Step 4 — Lamppost Toggle

Already partially set up in Phase 1 (lampMesh.userData.lampRef). Implement the toggle method:

```
LampInstance.toggle():
  on = !on
  
  TWEEN.Tween({ intensity: pointLight.intensity })
    .to({ intensity: on ? 2.5 : 0 }, 800)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(({ intensity }) => pointLight.intensity = intensity)
    .start()
  
  // Also toggle emissive on bulb mesh
  bulbMesh.material.emissiveIntensity = on ? 1.5 : 0
```

---

### Step 5 — Ride Speed Modifier

```
SCROLL EVENT HANDLER (from INPUT_SYSTEM.md):
  Store lastMouseNDC from mousemove
  
  wheel event:
    raycaster.setFromCamera(lastMouseNDC, camera)
    hits = raycaster.intersectObjects(rideMeshes, true)
    
    if hits.length > 0:
      ride = hits[0].object.userData.ride
      scrollDelta = event.deltaY > 0 ? -0.15 : +0.15
      newSpeed = clamp(ride.speed + scrollDelta, 0.2, 3.0)
      
      TWEEN.Tween({ s: ride.speed })
        .to({ s: newSpeed }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(({ s }) => ride.animator.speed = s)
        .start()
      
      event.preventDefault()
```

---

### Step 6 — FPV Gondola Camera

```
Activation (C key when within 20 units of ferris wheel):
  
  distance = camera.position.distanceTo(ferrisWheelRoot.position)
  if distance > 20:  display hint "Move closer to Ferris Wheel (C)"
  else:
    savedOrbitPos    = camera.position.clone()
    savedOrbitTarget = orbitControls.target.clone()
    
    // Pick gondola 0 (front-most at time of activation)
    gondola = ferrisWheel.gondolaMounts[0]
    
    orbitControls.enabled = false
    gondola.add(camera)
    camera.position.set(0, 1.2, 0.3)  // slightly forward in gondola
    camera.rotation.set(0, 0, 0)
    
    Actions.setCameraMode('fpv', 'ferrisWheel')

Deactivation:
  gondola.remove(camera)
  scene.add(camera)
  camera.position.copy(savedOrbitPos)
  camera.lookAt(savedOrbitTarget)
  orbitControls.target.copy(savedOrbitTarget)
  orbitControls.enabled = true
  Actions.setCameraMode('orbit')
```

---

### Step 7 — NPC Visitors

Location: `js/characters/Visitor.js` + `js/characters/WaypointGraph.js`

```
WAYPOINT GRAPH:
  Nodes at key path positions:
    centre: (0, 0, 0)
    north:  (0, 0, -80)  south: (0, 0, +80)
    east:   (80, 0, 0)   west:  (-80, 0, 0)
    ne_junction: (10, 0, -10)  nw_junction: (-10, 0, -10)
    se_junction: (10, 0, +10)  sw_junction: (-10, 0, +10)
    near_fw: (-40, 0, -20)     near_car: (+40, 0, -20)
    near_rc: (+40, 0, +20)     near_tag: (-40, 0, +20)
  
  Edges connect adjacent nodes (Manhattan-style path network)

VISITOR CLASS:
  constructor(startWaypoint, bodyColor):
    body:  CylinderGeometry(0.3, 0.3, 1.2) at position (0, 0.6, 0)
    head:  SphereGeometry(0.25, 8, 8)       at position (0, 1.45, 0)
    armL:  CylinderGeometry(0.08, 0.08, 0.7) at (-0.35, 1.0, 0)
    armR:  same at (+0.35, 1.0, 0)
    Flat painted texture per visitor (varied colours)
  
  update(delta, time):
    // State machine
    switch state:
      case 'walking':
        dir = (nextWaypoint - root.position).normalize()
        root.position.addScaledVector(dir, WALK_SPEED × delta)
        root.lookAt(nextWaypoint)
        
        if distanceTo(nextWaypoint) < 0.5:
          state = 'waiting'
          waitTime = random(1.5, 5.0)
          nextWaypoint = waypointGraph.randomAdjacentNode(currentNode)
      
      case 'waiting':
        waitTime -= delta
        if waitTime <= 0: state = 'walking'
    
    // Walk animation
    stride = time × 2.5
    armL.rotation.x =  sin(stride) × 0.5
    armR.rotation.x = -sin(stride) × 0.5

SPAWN 8–12 VISITORS:
  starting positions: various waypoints (spaced out)
  body colours: variety (red, blue, green, yellow, cyan, etc.)
```

---

### Step 8 — UI Overlay

Location: `js/ui/UIManager.js` + HTML in `index.html`

```html
<!-- Add to index.html -->
<div id="ui-overlay">
  <div id="controls">
    <label>Time of Day
      <input id="day-slider" type="range" min="0" max="24" step="0.1" value="12">
    </label>
    <label>Ride Light Colour
      <input id="light-color" type="color" value="#ff6666">
    </label>
    <button id="help-btn">?</button>
  </div>
  <div id="help-panel">
    <p>Click ground → fly there</p>
    <p>Click panel → start/stop ride</p>
    <p>Click lamp → toggle light</p>
    <p>C = gondola FPV camera</p>
    <p>Scroll → change ride speed</p>
    <p>1–6 = preset viewpoints</p>
    <p>Space = auto day/night</p>
  </div>
</div>
```

CSS: positioned absolute, top-left, semi-transparent dark background, white text.

---

### Step 9 — Phase 3 QA

```
INTERACTION CHECKS:
  □ Click ground → camera smoothly flies (1.2s, eased)
  □ Click control panel → ride starts/stops
  □ Click lamppost → light toggles (0.8s tween)
  □ Day slider at 6:00 → low-angle sun, warm colour
  □ Day slider at 20:00 → sun below horizon, lamps on
  □ Scroll near Ferris Wheel → speed changes smoothly
  □ C near wheel → FPV activates (can see gondola arms around you)
  □ ESC → returns to orbit mode
  □ Colour picker changes ride lights immediately

CHARACTER CHECKS:
  □ 8+ visitors moving between waypoints
  □ No visitor goes below ground (y clamped)
  □ Walk animation visible (arms swinging)
  □ Visitors don't all bunch at same waypoint

GIT:
  □ Tag: v0.3-interaction-complete
```
