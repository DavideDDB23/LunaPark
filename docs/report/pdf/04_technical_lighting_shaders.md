# Section 4 — Technical Deep-Dive (Part B): Lighting, Shaders, PBR, and Shadows

---

## 4.6 Lighting System

### 4.6.1 Motivation and the Rendering Equation

The rendering equation, as formulated by Kajiya (1986), states that the outgoing radiance at a surface point is the sum of emitted radiance and the integral of incoming radiance weighted by the BRDF and a cosine foreshortening factor over the hemisphere. Real-time rasterisation cannot solve this integral analytically, and the Luna Park scene accordingly employs a structured approximation decomposed into three semantically distinct light categories: ambient (indirect), direct sunlight, and artificial night lighting. Each category targets a different physical phenomenon and is tuned to remain perceptually plausible across the full twenty-four-hour diurnal cycle simulated by the application.

### 4.6.2 Ambient Sky — HemisphereLight

Indirect illumination, the dominant component of outdoor scenes, is approximated by a single `HemisphereLight` (`hemi`). A hemisphere light emits two colours — one from the upper hemisphere (representing sky scatter) and one from the lower hemisphere (representing ground-bounce diffuse) — and interpolates linearly between them based on the surface normal's elevation angle. This is a first-order spherical-harmonics approximation of environmental irradiance and is sufficient for low-frequency indirect contribution without the cost of probe captures or irradiance volumes.

The sky colour is animated in three distinct regimes corresponding to the diurnal phase:

| Phase | Sky Colour | Ground Colour |
|---|---|---|
| Daytime | `0x87ceeb` (clear blue) | `0x8b7355` (earth brown) |
| Twilight | `0xff9970` (warm orange) | blended intermediate |
| Night | `0x2a3a64` (deep navy) | `0x12121f` (near-black) |

The intensity of the hemisphere light is driven by the vertical position of the sun: `intensity = 0.35 + 0.50 * sunHeight`, where `sunHeight` is the normalised y-component of the sun direction vector clamped to `[0, 1]`. At solar noon `sunHeight ≈ 1.0`, yielding a hemisphere intensity of `0.85`; at night `sunHeight = 0`, reducing it to `0.35` — a residual that models moonlight scatter and city light pollution rather than leaving the scene in absolute darkness.

### 4.6.3 Direct Sunlight — Directional Light

The primary direct illumination source is a `DirectionalLight` that represents parallel solar radiation. Its colour is animated along a warm-to-neutral trajectory as the sun rises from the horizon: the sunrise colour is a saturated orange-gold (high red, moderate green, zero blue) consistent with Rayleigh-scattering-induced reddening at low solar elevations, transitioning toward near-white `(1.0, 1.0, 0.95)` at solar noon, where the atmosphere is traversed by the shortest optical path.

Intensity ramping employs a `smoothstep` function of `sunHeight` to avoid linear transitions that would produce perceptibly artificial slope discontinuities at the horizon. The S-curve of `smoothstep` is well-suited to this application because the human visual system is sensitive to rate-of-change rather than absolute level: by compressing both the very-bright and very-dark ends of the transition range, the function produces a subjectively natural dawn and dusk that matches photographic reference.

The directional light also bears sole responsibility for shadow casting in the scene (see §4.8).

### 4.6.4 Moonlight

A secondary `DirectionalLight` represents reflected moonlight. Its position is set opposite to the sun's — specifically, it shares the sun's angular trajectory but with negated x and y components — so it rises when the sun sets and vice versa. Its maximum intensity is `0.40`, reached at `t = 0` (midnight), and its colour is a cool blue-grey (`0x4466aa`), consistent with the spectral distribution of sunlight filtered by the Moon's albedo and the colour-appearance shifts that the human visual system applies in scotopic conditions. The moon light does not cast shadows; at night intensities, shadow-map artefacts on low-albedo night surfaces would be visually indistinguishable from genuine contact shadows and would contribute unnecessary GPU cost.

### 4.6.5 Artificial Night Lighting

Four distinct categories of artificial luminaire are activated at night, each responding to the `'time-phase-change'` event dispatched by the application's `eventBus`:

1. **Lamppost Point Lights** — Twelve `PointLight` instances are positioned at the tops of the park's decorative lampposts. Each has `distance = 90` units, using Three.js's physically motivated quadratic distance attenuation (`intensity / (1 + d²/range²)`), and emits a warm yellow colour. Their `decay` exponent is set to `2.0` (physically correct inverse-square law). They activate automatically when `isNightNow()` returns `true`.

2. **Stage Spotlight** — A single `SpotLight` is mounted above the central performance stage and targets the stage platform geometry via a tracked `target` object. Its cone angle and penumbra are tuned so that the illuminated area covers the stage without spilling excessively onto neighbouring attractions.

3. **Path Spotlights** — Six additional `SpotLight` instances are positioned at path intersections to simulate pedestrian-area luminaires. These cast relatively wide cones at low elevation angles, ensuring navigational legibility of the park's ground plane during night mode.

4. **Ride Decoration Point Lights** — Each major ride carries one or more coloured `PointLight` instances that blink in a phase-staggered sinusoidal pattern. The intensity envelope is computed per-frame on the CPU as `emissiveIntensity = 0.3 + 0.7 * sin(freq * t + phaseOffset)²`, with each light receiving a unique `phaseOffset` so that no two lights pulse in synchrony. Colour is configurable at runtime through an HTML colour picker, allowing users to customise the park's light palette; the selected colour is propagated to both the `PointLight.color` and the corresponding `MeshStandardMaterial.emissive` property to maintain consistency between light emission and surface glow.

---

## 4.7 Day/Night Cycle

### 4.7.1 Time Parameterisation

The diurnal cycle is governed by a normalised time parameter `t ∈ [0, 1]`, where the mapping to solar time is:

| `t` value | Solar event |
|---|---|
| `0.00` | Midnight |
| `0.25` | Sunrise |
| `0.50` | Solar noon |
| `0.75` | Sunset |
| `1.00` | Midnight (wrap) |

This parameterisation ensures continuity at the `t = 0 / t = 1` boundary and allows all time-dependent quantities to be expressed as pure functions of `t`.

### 4.7.2 Sun Position Derivation

The sun's position in world space is derived geometrically. A phase angle `angle = (t − 0.25) * 2π` places the sun at the horizon (`sin(angle) = 0`) at both sunrise and sunset, and at the zenith (`sin(angle) = 1`) at solar noon. The resulting world-space direction vector is:

```
sunY = sin(angle)
sunX = −cos(angle)
sunZ = 0   (East–West plane)
```

The negative cosine ensures that the sun rises from the East side of the scene coordinate system. The `sunHeight` scalar used throughout the lighting code is simply `sunY` after clamping to `[0, 1]`.

### 4.7.3 Tone-Mapping Exposure and Background Intensity

Two additional quantities are derived from `sunHeight` to ensure that the rendered image's apparent brightness tracks the scene luminance plausibly:

- **Tone-mapping exposure**: `lerp(0.48, 1.0, smoothstep(sunHeight, −0.05, 0.4))` — at night the exposure is `0.48`, lifting shadow detail that would otherwise be invisible; at full daylight it reaches `1.0`. This is passed to Three.js's `renderer.toneMappingExposure` property.

- **Background (sky) intensity**: `lerp(0.34, 1.0, smoothstep(sunHeight, −0.1, 0.35))` — controls the energy contributed by the environment map to IBL (Image-Based Lighting), ensuring that the HDR sky background does not over-illuminate scene objects during the day relative to its night value.

Both expressions use `smoothstep` with slightly different threshold ranges; the exposure curve responds earlier (begins at `sunHeight = −0.05`) to account for the psychological expectation that the image should brighten during civil twilight even before the sun clears the horizon.

### 4.7.4 Night Detection

The boolean predicate `isNightNow()` is evaluated each time the time parameter changes. The condition is: `sun.position.y < 5 OR sun.intensity < 0.5`. The disjunction of a geometric threshold and a photometric threshold provides robustness against edge cases — for instance, if intensity is ramped down before the geometric sun crosses the horizon line (due to atmospheric extinction modelling), the photometric criterion will still correctly trigger night mode. This predicate is the sole gating signal for the `eventBus` dispatch that activates lamppost lights, path spotlights, the stage spotlight, and the fireworks particle system.

---

## 4.8 PCF Shadow Maps

### 4.8.1 Shadow Algorithm

Three.js implements `PCFSoftShadowMap` (Percentage Closer Filtering with soft kernels) as its shadow mapping mode. Standard shadow mapping compares a fragment's depth in light space against the stored depth in the shadow map, yielding a binary lit/shadow classification that produces hard, aliased shadow edges. PCF improves on this by performing the depth comparison at multiple neighbouring texel positions within the shadow map and averaging the binary results, producing a smooth penumbra gradient rather than a single aliased boundary.

Three.js's soft variant extends the kernel from the simpler `4×4` grid to a `9×9` Poisson-disk kernel, where sample offsets are drawn from a pre-computed Poisson distribution rather than a regular grid. This avoids the banding artefacts that regular-grid PCF exhibits at large kernel radii. The result is a weighted average of binary shadow tests, providing apparent penumbra widths that are perceptually convincing for a park-scale scene without resorting to more expensive techniques such as PCSS (Percentage Closer Soft Shadows) or ray-traced shadows.

### 4.8.2 Shadow Map Configuration

The directional sun light is configured with a shadow map resolution of **4096 × 4096 texels**. This is the highest practical resolution on consumer WebGL hardware; halving the resolution to 2048 × 2048 produces visible aliasing on the ground plane at typical camera distances. The orthographic shadow frustum is set to **180 × 180 world units**, calibrated to enclose the entire park footprint without significant excess. Oversized frustums dilute shadow map resolution across world area: at 180 × 180 units and 4096 texels, each texel covers approximately `180 / 4096 ≈ 0.044` world units, which is sub-centimetre precision sufficient to avoid visible shadow stair-stepping on geometry with feature sizes above ~5 cm.

The frustum depth range is `near = 1`, `far = 300`. The near plane at 1 unit prevents the **Peter Pan artefact** (self-shadowing bias error where a surface shadows itself because its own depth in the shadow map is marginally greater than the surface's actual depth) — by ensuring that the closest occluder is always at least 1 unit from the light's near plane, depth-buffer precision is maintained across the full scene extent. The far plane at 300 units is generous relative to the 180-unit frustum width but necessary because the sun's position is placed at `y ≈ 100` units during midday and at oblique angles during dawn/dusk, increasing the effective geometric depth range visible in the frustum.

### 4.8.3 Shadow Casting Policy

Only the directional sun light casts shadows. The twelve lamppost `PointLight` instances do not, for two reasons. First, `PointLight` shadow maps require six depth-map faces (a cube map), making each shadow-casting point light six times more expensive than a single directional shadow map. Twelve such lights would require 72 shadow map render passes per frame — clearly outside the real-time performance budget. Second, at night, the ambient contribution from lamppost lights is low-intensity and warm-coloured; the absence of hard shadows from these sources is imperceptible to observers because the scene contrast in their vicinity is low.

---

## 4.9 Custom GLSL Shaders

### 4.9.1 Water Shader

The water surface is rendered by a fully custom `ShaderMaterial` defined in `Water.js`, with both vertex and fragment stages written in GLSL ES 3.00. The shader encodes river kinematics, optical properties, and environmental interaction in a unified pass without relying on Three.js's built-in `MeshStandardMaterial` pipeline.

#### Vertex Stage — Sum-of-Sines Wave Model

Surface displacement is computed as a sum of four sinusoidal wave trains, a classical technique in real-time ocean rendering whose theoretical basis is Gerstner wave decomposition. For each wave `i`, a function `sinWave(pos, dir, λ, amp, speed, t)` is evaluated:

```glsl
float k = 2.0 * PI / lambda;
float h = amp * sin(k * dot(dir, pos.xz) - speed * t);
```

where `pos` is the mesh vertex position, `dir` is a normalised 2D direction vector in the xz-plane, `λ` is the wavelength, `amp` is the amplitude, `speed` is the angular speed, and `t` is the elapsed time uniform `uTime`. The four wave trains use the following parameters:

| Wave | Direction (xz) | λ (units) | Amplitude | Speed |
|---|---|---|---|---|
| 1 | `[1.0, 0.1]` | 14.0 | 0.10 | 0.6 |
| 2 | `[1.0, −0.3]` | 7.0 | 0.06 | 0.8 |
| 3 | `[0.7, 0.7]` | 3.2 | 0.03 | 1.1 |
| 4 | `[−0.4, 1.0]` | 1.6 | 0.015 | 1.4 |

The multi-scale structure — dominant long swell plus progressively shorter, faster ripples — reproduces the characteristic power spectral density of a natural river surface. The total displacement in y is the sum of all four `h` values.

The displaced surface normal is computed analytically by summing the partial derivatives of the wave function with respect to x and z:

```glsl
float dhdx = amp * k * dir.x * cos(k * dot(dir, pos.xz) - speed * t);
float dhdz = amp * k * dir.y * cos(k * dot(dir, pos.xz) - speed * t);
```

The accumulated gradient `(Σ dh/dx, Σ dh/dz)` is used to construct the displaced normal as `normalize(vec3(-dhdx, 1.0, -dhdz))`, which is then transformed to view space by the normal matrix for use in the fragment stage. This analytic approach avoids finite-difference normal estimation, which would require sampling the displacement function at adjacent mesh vertices and would introduce errors proportional to vertex spacing.

#### Vertex Stage — Ripple Wave Packets

Beyond the background swell, the shader supports up to 8 simultaneous ripple wave-packets triggered by events in the scene (e.g., fish entering or exiting the water). Each ripple is parameterised by a 2D origin `(originX, originZ)`, an `age` in seconds, and an `intensity` scalar, all stored in uniform arrays. The ripple surface displacement at a fragment is:

```glsl
float dist = length(pos.xz - origin);
float phase = dist - rippleSpeed * age;   // rippleSpeed = 4.2 units/s
float envelope = exp(-age * decayRate) * intensity;
float rippleH = envelope * sin(rippleK * phase);
```

The exponential `exp(-age * decayRate)` envelope models the physical dissipation of ring waves over time. The `rippleSpeed` of 4.2 units/s and the ripple wavenumber `rippleK` are calibrated to match a shallow-water gravity wave at the scale of the scene's river width.

#### Fragment Stage

The fragment shader implements a multi-layer optical model for the water surface:

- **Depth-based colour**: The base water colour transitions from deep blue (`vec3(0.04, 0.18, 0.40)`) at the channel centre to a shallow cyan near the riverbanks. This is driven by a `uDepthMap` texture or a procedural distance-from-bank computation, effectively simulating Beer-Lambert absorption of the water column.

- **Caustics**: A procedural caustic pattern is generated using two noise evaluations at slightly different scales: `pow(0.5 + 0.5 * (n1 - n2), 3.0)`, where `n1` and `n2` are value-noise samples scrolled at different speeds along the flow direction. The cubic exponentiation compresses the pattern into bright narrow filaments and dark interstitial areas, closely resembling the focussed refraction caustics observable in shallow clear water.

- **Specular highlight**: A Blinn-Phong specular term is computed using the sun direction uniform `uSunDir` and the analytically displaced normal from the vertex stage, with a Phong exponent tuned to produce a sharp, narrow specular lobe consistent with the low surface roughness of water.

- **Fresnel reflectance**: The Schlick approximation is evaluated as `pow(1.0 - dot(N, V), 4.0)` and blended against a sky-colour tint to simulate the specular reflection of the sky dome visible at grazing view angles. The exponent of `4.0` is an empirical tuning of the water's refractive index effect.

- **Foam**: Two foam layers are overlaid. A bank-edge foam strip is computed from the depth proximity signal. A crest-foam layer uses high-frequency animated noise at wave maxima, gated by a threshold on the displacement height, to simulate whitecapping.

- **Night tint**: To prevent the water from appearing unnaturally dark and featureless at night, the final colour is mixed toward a moonlit blue-grey: `mix(col, nightTint + col * 0.32, uNight)`, where `uNight` is a `[0, 1]` uniform interpolated from `isNightNow()`. The `col * 0.32` residual preserves a fraction of the day colour, avoiding a flat constant-colour blend that would look painted.

### 4.9.2 Sky Shader

The sky background is rendered on an inverted sphere (a skybox sphere with front-face culling disabled and back-face culling enabled) using a custom `ShaderMaterial` defined in `Sky.js`.

#### Vertex Stage

The vertex shader removes the translation component from the view matrix before applying it to the sphere geometry:

```glsl
mat4 viewNoTranslation = mat4(mat3(viewMatrix));
gl_Position = projectionMatrix * viewNoTranslation * vec4(position, 1.0);
gl_Position.z = gl_Position.w;   // force depth = 1.0 (NDC)
```

Setting `gl_Position.z = gl_Position.w` maps the fragment depth to exactly `1.0` in normalised device coordinates after the perspective divide, placing the sky sphere at the far plane. This guarantees that all scene geometry overwrites the sky in the depth test, irrespective of the sphere's geometric scale.

#### Fragment Stage — Equirectangular Sampling

Two HDR equirectangular textures (`uTexA`, `uTexB`) are sampled simultaneously using UV coordinates derived from the normalised view direction `d`:

```glsl
float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
```

The `atan(z, x)` form handles the full `[−π, π]` angular range correctly, and the `asin` for the elevation angle gives the standard equirectangular (latitude-longitude) projection. The two sampled colours are blended via the `uMix` uniform: `col = mix(colA, colB, uMix)`.

#### HDR Presets and Interpolation Schedule

Four HDR panorama assets are loaded at application startup, covering night (`t ≈ 0/1`), sunrise (`t ≈ 0.25`), midday (`t ≈ 0.50`), and sunset (`t ≈ 0.75`). The crossfade schedule anchors the `uMix` transitions at specific hours:

| Hour | Active preset |
|---|---|
| 0–4 | Night |
| 4–7 | Night → Sunrise crossfade |
| 7–9 | Sunrise → Day crossfade |
| 9–16 | Day |
| 16–19 | Day → Sunset crossfade |
| 19–21 | Sunset → Night crossfade |
| 21–24 | Night |

Within each crossfade window, `uMix` is driven by a `smoothstep` of the current hour value, yielding a perceptually smooth transition without abrupt sky colour changes.

#### PMREM and Image-Based Lighting

Each HDR preset, when activated, triggers the baking of a **Pre-filtered Mipmapped Radiance Environment Map** (PMREM) via Three.js's `PMREMGenerator`. The PMREM stores the HDR panorama pre-convolved with the GGX NDF (Normal Distribution Function) at a discrete set of roughness levels, encoding the split-sum approximation for specular IBL as formulated by Karis (2013). The resulting `envMap` texture is assigned to `scene.environment`, making it the global IBL source for all `MeshStandardMaterial` objects in the scene. This ensures that PBR materials respond consistently to the sky's colour and luminance throughout the day/night cycle: metal surfaces reflect the warm orange of sunset, and rough dielectric surfaces receive the cool blue-tinted diffuse of an overcast sky.

### 4.9.3 Fireworks Shader

The fireworks system is implemented as a GPU particle system in `Fireworks.js`, exploiting Three.js `BufferGeometry` with custom vertex attributes to encode per-particle state on the GPU, avoiding per-frame CPU-side particle updates.

#### Geometry and Attributes

Each burst uploads a `BufferGeometry` with the following interleaved float attributes per vertex:

| Attribute | Components | Description |
|---|---|---|
| `aVelocity` | `vec3` | Initial world-space velocity |
| `aLifetime` | `float` | Total particle lifetime (s) |
| `aType` | `float` | Particle class (0=head, 1=trail, 2=strobe) |
| `aTrailOffset` | `float` | Fractional offset along trail ribbon |

#### Vertex Stage — Ballistic Integration

Because the particle state is static on the GPU (it is set at burst-time and never updated), the vertex shader must integrate the ballistic equation of motion forward in time using the `uAge` uniform (elapsed time since burst):

```glsl
vec3 pos = uCenter + aVelocity * uAge - 0.5 * uGravity * uAge * uAge;
```

where `uGravity = vec3(0.0, 9.8, 0.0)` (downward acceleration, positive y = up convention reversed). Particles whose `uAge` exceeds `aLifetime` are culled by projecting them to the degenerate position:

```glsl
if (uAge > aLifetime) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
```

Placing the position outside the clip volume (`|x| > w`) ensures the rasteriser discards the primitive without requiring a conditional discard in the fragment stage, which would inhibit early-z optimisation.

#### Fragment Stage

Each particle is rendered as a billboard quad. The fragment shader evaluates a radial gradient using the `gl_PointCoord` built-in:

```glsl
float dist = length(gl_PointCoord - vec2(0.5));
float alpha = smoothstep(0.5, 0.0, dist) * lifeRatio;
```

where `lifeRatio = 1.0 - uAge / aLifetime` produces a linear fade. Strobe particles modulate `alpha` by `sin(uAge * strobeFreq)²` to produce the characteristic twinkling effect. Three burst archetypes are supported: **spherical** (uniformly distributed velocity vectors on a sphere), **corona** (velocities confined to a horizontal equatorial ring), and **willow** (upward initial velocities followed by strong downward bias gravity, producing drooping trails reminiscent of weeping-willow fireworks).

---

## 4.10 PBR Material Workflow

### 4.10.1 The GGX Microfacet BRDF

Three.js `MeshStandardMaterial` implements a physically based BRDF based on the GGX (also known as Trowbridge-Reitz) microfacet distribution function, as described in Walter et al. (2007) and adopted widely in real-time rendering since the Disney BRDF (Burley, 2012). The BRDF has the form:

```
f(l, v) = f_d + f_s
f_d = c_diff / π
f_s = F(l, h) · G(l, v, h) · D(h) / (4 · (n·l) · (n·v))
```

where `F` is the Fresnel term (Schlick approximation), `G` is the Smith height-correlated masking-shadowing function, and `D` is the GGX normal distribution function parameterised by roughness `α`. The diffuse Lambertian term `f_d` uses the base colour attenuated by `(1 − metalness)`, acknowledging that conductors have no subsurface diffuse re-emission.

### 4.10.2 Texture Map Pipeline

All PBR assets in the scene originate from the **ambientCG** library (CC0 licensed) and are prepared in the standard metalness-roughness workflow. The following texture channels are used:

- **Albedo (`map`)**: The base colour map encodes the sRGB-space diffuse colour of the surface. Three.js's renderer performs the linearisation from sRGB to linear working space before passing the value to the BRDF, ensuring energy-conservation correctness in the lighting computation. This linearisation is critical: incorrectly treating sRGB textures as linear input causes the BRDF to overestimate diffuse albedo by up to a factor of two in mid-tones.

- **Normal map (`normalMap`)**: A tangent-space normal map encodes surface micro-geometry as a perturbation of the interpolated vertex normal. The map is decoded via `rgb * 2.0 - 1.0` to recover the tangent-space normal vector, which is then transformed to world space by the TBN matrix (Tangent, Bitangent, Normal) constructed in the vertex shader. This allows the lighting model to respond to surface detail such as brick mortar joints, wood grain, or cobblestone relief without additional geometry cost.

- **Roughness map (`roughnessMap`)**: Controls the GGX `α` parameter, which determines the width of the specular lobe. A roughness value of `1.0` (white texel) produces a Lambertian-like broad lobe; `0.0` (black texel) produces a mirror-like specular response. High roughness surfaces such as unfinished wood, concrete, and painted metal can be reliably distinguished from low-roughness surfaces such as polished brass and glass — even under identical albedo — solely via the roughness map.

- **Metalness map (`metalnessMap`)**: Where material assets provide one, this single-channel map controls the metallic/dielectric split. A value of `1.0` (conductor) routes all specular through the Fresnel term using the albedo as the F0 base reflectance, and sets diffuse contribution to zero. A value of `0.0` (dielectric) uses a fixed F0 of approximately `0.04` (corresponding to a refractive index of ~1.5, common for plastics and stone) and preserves the diffuse term.

- **Ambient Occlusion map (`aoMap`)**: A baked AO map stores the mean accessibility of each surface point to hemispherical illumination, pre-computed offline by a ray-casting pass in a 3D DCC tool. At runtime it modulates the IBL diffuse component: `diffuseIBL *= aoMap`. This simulates the reduced skylight received in crevices, underhangs, and concave geometry features, providing the perceptual "grounding" of objects that is otherwise absent in purely analytical lighting models.

- **Emissive map (`emissiveMap`)**: Self-illuminating surfaces — ride light bulbs, stage marquee lettering, fence string lights — carry an emissive map that adds a constant additive colour independent of incident lighting. Emissive surfaces are intentionally set to high-luminance values (above the `UnrealBloomPass` threshold of `1.5` in scene-linear space) so that the post-processing pipeline adds a bloom halo around them, enhancing the impression of a real glowing light source.

### 4.10.3 Texture Anisotropy

All PBR textures are loaded with maximum available anisotropic filtering:

```js
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

`getMaxAnisotropy()` returns the hardware-reported maximum, typically `16×` on discrete GPUs. Anisotropic filtering is particularly important for the ground plane, where the texture is viewed at shallow grazing angles at the periphery of the camera's field of view. Standard isotropic mipmapping — which selects a mip level based only on the maximum screen-space derivative — produces excessive blurring along the viewing direction when the derivatives are highly anisotropic (large in one axis, small in the other). 16× anisotropy extends the effective sample footprint along the dominant derivative axis by a factor of sixteen, recovering detail at grazing angles at the cost of additional texture bandwidth, which is justified by the visual quality improvement on the park's primary navigational surface.

---

## 4.11 Post-Processing

### 4.11.1 Bloom — UnrealBloomPass

The bloom effect is implemented using Three.js's `UnrealBloomPass`, which is a multi-scale selective bloom derived from the approach used in Unreal Engine 4. The algorithm operates in three stages:

1. **Luminance threshold pass**: The HDR scene colour buffer is thresholded at `threshold = 1.5` (in scene-linear space). Only fragments whose luminance exceeds this value contribute to the bloom buffer. At `1.5`, only self-illuminating surfaces (emissive meshes, water specular peaks, bright particle heads) participate; diffuse-lit geometry with typical albedos and sun intensities remains below threshold and is unaffected.

2. **Multi-scale Gaussian blur**: The thresholded buffer is downsampled to a pyramid of five half-resolution levels and convolved horizontally and vertically with a Gaussian kernel at each level. The final bloom contribution is the weighted sum of all five levels: `bloom = Σ weight_i * blurred_i`. The multi-scale structure approximates an ideal bloom kernel (which would have very heavy tails in pixel-space) without requiring a single enormous convolution kernel.

3. **Additive composite**: The bloom texture is additively composited over the HDR scene colour with `strength = 0.35` and `radius = 0.4`. The `strength` parameter modulates the overall bloom intensity; `0.35` is deliberately conservative to avoid the "glow-everywhere" aesthetic that over-aggressive bloom produces. The `radius` parameter controls the relative contribution of the lower-resolution (wider) pyramid levels.

The net effect at night is a subtle luminous halo around lamppost bulbs, ride string lights, and water specular highlights, reinforcing the impression of real photon scattering in the camera optics without visually distracting from the scene content.

### 4.11.2 Tone Mapping — ACES Filmic

Three.js's `ACESFilmicToneMapping` applies the Academy Color Encoding System filmic tone curve to map the HDR scene values from their linear floating-point range to the `[0, 1]` display range. The ACES RRT (Reference Rendering Transform) and ODT (Output Display Transform) together implement an S-shaped transfer function with the following properties relevant to the Luna Park scene:

- **Shadow lift**: The toe of the S-curve lifts deep shadow values slightly above absolute zero, recovering texture detail in the park's darkest areas (underneath ride structures, inside enclosed spaces) that pure linear mapping would clip to black.

- **Highlight rolloff**: The shoulder of the curve compresses values above mid-exposure with a soft rolloff rather than a hard clip, so that bright specular highlights on metallic ride components and the water surface remain visible as distinct highlights rather than blown-out white patches.

- **Colour saturation in mid-tones**: The ACES curve preserves saturation through the mid-tone range, allowing the park's warm lamppost yellows, cool moonlight blues, and vivid ride colours to remain perceptually rich at both day and night exposure levels.

The `renderer.toneMappingExposure` parameter, animated as described in §4.7.3, effectively multiplies scene luminance before the ACES curve is applied, functioning as a virtual camera aperture/shutter control that adjusts the operating point on the tone curve in response to the current scene brightness.

---

*End of Section 4 — Part B.*
