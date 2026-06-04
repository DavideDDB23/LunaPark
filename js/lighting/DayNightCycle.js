import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';

// Drives the visual time-of-day. The sky stays as the HDR (we don't move it because
// the equirect is baked), but we modulate:
//   - sun directional light position + colour + intensity
//   - hemisphere light colour + intensity
//   - renderer.toneMappingExposure (dim at night)
//   - scene.backgroundIntensity / environmentIntensity (dim the HDR at night)
//   - lamppost point lights (on at night)
//   - stage spot light (on at night)
//   - water shader sun-direction uniform
//
// Time convention: t ∈ [0, 1] where
//   0.00 = midnight       sun at -90° (under horizon)
//   0.25 = sunrise        sun on +X horizon
//   0.50 = noon           sun overhead
//   0.75 = sunset         sun on -X horizon
//   1.00 = midnight (wraps)

export class DayNightCycle {
  constructor({
    scene,
    renderer,
    sun,
    hemi,
    setSkyTime,
    getLamps,
    getStageSpotLight,
    getWaterMaterial,
  }) {
    this.scene = scene;
    this.renderer = renderer;
    this.sun = sun;
    this.hemi = hemi;
    this.setSkyTime = setSkyTime;
    this.getLamps = getLamps;
    this.getStageSpotLight = getStageSpotLight;
    this.getWaterMaterial = getWaterMaterial;

    this.t = 0.5;

    // Sun colour stops.
    this._sunWarm = new THREE.Color(0xff6622);
    this._sunMid  = new THREE.Color(0xffd070);
    this._sunDay  = new THREE.Color(0xfff0d8);
    this._tmpColor = new THREE.Color();
    this._sunDir = new THREE.Vector3();
  }

  setTime(t01) {
    this.t = THREE.MathUtils.euclideanModulo(t01, 1.0);
    this._apply();
  }

  setHour(h) { this.setTime(h / 24); }

  _apply() {
    const t = this.t;
    // Sun travels east → up → west → underground.
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const sunZ = 0.25; // small southward bias so shadows aren't axis-aligned

    this._sunDir.set(sunX, sunY, sunZ).normalize();

    // ── Sun directional light ─────────────────────────────────────
    const distance = 80;
    this.sun.position.set(sunX * distance, Math.max(0.05, sunY) * distance, sunZ * distance);
    this.sun.target.position.set(0, 0, 0);

    const sunHeight = Math.max(0, sunY); // 0 underground, 1 zenith

    // Sun colour: warm orange near horizon, white at zenith.
    if (sunHeight > 0.0) {
      if (sunHeight < 0.35) {
        this._tmpColor.copy(this._sunWarm).lerp(this._sunMid, sunHeight / 0.35);
      } else {
        this._tmpColor.copy(this._sunMid).lerp(this._sunDay, Math.min(1, (sunHeight - 0.35) / 0.4));
      }
    } else {
      this._tmpColor.set(0x222233);
    }
    this.sun.color.copy(this._tmpColor);

    // Sun intensity ramps in at the horizon, peaks at zenith.
    this.sun.intensity = THREE.MathUtils.smoothstep(sunHeight, -0.02, 0.25) * 3.0 + sunHeight * 0.4;

    // ── Hemisphere fill ───────────────────────────────────────────
    this.hemi.intensity = 0.10 + 0.75 * sunHeight;
    const twilight = Math.pow(1.0 - Math.min(1.0, sunHeight * 2.0), 2.0) * (sunY > -0.05 ? 1 : 0);
    if (sunHeight > 0.1) {
      this.hemi.color.setHex(0x87ceeb);
      this.hemi.groundColor.setHex(0x8b7355);
    } else if (twilight > 0.1) {
      this.hemi.color.setHex(0xff9970);
      this.hemi.groundColor.setHex(0x3a2a1f);
    } else {
      this.hemi.color.setHex(0x1a2240);
      this.hemi.groundColor.setHex(0x0a0a18);
    }

    // ── Tone-mapping exposure and HDR background intensity ────────
    // Keep the HDR's beautiful look but dim it at night.
    const exposure = THREE.MathUtils.lerp(0.18, 1.0, THREE.MathUtils.smoothstep(sunHeight, -0.05, 0.4));
    this.renderer.toneMappingExposure = exposure;

    const bgIntensity = THREE.MathUtils.lerp(0.08, 1.0, THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.35));
    this.scene.backgroundIntensity = bgIntensity;
    if ('environmentIntensity' in this.scene) {
      this.scene.environmentIntensity = THREE.MathUtils.lerp(0.15, 1.0, THREE.MathUtils.smoothstep(sunHeight, -0.05, 0.3));
    }

    // ── Lamppost lights — on at night ─────────────────────────────
    const nightFactor = THREE.MathUtils.smoothstep(1.0 - sunHeight, 0.78, 1.05);
    const isNight = nightFactor > 0.05;
    eventBus.emit('time-phase-change', { isNight, nightFactor });

    // ── Stage spotlight ───────────────────────────────────────────
    const spot = this.getStageSpotLight?.();
    if (spot) spot.intensity = nightFactor * 90;

    // ── Water shader sun direction + night dim ────────────────────
    const waterMat = this.getWaterMaterial?.();
    if (waterMat && waterMat.uniforms) {
      if (waterMat.uniforms.uSunDir) waterMat.uniforms.uSunDir.value.copy(this._sunDir);
      if (waterMat.uniforms.uNight)  waterMat.uniforms.uNight.value = nightFactor;
    }

    // ── Sky HDR swap (day / sunrise / day / sunset / night) ───────
    if (this.setSkyTime) this.setSkyTime(t);
  }
}
