# Post Processing — Luna Park 3D

> Back to [README](../README.md)

---

## 1. Philosophy

Post-processing is scheduled for Phase 4 (polish). The core experience must work beautifully without it. Post-processing is an enhancement, not a crutch.

**Priority order for implementation:**
1. FXAA (anti-aliasing) — replace hardware MSAA, low cost
2. Bloom — ride lights and emissive materials glow at night
3. Tone mapping pass (already in renderer, may not need separate pass)

All post-processing via `THREE.EffectComposer` from Three.js addons (`three/addons/postprocessing/`).

---

## 2. EffectComposer Pass Stack

```
EffectComposer
  ├── RenderPass            ← standard scene render into buffer
  ├── UnrealBloomPass       ← selective glow on bright pixels
  └── ShaderPass(FXAAShader)← final anti-aliasing
```

**Setup pseudocode:**
```
composer = new EffectComposer(renderer)

renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

bloomPass = new UnrealBloomPass(
  resolution: Vector2(window.innerWidth, window.innerHeight),
  strength:   0.35,
  radius:     0.6,
  threshold:  0.75     // only pixels brighter than 75% max bloom
)
composer.addPass(bloomPass)

fxaaPass = new ShaderPass(FXAAShader)
fxaaPass.uniforms.resolution.value.set(1/w, 1/h)
composer.addPass(fxaaPass)
```

**Render loop change:** Replace `renderer.render(scene, camera)` with `composer.render()`.

---

## 3. Bloom Pass

**Purpose:** Emissive ride lights and lamppost glows bleed light into surrounding pixels, creating the classic fairground "glow" effect. This is the single biggest visual improvement post-processing provides.

**Configuration:**
```
strength:   0.35   (subtle; too high looks like a soap opera)
radius:     0.6    (bloom spread width)
threshold:  0.75   (only very bright surfaces bloom)
```

**Effect visibility:** Maximum at night when ride lights are on. Zero effect during bright daytime (no surfaces exceed the threshold).

**Performance cost:** ~1.5ms additional GPU time. Acceptable.

**Alternative if performance is tight:** Use a custom single-pass bloom on just the emissive layer by rendering emissive meshes to a separate buffer, blurring it, and additively blending. More complex but faster.

---

## 4. FXAA Anti-Aliasing

**Purpose:** Smooths jagged edges without the memory cost of MSAA (especially important when the EffectComposer is writing to an off-screen framebuffer — hardware MSAA doesn't apply to intermediate render targets).

**Performance cost:** <0.5ms. Always include.

**Note:** When using EffectComposer, disable the renderer's built-in `antialias` to avoid double-processing:
```
renderer = new WebGLRenderer({ antialias: false })  // FXAA handles this
```
Or keep `antialias: true` on the renderer for Phase 1–3 (before EffectComposer is added), then switch when adding the composer.

---

## 5. Atmospheric Fog (not a post-process, but visual polish)

`THREE.FogExp2` creates exponential density fog that grows with distance:

```
scene.fog = new THREE.FogExp2(
  color:   0xC9E8FF,  (pale blue sky-matching fog)
  density: 0.004       (subtle; objects fade at ~150+ units)
)
```

At night, fog colour changes to dark blue:
```
scene.fog.color.set(0x080820)  // very dark blue at night
```

Fog adds depth perception, makes the park horizon look natural, and hides the hard edge of the ground plane's extent.

---

## 6. Phase 4 Post-Processing Checklist

- [ ] EffectComposer installed and confirmed working (replace renderer.render)
- [ ] RenderPass: scene renders correctly to off-screen buffer
- [ ] BloomPass: ride lights glow at night, no bloom during day
- [ ] FXAA: edges smooth, no performance regression
- [ ] Fog: depth visible, night colour updated during day/night transition
- [ ] Overall: compare screenshot with/without post-processing — visible improvement
- [ ] Performance: total frame time still < 16ms on test machine

---

## 7. Optional: Depth of Field (low priority)

A shallow depth of field pass focusing on the nearest ride while blurring the background could add a cinematic "photography" aesthetic:

- Use `THREE.BokehPass` or a custom CoC (Circle of Confusion) pass
- Focus distance: auto-follow the camera's `orbitControls.target` distance
- Not recommended unless performance budget allows (adds ~2ms)
