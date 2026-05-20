# Input System — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Input Sources

| Source | Events | Handler |
|---|---|---|
| Mouse | mousedown, mousemove, wheel | InteractionManager |
| Keyboard | keydown, keyup | InputSystem |
| HTML Slider | input | UIManager → DayNightCycle |
| HTML Color Picker | input | UIManager → LightManager |
| Window | resize | main.js |

---

## 2. Mouse Events

### 2.1 mousedown

```
window.addEventListener('mousedown', (event) => {
  if event.button !== 0: return  // only left click
  
  // Compute normalised device coordinates [-1, +1]
  mouse.x = (event.clientX / window.innerWidth)  * 2 - 1
  mouse.y = (event.clientY / window.innerHeight) * -2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  interactionManager.handleClick(raycaster)
})
```

OrbitControls also listens to `mousedown` — no conflict because OrbitControls checks `button !== 0` for orbit (uses right-click) and we check specifically left-click. When a meaningful interaction is detected, propagation can be stopped.

### 2.2 mousemove (hover cursor)

Runs at low priority, throttled to 30fps to reduce cost:

```
let lastHoverUpdate = 0

window.addEventListener('mousemove', (event) => {
  if Date.now() - lastHoverUpdate < 33: return  // ~30fps throttle
  lastHoverUpdate = Date.now()
  
  mouse.x = ...
  mouse.y = ...
  raycaster.setFromCamera(mouse, camera)
  
  hits = raycaster.intersectObjects(interactiveObjects, true)
  canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default'
})
```

### 2.3 wheel (scroll)

```
window.addEventListener('wheel', (event) => {
  // Determine which ride the cursor is over
  raycaster.setFromCamera(lastMousePos, camera)
  rideHits = raycaster.intersectObjects(rideMeshes, true)
  
  if rideHits.length > 0:
    ride = rideHits[0].object.userData.ride
    scrollDelta = event.deltaY > 0 ? -0.1 : +0.1
    ride.setSpeedSmooth(clamp(ride.speed + scrollDelta, 0.2, 3.0))
    event.preventDefault()   // prevent page scroll
  // else: default orbit controls zoom applies
})
```

---

## 3. Keyboard Events

All key handlers go through a central `InputSystem` to avoid scattered event listeners.

```
InputSystem:
  keyState = {}   // currently held keys
  
  init():
    window.addEventListener('keydown', (e) => {
      keyState[e.code] = true
      this.onKeyDown(e.code)
    })
    window.addEventListener('keyup', (e) => {
      keyState[e.code] = false
    })
  
  onKeyDown(code):
    switch code:
      case 'KeyC':
        if cameraController.mode == 'orbit' AND
           camera.position.distanceTo(ferrisWheelPos) < 20:
          cameraController.activateFPV(ferrisWheel.gondoles[0])
        else if cameraController.mode == 'fpv':
          cameraController.deactivateFPV()
      
      case 'Escape':
        if cameraController.mode == 'fpv':
          cameraController.deactivateFPV()
      
      case 'Digit1': cameraController.flyTo(VIEWPOINTS.overview)
      case 'Digit2': cameraController.flyTo(VIEWPOINTS.ferrisWheel)
      case 'Digit3': cameraController.flyTo(VIEWPOINTS.carousel)
      case 'Digit4': cameraController.flyTo(VIEWPOINTS.rollerCoaster)
      case 'Digit5': cameraController.flyTo(VIEWPOINTS.tagada)
      case 'Digit6': cameraController.flyTo(VIEWPOINTS.stage)
      
      case 'Space':
        dayNightCycle.toggleAutoAdvance()
      
      case 'KeyR':
        allRides.forEach(r => r.toggle())  // start/stop all rides simultaneously
```

---

## 4. HTML UI Events

The `UIManager` bridges HTML element events to the Three.js scene.

```
UIManager:
  
  init():
    daySlider = document.getElementById('day-slider')
    colorPicker = document.getElementById('light-color')
    helpToggle = document.getElementById('help-btn')
    
    daySlider.addEventListener('input', () => {
      dayNightCycle.setTime(daySlider.value / 24)
    })
    
    colorPicker.addEventListener('input', () => {
      selectedRide?.setLightColor(colorPicker.value)
    })
    
    helpToggle.addEventListener('click', () => {
      document.getElementById('help-panel').classList.toggle('visible')
    })
```

---

## 5. Window Resize

```
window.addEventListener('resize', () => {
  w = window.innerWidth
  h = window.innerHeight
  
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  
  renderer.setSize(w, h)
  
  // Update FXAA pass resolution if using EffectComposer
  fxaaPass?.uniforms.resolution.value.set(1/w, 1/h)
  
  // Update bloom pass resolution
  bloomPass?.setSize(w, h)
})
```

---

## 6. Input Conflict Resolution

| Situation | Resolution |
|---|---|
| OrbitControls left-drag vs. click | OrbitControls only activates on `mousemove` after `mousedown`; a click with no move is intercepted by InteractionManager |
| Scroll near a ride vs. page scroll | `event.preventDefault()` on scroll when over a ride mesh |
| C key in text input (if any UI) | Check `event.target.tagName` — ignore keyboard shortcuts when focus is on an HTML input |
| ESC from FPV vs. browser default | FPV deactivation is handled first; browser ESC default (exit fullscreen) still applies after |
