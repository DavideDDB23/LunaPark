# Shader Plan — Luna Park 3D

> Back to [README](../README.md)

---

## Overview

Two custom GLSL shaders are planned to add visual quality beyond what standard Three.js materials provide:

1. **Emissive Blink Shader** — animated ride/lamp light pulsing at night
2. **Ground Blend Shader** — smooth texture transition between grass and asphalt paths

Both shaders use `THREE.ShaderMaterial` or `THREE.MeshStandardMaterial.onBeforeCompile` injection. The injection approach is preferred because it keeps full PBR lighting behaviour while extending the fragment shader.

---

## Shader 1 — Emissive Blink Shader

### Purpose
At night, small bulb meshes on ride structures should pulse rhythmically. Using a standard `emissiveIntensity` animated in JS (CPU-side) works but creates per-material update overhead. A GPU shader driven by a single `uTime` uniform is more efficient.

### Approach: `onBeforeCompile` injection

Inject a `uTime` uniform into the MeshStandardMaterial fragment shader to modulate `emissiveColor` before final output:

```glsl
// INJECT AT TOP OF FRAGMENT SHADER
uniform float uTime;
uniform float uBlinkSpeed;
uniform float uBlinkMin;
uniform float uBlinkMax;

// INJECT INTO #include <emissivemap_fragment>
// Replace standard emissive with animated version:
float blinkFactor = uBlinkMin + (uBlinkMax - uBlinkMin) 
                    * (0.5 + 0.5 * sin(uTime * uBlinkSpeed));
totalEmissiveRadiance *= blinkFactor;
```

### Uniforms
| Uniform | Type | Default | Description |
|---|---|---|---|
| `uTime` | float | 0.0 | elapsed time in seconds |
| `uBlinkSpeed` | float | 3.0 | oscillation frequency (rad/s) |
| `uBlinkMin` | float | 0.3 | minimum intensity factor |
| `uBlinkMax` | float | 1.5 | maximum intensity factor |
| `uActive` | float | 0.0 | 0=off (day), 1=on (night) |

### Implementation pseudocode
```
EmissiveBlinkMaterial extends MeshStandardMaterial:
  
  constructor(baseColor, emissiveColor):
    super({
      color: baseColor,
      emissive: emissiveColor,
      emissiveIntensity: 1.0,
      roughness: 0.1,
      metalness: 0.0
    })
    
    this.userData.uniforms = {
      uTime:       { value: 0.0 },
      uBlinkSpeed: { value: 3.0 },
      uBlinkMin:   { value: 0.3 },
      uBlinkMax:   { value: 1.5 },
      uActive:     { value: 0.0 }
    }
    
    this.onBeforeCompile = (shader) => {
      // Merge userData.uniforms into shader.uniforms
      Object.assign(shader.uniforms, this.userData.uniforms)
      
      // Inject uniform declarations at top of fragment shader
      shader.fragmentShader = '#include <uv_pars_fragment>\n'
        + uniformDeclarations
        + shader.fragmentShader
      
      // Replace emissive calculation chunk
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        emissiveBlinkChunk
      )
    }
  
  tick(time, isNight):
    this.userData.uniforms.uTime.value  = time
    this.userData.uniforms.uActive.value = isNight ? 1.0 : 0.0
```

### Update in animation loop
```
animationManager.register({
  tick: (delta, time) => {
    emissiveBlinkMaterials.forEach(mat => mat.tick(time, dayNightCycle.isNight))
  }
})
```

---

## Shader 2 — Ground Blend Shader

### Purpose
Where the asphalt paths meet the grass ground, there is currently a hard UV boundary. A blend shader uses a mask texture to create a smooth natural-looking transition.

### Approach: Full ShaderMaterial (not injection)

Since the ground plane is a single mesh, a `ShaderMaterial` replaces its `MeshStandardMaterial`. This gives full control over UV calculations while maintaining manual lighting via Three.js's built-in light uniforms.

However, to keep PBR lighting behaviour, the preferred approach is `onBeforeCompile` on a `MeshStandardMaterial`, injecting a second UV channel and blend logic into the `map_fragment` chunk.

### Blend Logic (pseudocode-level GLSL)

```glsl
// Uniforms
uniform sampler2D uGrassAlbedo;
uniform sampler2D uAsphaltAlbedo;
uniform sampler2D uBlendMask;      // R channel: 1=grass, 0=asphalt
uniform sampler2D uGrassNormal;
uniform sampler2D uAsphaltNormal;
uniform float uBlendSoftness;      // controls transition width

// In fragment shader
vec2 uv = vUv * 40.0;              // world-scaled UV for tiling
float blendFactor = texture2D(uBlendMask, vUv).r;
blendFactor = smoothstep(0.4, 0.6, blendFactor);   // soft edge

vec4 grassColor   = texture2D(uGrassAlbedo,   uv);
vec4 asphaltColor = texture2D(uAsphaltAlbedo, uv * 0.2);  // different repeat

vec4 finalColor = mix(asphaltColor, grassColor, blendFactor);

// Same for normals
vec3 grassNormal   = texture2D(uGrassNormal,   uv).rgb;
vec3 asphaltNormal = texture2D(uAsphaltNormal, uv * 0.2).rgb;
vec3 finalNormal   = normalize(mix(asphaltNormal, grassNormal, blendFactor));
```

### Blend Mask Texture
A 512×512 greyscale texture painted to match the path layout:
- White (1.0) = pure grass
- Black (0.0) = pure asphalt path
- Grey gradient at edges = blend zone

This texture can be procedurally generated on an offscreen canvas at startup — no external file needed.

```
Blend mask generation pseudocode:
  canvas = 512×512
  ctx.fillStyle = white  (grass everywhere)
  ctx.fillRect(0, 0, 512, 512)
  
  // Draw black path shapes matching path geometry layout
  // Centre cross: two rectangles in normalised path coordinates
  ctx.fillStyle = black
  ctx.fillRect(pathRect_NS)
  ctx.fillRect(pathRect_EW)
  
  // Apply Gaussian blur to soften edges
  gaussianBlur(radius=12)
  
  blendMaskTexture = new DataTexture(canvas.imageData)
```

---

## Shader 3 — Sky Gradient (optional, Phase 4)

If the simple HDRI skybox does not provide a smooth enough sky transition during the day/night cycle, a procedural sky gradient shader on the skybox geometry can blend between three colour states (noon blue, sunset orange, night black) using the `uDayTime` uniform.

```glsl
uniform float uDayTime;     // 0.0 = midnight, 0.5 = noon
uniform vec3 uNoonSkyTop;
uniform vec3 uNoonSkyHorizon;
uniform vec3 uSunsetColor;
uniform vec3 uNightColor;

// Vertex
varying vec3 vWorldPosition;

// Fragment
float elevation = normalize(vWorldPosition).y;  // -1 to +1

// Day sky gradient
vec3 dayColor = mix(uNoonSkyHorizon, uNoonSkyTop, max(elevation, 0.0));

// Night sky colour
vec3 nightColor = uNightColor;

// Blend by time of day
float nightFactor = 1.0 - clamp(sin(uDayTime * PI) * 2.0, 0.0, 1.0);
vec3 skyColor = mix(dayColor, nightColor, nightFactor);

// Sunset orange band at horizon
float sunsetBand = exp(-abs(elevation) * 8.0) * sunsetFactor;
skyColor = mix(skyColor, uSunsetColor, sunsetBand);

gl_FragColor = vec4(skyColor, 1.0);
```

---

## Shader Update in Animation Loop

All shaders with `uTime` must be updated every frame:

```
animationManager.register({
  name: 'shaderUpdate',
  tick: (delta, time) => {
    // Emissive blink shader(s)
    emissiveBlinkMaterials.forEach(m => {
      m.userData.uniforms.uTime.value = time
    })
    
    // Sky gradient
    skyMaterial.uniforms.uDayTime.value = dayNightCycle.time
  }
})
```

---

## Shader Debugging

- Use `#define SHOW_NORMALS` debug define to visualise normal maps in world space
- Use `#define SHOW_BLEND_MASK` to visualise the blend mask directly as albedo
- Chrome WebGL Inspector extension for shader inspection at runtime
- Three.js `material.wireframe = true` to check geometry topology
