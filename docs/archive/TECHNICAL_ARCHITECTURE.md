# Technical Architecture — Luna Park 3D

> Back to [README](README.md)

---

## 1. High-Level Architecture

```
Browser (WebGL Context)
│
├── Three.js WebGLRenderer
│   └── Scene Graph (THREE.Scene)
│       ├── Environment Group
│       │   ├── GroundPlane
│       │   ├── PathNetwork
│       │   ├── Fence
│       │   ├── LampostGroup [×12]
│       │   ├── FoodStallGroup [×6]
│       │   ├── Stage
│       │   └── SkyBox
│       ├── RidesGroup
│       │   ├── FerrisWheel (hierarchical subtree)
│       │   ├── Carousel (hierarchical subtree)
│       │   ├── RollerCoaster (hierarchical subtree)
│       │   └── Tagada (hierarchical subtree)
│       ├── CharactersGroup
│       │   └── Visitor [×8..12]
│       └── LightGroup
│           ├── HemisphereLight
│           ├── DirectionalLight (sun)
│           ├── PointLight [×12] (lampposts)
│           └── SpotLight (stage)
│
├── AnimationManager         ← drives all per-frame updates
├── InteractionManager       ← raycaster, click events, keyboard
├── DayNightCycle            ← time controller, light transitions
├── CameraController         ← orbit + fly-to + FPV modes
└── StateManager             ← global app state, ride states
```

---

## 2. Module Architecture

### 2.1 `main.js` — Entry Point & Render Loop

Responsibilities:
- Initialise Three.js (renderer, scene, camera, clock)
- Load all managers
- Construct scene groups in dependency order
- Run `requestAnimationFrame` loop calling `update(delta)` on each manager
- Handle window resize

Key pseudocode flow:
```
init():
  renderer = WebGLRenderer({ antialias: true })
  scene = Scene()
  camera = PerspectiveCamera(60, aspect, 0.1, 2000)
  clock = Clock()
  
  await loadAllAssets()        // GLBLoader + TextureLoader
  buildEnvironment()
  buildRides()
  buildCharacters()
  buildLights()
  buildUI()
  
  animate()

animate():
  delta = clock.getDelta()
  TWEEN.update()
  animationManager.update(delta)
  dayNightCycle.update(delta)
  characterSystem.update(delta)
  cameraController.update(delta)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
```

---

### 2.2 Scene Graph Design

Three.js uses a parent-child transform hierarchy. Every child's world transform = parent.matrixWorld × child.matrix.

**Environment subtree** — static geometry, no per-frame updates:
```
environmentGroup (THREE.Group)
  ├── groundMesh        PlaneGeometry(200,200) rotated -90° on X
  ├── pathGroup         multiple PlaneGeometry patches
  ├── fenceGroup        instanced fence segments
  ├── lampostGroup      12× lamp objects with PointLight children
  ├── stallGroup        6× stall objects
  └── skyMesh           BoxGeometry(1000,1000,1000) inverted normals
```

**FerrisWheel subtree** — complex hierarchical example:
```
ferrisWheelRoot (THREE.Group)  ← positioned in world space
  ├── hubMesh           static central cylinder
  ├── outerRing         rotates Y by ω*delta each frame
  │   ├── arm_0..7      (8× arms, static relative to ring)
  │   │   └── gondola   rotates Y by −ω*delta (counter-rotation)
  │   │       ├── gondolaMesh
  │   │       └── passenger_A, passenger_B  (oscillate ±5° Z)
  └── controlPanel      clickable; userData.ride = this
```

The gondola counter-rotation is the key technical demonstration:
- `ring.rotation.y += omega * delta`  
- `gondola.rotation.y -= omega * delta`  
- Net effect: gondola world orientation unchanged → always hangs vertically  
- This is the textbook example of composed hierarchical transforms (Lecture 05)

---

### 2.3 AnimationManager

Manages all time-based animations. Receives `delta` from the render loop.

Design pattern: each animated object registers itself with a `tick(delta, time)` callback.

```
AnimationManager:
  registeredAnimators = []
  
  register(animator):
    registeredAnimators.push(animator)
  
  update(delta):
    elapsedTime += delta
    for each animator:
      if animator.active:
        animator.tick(delta, elapsedTime)
```

Each ride class implements the `Animator` interface:
```
interface Animator:
  active: boolean
  speed: number        (multiplier, default 1.0)
  tick(delta, time): void
  easeIn(duration): void   // tween speed 0→1
  easeOut(duration): void  // tween speed 1→0
```

---

### 2.4 InteractionManager

Wraps Three.js Raycaster. Handles all mouse/touch events.

```
InteractionManager:
  raycaster = Raycaster()
  mouse = Vector2()
  
  onMouseDown(event):
    mouse = normalizedDeviceCoordinates(event)
    raycaster.setFromCamera(mouse, camera)
    
    // Priority 1: check control panels
    panelHits = raycaster.intersectObjects(controlPanelMeshes)
    if panelHits.length > 0:
      panelHits[0].object.userData.ride.toggle()
      return
    
    // Priority 2: check lampposts
    lampHits = raycaster.intersectObjects(lampostMeshes)
    if lampHits.length > 0:
      lampHits[0].object.userData.lamp.toggle()
      return
    
    // Priority 3: fly-to on ground or any object
    allHits = raycaster.intersectObjects(flyTargetMeshes, recursive=true)
    if allHits.length > 0:
      cameraController.flyTo(allHits[0].point)
```

**Raycasting layers** (THREE.Layers) are used to separate what gets tested:
- Layer 0: default (all)
- Layer 1: control panels only
- Layer 2: lampposts only
- Layer 3: fly targets (ground + rides)

This avoids expensive intersection tests against all scene geometry every frame.

---

### 2.5 CameraController

Three modes:
1. **Orbit mode** — default, uses pointer delta for rotate, scroll for zoom
2. **Fly-to mode** — triggered by click; tween position + lookAt target
3. **FPV mode** — camera parented to gondola node; follows it in world space

```
CameraController:
  mode = 'orbit'   // 'orbit' | 'flyto' | 'fpv'
  
  flyTo(targetPoint):
    destinationPos = targetPoint + UP * MIN_HEIGHT + BACK_OFFSET
    destinationLook = targetPoint
    
    tween = new TWEEN.Tween(camera.position)
      .to(destinationPos, 1200)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate(() => camera.lookAt(lerpedLookTarget))
      .start()
  
  attachToGondola(gondolaNode):
    mode = 'fpv'
    camera.parent = gondolaNode
    camera.position.set(0, 1.2, 0)   // eye height inside gondola
    camera.rotation.set(0, 0, 0)
  
  detachFromGondola():
    mode = 'orbit'
    camera.parent = scene
    camera.position.copy(lastOrbitPosition)
  
  update(delta):
    if mode == 'orbit': handleOrbit(delta)
    if mode == 'fpv': camera follows gondola automatically
```

---

### 2.6 DayNightCycle

Controls the sun position, sky colour, hemisphere light intensity, and lamppost state.

```
DayNightCycle:
  time = 0.0       // 0.0 = midnight, 0.5 = noon, 1.0 = midnight again
  speed = 0.02     // units per second
  
  update(delta):
    if autoAdvance: time = (time + speed * delta) % 1.0
    
    sunAngle = time * TWO_PI - HALF_PI
    sunX = cos(sunAngle) * SUN_RADIUS
    sunY = sin(sunAngle) * SUN_RADIUS
    sunZ = 0
    directionalLight.position.set(sunX, sunY, sunZ)
    
    // Intensity: full at noon (time=0.5), zero at night (time=0 or 1)
    sunIntensity = max(0, sin(sunAngle))
    directionalLight.intensity = sunIntensity * MAX_SUN_INTENSITY
    
    // Sky colour lerp: day blue → night dark blue
    skyColor = lerpColor(DAY_SKY, NIGHT_SKY, 1 - sunIntensity)
    scene.background = skyColor
    hemisphereLight.intensity = 0.3 + 0.7 * sunIntensity
    
    // Lampposts on when sun < horizon
    lampsOn = sunIntensity < 0.15
    if lampsOn != lastLampsState: toggleAllLamps(lampsOn)
```

---

### 2.7 StateManager

Central store for application state. Uses a simple event-emitter pattern.

```
State:
  rides: {
    ferrisWheel:  { active: false, speed: 1.0, lightColor: '#ff6666' }
    carousel:     { active: false, speed: 1.0, lightColor: '#66aaff' }
    rollerCoaster:{ active: false, speed: 1.0, lightColor: '#ffdd44' }
    tagada:       { active: false, speed: 1.0, lightColor: '#aa44ff' }
  }
  
  dayNight: {
    time: 0.5,
    autoAdvance: false
  }
  
  camera: {
    mode: 'orbit',
    attachedRide: null
  }
  
  lamps: {
    [lampId]: { on: true }
  }
```

---

## 3. Asset Loading Pipeline

All assets are loaded at startup via a centralized `AssetLoader`:

```
AssetLoader:
  textureCache = {}
  modelCache   = {}
  
  loadAll():
    await Promise.all([
      loadTextures(TEXTURE_MANIFEST),
      loadModels(MODEL_MANIFEST)
    ])
  
  loadTexture(name, path, options):
    tex = TextureLoader.load(path)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(options.repeat)
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
    textureCache[name] = tex
  
  loadModel(name, path):
    gltf = await GLTFLoader.load(path)
    // Strip any animations (requirement: no imported animations)
    gltf.animations = []
    modelCache[name] = gltf.scene
```

---

## 4. Shader Architecture

Standard materials cover most use cases, but two custom GLSL shaders are planned:

### 4.1 Emissive Blink Shader (ride lights at night)
Applied to small bulb meshes on ride structures. Uniform `uTime` drives a sin-based intensity oscillation. Detail in [SHADER_PLAN.md](graphics/SHADER_PLAN.md).

### 4.2 Ground Blend Shader (grass-to-path transition)
Blends two texture sets based on a hand-painted mask texture, avoiding hard UV seams where grass meets asphalt path. Detail in [SHADER_PLAN.md](graphics/SHADER_PLAN.md).

---

## 5. Performance Architecture

Target: **60 fps on a mid-range laptop** (integrated Intel/AMD GPU).  
Minimum: **30 fps during oral exam presentation.**

Key strategies:
- Instanced rendering for repetitive geometry (fence posts, lamp copies)
- LOD switching for distant objects (THREE.LOD)
- Frustum culling (Three.js built-in — do not disable)
- Shadow map limited to 1 DirectionalLight with 2048×2048 map
- PointLights: only 4 with shadows (near rides); remaining 8 lampposts non-shadow
- Texture budgets: ground/sky 2K; close objects 1K; distant 512
- Draw call batching via `BufferGeometry` merging for static environment

Full strategy in [PERFORMANCE_OPTIMIZATION.md](graphics/PERFORMANCE_OPTIMIZATION.md).

---

## 6. Dependency Graph

```
main.js
├── AssetLoader (no deps)
├── EnvironmentBuilder ← AssetLoader
├── RidesBuilder       ← AssetLoader
├── CharacterSystem    ← AssetLoader, EnvironmentBuilder (waypoints)
├── AnimationManager   ← RidesBuilder, CharacterSystem
├── LightManager       ← EnvironmentBuilder
├── DayNightCycle      ← LightManager
├── InteractionManager ← RidesBuilder, LightManager, CameraController
├── CameraController   ← RidesBuilder (gondola nodes)
└── StateManager       ← all managers subscribe to it
```

Build order: AssetLoader → Environment → Rides → Characters → Lights → DayNight → Interaction → Camera → State → AnimationManager → UI → RenderLoop

---

## 7. File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Classes | PascalCase | `FerrisWheel.js` |
| Instances/vars | camelCase | `ferrisWheelInstance` |
| Constants | SCREAMING_SNAKE | `MAX_SUN_INTENSITY` |
| Textures | snake_case | `grass_albedo_2k.jpg` |
| Models | snake_case | `lamppost_lowpoly.glb` |
| Shader uniforms | `u` prefix | `uTime`, `uBlendMask` |
| Shader attributes | `a` prefix | `aPosition`, `aNormal` |
| Shader varyings | `v` prefix | `vUV`, `vNormal` |
