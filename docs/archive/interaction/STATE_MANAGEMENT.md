# State Management — Luna Park 3D

> Back to [README](../README.md)

---

## 1. State Architecture

The application uses a simple centralized state object with event-emitter subscriptions. No external library (Redux, MobX, etc.) — a lightweight custom implementation is sufficient and avoids dependency bloat.

---

## 2. State Schema

```javascript
// AppState — the single source of truth
const AppState = {
  
  // --- Day/Night ---
  time: {
    value:        12.0,     // 0.0–24.0 (hour of day)
    autoAdvance:  false,    // true = time advances automatically
    speed:        1.0       // time advance speed multiplier
  },
  
  // --- Rides ---
  rides: {
    ferrisWheel: {
      active:       false,
      speed:        1.0,          // 0.2–3.0
      lightColor:   '#ff6666',    // hex string
      selected:     false         // for color picker targeting
    },
    carousel: {
      active:       false,
      speed:        1.0,
      lightColor:   '#66aaff',
      selected:     false
    },
    rollerCoaster: {
      active:       false,
      speed:        1.0,
      lightColor:   '#ffdd44',
      selected:     false
    },
    tagada: {
      active:       false,
      speed:        1.0,
      lightColor:   '#aa44ff',
      selected:     false
    }
  },
  
  // --- Lamps ---
  lamps: {
    // lamp_0 through lamp_11
    'lamp_0': { on: false, manualOverride: false },
    // ... repeated for all 12
  },
  
  // --- Camera ---
  camera: {
    mode:          'orbit',   // 'orbit' | 'flyto' | 'fpv'
    fpvRideId:     null,       // which ride's gondola the FPV is on
    presetView:    null        // 1–6 if on a preset view
  },
  
  // --- UI ---
  ui: {
    helpVisible:   true,
    statsVisible:  false       // development only
  }
}
```

---

## 3. Event Emitter

```javascript
class EventEmitter:
  listeners = {}
  
  on(event, callback):
    if !listeners[event]: listeners[event] = []
    listeners[event].push(callback)
  
  off(event, callback):
    listeners[event] = listeners[event].filter(cb => cb !== callback)
  
  emit(event, payload):
    if listeners[event]:
      listeners[event].forEach(cb => cb(payload))


const StateEvents = new EventEmitter()
```

---

## 4. State Mutations (Actions)

All state changes go through named action functions. Never mutate `AppState` directly outside of these:

```javascript
Actions = {
  
  // TIME
  setTime(value):
    AppState.time.value = clamp(value, 0, 24)
    StateEvents.emit('timeChanged', AppState.time.value)
  
  toggleAutoAdvance():
    AppState.time.autoAdvance = !AppState.time.autoAdvance
    StateEvents.emit('autoAdvanceChanged', AppState.time.autoAdvance)
  
  // RIDES
  toggleRide(rideId):
    ride = AppState.rides[rideId]
    ride.active = !ride.active
    StateEvents.emit('rideToggled', { rideId, active: ride.active })
  
  setRideSpeed(rideId, speed):
    AppState.rides[rideId].speed = clamp(speed, 0.2, 3.0)
    StateEvents.emit('rideSpeedChanged', { rideId, speed })
  
  setRideLightColor(rideId, hexColor):
    AppState.rides[rideId].lightColor = hexColor
    StateEvents.emit('rideLightColorChanged', { rideId, color: hexColor })
  
  selectRide(rideId):
    // Deselect all others
    Object.keys(AppState.rides).forEach(id => AppState.rides[id].selected = false)
    if rideId: AppState.rides[rideId].selected = true
    StateEvents.emit('rideSelected', rideId)
  
  // LAMPS
  toggleLamp(lampId):
    lamp = AppState.lamps[lampId]
    lamp.on = !lamp.on
    lamp.manualOverride = true
    StateEvents.emit('lampToggled', { lampId, on: lamp.on })
  
  setAllLamps(on):
    Object.values(AppState.lamps).forEach(l => {
      if !l.manualOverride: l.on = on
    })
    StateEvents.emit('allLampsChanged', on)
  
  // CAMERA
  setCameraMode(mode, fpvRideId = null):
    AppState.camera.mode     = mode
    AppState.camera.fpvRideId = fpvRideId
    StateEvents.emit('cameraModeChanged', { mode, fpvRideId })
}
```

---

## 5. Subscriptions

Each system subscribes to the events it cares about:

```javascript
// DayNightCycle subscribes to time changes
StateEvents.on('timeChanged', (value) => {
  dayNightCycle.setTimeImmediate(value)
})

// Ride animators subscribe to ride events
StateEvents.on('rideToggled', ({ rideId, active }) => {
  rides[rideId].animator[active ? 'easeIn' : 'easeOut'](1500)
  rides[rideId].controlPanel.semaphore.setColor(active ? GREEN : RED)
})

StateEvents.on('rideSpeedChanged', ({ rideId, speed }) => {
  rides[rideId].animator.setSpeedSmooth(speed)
})

// LightManager subscribes to lamp and colour events
StateEvents.on('lampToggled', ({ lampId, on }) => {
  lamps[lampId].pointLight.intensityTween(on ? 2.5 : 0, 800)
})

StateEvents.on('rideLightColorChanged', ({ rideId, color }) => {
  rides[rideId].decorationLights.forEach(l => l.color.set(color))
  rides[rideId].emissiveMeshes.forEach(m => m.material.emissive.set(color))
})

// UIManager subscribes to reflect state in HTML elements
StateEvents.on('rideToggled', ({ rideId, active }) => {
  // Update any HTML indicator (if present)
})
```

---

## 6. State Persistence

State is **not persisted** between sessions (no localStorage). The scene always starts in the default state (daytime, all rides stopped, lamps off).

This is intentional — for the oral exam, a consistent starting state ensures the demo starts cleanly every time.

---

## 7. Debug Utilities

```javascript
// Print full state at any time (browser console)
window.__debugState = () => console.log(JSON.stringify(AppState, null, 2))

// Subscribe to all events for logging
['timeChanged','rideToggled','lampToggled','cameraModeChanged'].forEach(e => {
  StateEvents.on(e, (payload) => console.debug(`[State:${e}]`, payload))
})
```
