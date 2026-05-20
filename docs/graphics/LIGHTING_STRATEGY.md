# Lighting Strategy — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Lighting Philosophy

The Luna Park scene uses a layered lighting approach that mimics the progression from a bright summer afternoon to a festive evening. This allows a single scene to demonstrate multiple lighting conditions and dynamic light management — a key visual differentiator during the oral exam.

**Three lighting states:**
1. **Day** — Bright directional sun, blue sky ambient, all lamps off
2. **Golden Hour** — Low-angle warm sun, orange/pink sky, some lamps activating
3. **Night** — No sun, dark sky, all lamps on, ride lights glowing, emissive materials visible

---

## 2. Light Inventory

| Light | Type | Count | Shadow | Purpose |
|---|---|---|---|---|
| Sun | DirectionalLight | 1 | Yes (2K PCF) | Primary outdoor illumination, shadows |
| Sky Ambient | HemisphereLight | 1 | No | Blue-sky ambient + warm ground bounce |
| Lampposts | PointLight | 12 | No (4 may cast shadow) | Night park illumination |
| Stage | SpotLight | 1 | Yes (1K) | Central performance area |
| Ride Decorations | PointLight | 4–8 (small) | No | Coloured festive ride glow |
| Ride Fill | AmbientLight | 1 (very low) | No | Prevents completely black shadow areas |

**Total: 20–27 lights** — within WebGL hardware limits (typically 8–16 per draw call in Three.js forward rendering, but Three.js handles this automatically by batching).

**Performance note:** Only the DirectionalLight and SpotLight cast shadows. All PointLights are non-shadow-casting. This is the single most important performance decision in the lighting system.

---

## 3. Sun — DirectionalLight

### Properties
```
color:     0xFFFAE0  (warm white, like afternoon sun)
intensity: 2.5       (at noon; lerps to 0 at horizon)
position:  orbits on XZ circle, Y = sin(angle) × SUN_RADIUS
```

### Day/Night Orbit
The sun is modelled as a point on a hemisphere orbiting the scene centre:

```
sunAngle   = (dayTime / 24) × TWO_PI − HALF_PI
sunX       = cos(sunAngle) × 120
sunY       = sin(sunAngle) × 80      (Y scaled lower — sun doesn't go below park)
directionalLight.position.set(sunX, max(sunY, −10), 30)
directionalLight.intensity = max(0, sin(sunAngle)) × MAX_INTENSITY
```

At `sunAngle = 0` (noon): full intensity from directly above.  
At `sunAngle = ±π/2` (sunrise/sunset): low-angle light, warm golden colour.  
At night: intensity = 0, light disabled.

### Shadow Camera
```
shadow.camera: OrthographicCamera
  left/right: ±120    (covers full park footprint)
  top/bottom: ±120
  near:        0.1
  far:        300
```

Shadow camera must follow the sun's position: `directionalLight.shadow.camera.updateProjectionMatrix()` called after position change.

### Colour Transition
```
DAY_SUN_COLOR    = 0xFFFAE0  (white-yellow)
GOLDEN_SUN_COLOR = 0xFF8C42  (orange-gold)
sunColor = lerp(DAY_SUN_COLOR, GOLDEN_SUN_COLOR, sunsetFactor)
```
Where `sunsetFactor = 1 − clamp((sunY / 20), 0, 1)`.

---

## 4. Sky Ambient — HemisphereLight

```
skyColor:    0x87CEEB  →  0x1A1A3A  (day blue → night dark)
groundColor: 0x8B7355  →  0x1A1208  (warm dirt → dark soil)
intensity:   0.8        →  0.15      (day → night)
```

The HemisphereLight provides directionless ambient light that distinguishes sky-facing surfaces (lit by sky color) from ground-facing surfaces (lit by ground color). This gives depth without the flatness of a uniform `AmbientLight`.

**Course connection:** This approximates the integral of indirect illumination from the sky hemisphere — the ambient term of the rendering equation (Lecture 13).

---

## 5. Lamppost PointLights

### Properties (each)
```
color:     0xFFDD88  (warm incandescent yellow)
intensity: 0         (OFF by default)  →  2.5 when ON
distance:  15        (physical attenuation, zero beyond this)
decay:     2         (physically-correct inverse-square falloff)
castShadow: false
```

### Activation Logic
Managed by `DayNightCycle`:
```
IF directionalLight.intensity < LAMP_ACTIVATION_THRESHOLD:
  SET all lamppost PointLights intensity to LAMP_ON_INTENSITY
  TWEEN intensity 0 → 2.5 over 2000ms (soft activation)
ELSE:
  TWEEN intensity 2.5 → 0 over 1000ms
```

### Individual Toggle
Any lamppost can be individually toggled by the user clicking on it. This creates an override state that the DayNightCycle respects:
```
lamp.userData.manualOverride = true
lamp.userData.state = 'on' | 'off'
```

The DayNightCycle skips lamps with `manualOverride = true`.

---

## 6. Stage SpotLight

```
color:     0xFFFFFF
intensity: 2.0
position:  (0, 20, -80)
target:    (0, 0, -80)  (stage centre)
angle:     Math.PI / 8  (22.5° half-angle)
penumbra:  0.2          (10% soft edge)
decay:     1
castShadow: true
shadow.mapSize: 1024 × 1024
```

The SpotLight animates in auto mode: a slow sweep oscillation covering the stage.
```
spotLight.position.x = sin(time × 0.3) × 5
spotLight.target.position.x = sin(time × 0.3) × 3
```

---

## 7. Ride Decoration Lights

Small coloured PointLights attached to each ride structure. Only visible/impactful at night.

```
rideLightColor = STATE.rides[rideName].lightColor  (user-adjustable)
rideLights: [
  { position: (rim position), intensity: 0.8, distance: 5 }
]
```

These lights blink at night using the emissive blink shader's timing:
```
at night: rideLightIntensity = 0.6 + sin(time × 3 + phaseOffset) × 0.4
at day:   rideLightIntensity = 0
```

**Colour picker interaction:** The user can change the colour of all decoration lights on a selected ride from the UI. This triggers:
```
rideLights.forEach(l => l.color.set(newHexColor))
rideMesh.emissiveColor.set(newHexColor)
```

---

## 8. Night Scene Appearance

When time = night:
- DirectionalLight intensity = 0 (disabled)
- HemisphereLight intensity = 0.15, colours = dark
- All 12 lamppost PointLights ON at intensity 2.5
- 4–8 ride decoration PointLights ON (coloured)
- StageSpotLight ON
- Night skybox visible
- Emissive materials on buildings and ride bulbs fully visible
- Shadow casting from DirectionalLight: disabled (no sun = no shadow pass)

---

## 9. Light Performance Budget

WebGL forward rendering applies all lights per fragment. Three.js bundles light data into uniform arrays. The practical limit is ~16 non-directional lights per material before performance degrades noticeably.

**Strategy:** Split the scene into lighting zones using `light.layers`. Each PointLight only illuminates its local area:

```
lamppost_N25 light.layers.set(1)   ← north path zone
lamppost_N50 light.layers.set(1)   ← same zone
lamppost_E25 light.layers.set(2)   ← east path zone
...
```

This prevents the fragment shader from summing 27 lights for every fragment — only 3–5 lights affect any given area.

---

## 10. Lighting Debug Checklist

- [ ] No shadow acne on ground (check bias values)
- [ ] No shadow peter-panning (shadowBias not too large)
- [ ] Shadow frustum exactly covers park (no wasted resolution)
- [ ] PointLight attenuation: light falls off naturally at distance
- [ ] Night transition: no abrupt pop — all transitions are tweened
- [ ] Performance: <3ms for shadow pass on test machine
- [ ] Normal maps visible: surfaces show depth under directional light
- [ ] Emissive materials readable at night without other lights
