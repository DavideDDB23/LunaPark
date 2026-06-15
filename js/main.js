import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildGround } from './environment/Ground.js';
import { buildPaths } from './environment/Paths.js';
import { buildSky } from './environment/Sky.js';
import { buildLights } from './lighting/LightManager.js';
import { buildFence } from './environment/Fence.js';
import { buildLampposts } from './environment/Lampposts.js';
import { buildFoodStalls } from './environment/FoodStalls.js';
import { buildStage } from './environment/Stage.js';
import { buildVegetation } from './environment/Vegetation.js';
import { buildBenches } from './environment/Benches.js';
import { buildEntranceGate } from "./environment/Props.js";
import { buildRiver } from "./environment/River.js";
import { buildFerrisWheel } from "./environment/FerrisWheel.js";
import { buildCarousel } from "./environment/Carousel.js";
import { buildTagada } from "./environment/Tagada.js";
import { buildCoaster } from "./environment/Coaster.js";
import { buildRideSign } from "./environment/RideSign.js";
import { buildRideHint } from "./environment/RideHints.js";
import { buildVisitors } from "./environment/Visitors.js";
import { buildFireworks } from "./environment/Fireworks.js";
import { buildBalloon } from "./environment/Balloon.js";
import { buildTrain } from "./environment/Train.js?v=11";
import { buildShootingGallery } from "./environment/ShootingGallery.js";
import { DayNightCycle } from "./lighting/DayNightCycle.js";
import { CameraManager } from './camera/CameraManager.js';
import { eventBus } from './utils/EventBus.js';
import { InteractionManager } from './utils/InteractionManager.js';
import { isNightNow } from './utils/dayNight.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('c');
const loaderEl = document.getElementById('loader');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(60, 45, 80);
camera.lookAt(0, 0, 0);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
bloomPass.threshold = 1.5; // Raised threshold so balloons don't bloom, only fireworks/lamps
bloomPass.strength = 0.35;
bloomPass.radius = 0.4;
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const clock = new THREE.Clock();

const fpsEl = document.getElementById('fps');
let fpsFrames = 0;
let fpsLastTime = performance.now();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 250;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 1, 0);

const environmentGroup = new THREE.Group();
environmentGroup.name = 'environment';
scene.add(environmentGroup);

const windInput = document.getElementById('wind');
const windValEl = document.getElementById('windVal');
function getWindSpeed() {
  return windInput ? parseFloat(windInput.value) : 1.0;
}
if (windInput && windValEl) {
  windInput.addEventListener('input', () => {
    windValEl.textContent = parseFloat(windInput.value).toFixed(2);
  });
}

let dayNight = null;
let rideSigns = [];
let rideHints = [];
let cameraManager = null;
const fpvTmpVec = new THREE.Vector3();
const fpvTmpQuat = new THREE.Quaternion();
// Animated objects, cached once after init() — getObjectByName is a full
// recursive scene traversal, far too expensive to repeat 12× per frame.
const world = {};

cameraManager = new CameraManager(camera, scene, controls, renderer, () => {
  const rides = [];
  const tmpVec = new THREE.Vector3();
  const fw = environmentGroup.getObjectByName('ferrisWheel');
  if (fw) rides.push({
    group: fw,
    getFpvTarget: () => {
      const c = fw.userData.controller;
      let best = null, bestY = -Infinity;
      for (const gm of c.gondolaMounts) {
        gm.gondolaMesh.getWorldPosition(tmpVec);
        if (tmpVec.y > bestY) { bestY = tmpVec.y; best = gm; }
      }
      return best?.gondolaMesh || null;
    },
    getFpvOffset: () => new THREE.Vector3(0, 1.5, 0),
    getRiders: () => {
      const c = fw.userData.controller;
      let best = null, bestY = -Infinity;
      for (const gm of c.gondolaMounts) {
        gm.gondolaMesh.getWorldPosition(tmpVec);
        if (tmpVec.y > bestY) { bestY = tmpVec.y; best = gm; }
      }
      return best ? best.passengers : [];
    },
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTmpVec.set(0, 1.8, 1.0);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      fpvTmpVec.set(0, 1.8, 10.0);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    }
  });
  const cr = environmentGroup.getObjectByName('carousel');
  if (cr) rides.push({
    group: cr,
    getFpvTarget: () => cr.userData.controller.horses[0]?.container || null,
    getFpvOffset: () => new THREE.Vector3(0, 2.5, 0),
    getRiders: () => {
      const r = cr.userData.controller.horses[0]?.rider;
      return r ? [r] : [];
    },
    getFpvCameraPos: (fpvTarget, targetVec) => {
      const horse = cr.userData.controller.horses[0];
      if (!horse) return;
      const h = horse.rider ? horse.rider.height : 3.28;
      const px = horse.rider ? horse.rider.pivot.position.x : 0.67;
      const py = horse.rider ? horse.rider.pivot.position.y : 0.8;
      const pz = horse.rider ? horse.rider.pivot.position.z : 0.0;
      fpvTmpVec.set(px - 0.15, py + h * 0.82, pz);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      const horse = cr.userData.controller.horses[0];
      if (!horse) return;
      const h = horse.rider ? horse.rider.height : 3.28;
      const px = horse.rider ? horse.rider.pivot.position.x : 0.67;
      const py = horse.rider ? horse.rider.pivot.position.y : 0.8;
      const pz = horse.rider ? horse.rider.pivot.position.z : 0.0;
      fpvTmpVec.set(px - 10.0, py + h * 0.82, pz + 2.5);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    }
  });
  const tg = environmentGroup.getObjectByName('tagada');
  if (tg) rides.push({
    group: tg,
    getFpvTarget: () => tg.userData.controller.discMeshGroup.getObjectByName('seat_group_0') || null,
    getFpvOffset: () => new THREE.Vector3(0, 1.5, 0),
    getRiders: () => {
      const r = tg.userData.controller.seats[0]?.rider;
      return r ? [r] : [];
    },
    getFpvCameraPos: (fpvTarget, targetVec) => {
      const seat = tg.userData.controller.seats[0];
      if (!seat) return;
      const h = seat.rider ? seat.rider.height : 3.28 * 0.88;
      const px = seat.rider ? seat.rider.pivot.position.x : 0.0;
      const py = seat.rider ? seat.rider.pivot.position.y : 0.8 - h * 0.28;
      const pz = seat.rider ? seat.rider.pivot.position.z : 0.08;
      fpvTmpVec.set(px, py + h * 0.82, pz + 0.15);
      // Hand-held shake proportional to the ride's running ease — sells the
      // tagada's violence from the inside without touching the scene itself.
      const shake = tg.userData.controller.ease || 0;
      const tN = performance.now() * 0.001;
      fpvTmpVec.x += Math.sin(tN * 23.0) * 0.045 * shake;
      fpvTmpVec.y += Math.sin(tN * 31.0 + 1.7) * 0.05 * shake;
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      const seat = tg.userData.controller.seats[0];
      if (!seat) return;
      const h = seat.rider ? seat.rider.height : 3.28 * 0.88;
      const px = seat.rider ? seat.rider.pivot.position.x : 0.0;
      const py = seat.rider ? seat.rider.pivot.position.y : 0.8 - h * 0.28;
      const pz = seat.rider ? seat.rider.pivot.position.z : 0.08;
      fpvTmpVec.set(px, py + h * 0.82, pz + 10.0);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    }
  });
  // Roller coaster — front seat of the lead carriage. The dolly's local frame
  // is +Z = travel, +Y = track-up, so getFpvUp rolls the camera WITH the track
  // (banked turns lean, the loop goes properly upside-down).
  const co = environmentGroup.getObjectByName('coaster');
  if (co) rides.push({
    group: co,
    getFpvTarget: () => co.userData.controller.cars[0]?.dolly || null,
    getFpvOffset: () => new THREE.Vector3(0, 1.9, 0),
    getRiders: () => co.userData.controller.riders.slice(0, 2), // the lead car's two riders
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTmpVec.set(0.17, 2.05, 0.5); // head height, centred on the cart footprint
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      fpvTmpVec.set(0.17, 1.55, 9.0); // look ahead down the track
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      fpvTarget.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  const tr = environmentGroup.getObjectByName('train');
  if (tr) rides.push({
    group: tr,
    getFpvTarget: () => tr.userData.controller.cars[0]?.mesh || null,
    getFpvOffset: () => new THREE.Vector3(0, 1.8, -0.3),
    getRiders: () => [],
    getFpvCameraPos: (fpvTarget, targetVec) => {
      // Place the camera inside the locomotive cabin (slightly high, toward the back)
      fpvTmpVec.set(0, 1.7, -0.4);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // Look forward along the direction of the locomotive
      fpvTmpVec.set(0, 1.5, 8.0);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      fpvTarget.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  return rides;
});
let autoAdvance = true;

async function init() {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const skyInfo = await buildSky(scene, renderer);
  const lightInfo = buildLights(scene);

  const ground = buildGround({ anisotropy: maxAniso });
  environmentGroup.add(ground);

  const paths = await buildPaths({ anisotropy: maxAniso });
  environmentGroup.add(paths);

  const river = await buildRiver();
  environmentGroup.add(river);

  const fence = await buildFence({ anisotropy: maxAniso });
  environmentGroup.add(fence);

  const lamps = await buildLampposts();
  environmentGroup.add(lamps);

  const stalls = await buildFoodStalls();
  environmentGroup.add(stalls);

  // Coaster builds before vegetation so trees can be kept clear of its exact track footprint.
  
  const coaster = await buildCoaster({ position: [52, 0, 54], camera, renderer, anisotropy: maxAniso });
  environmentGroup.add(coaster);
  window.__lp.coaster = coaster.userData.controller;

  // ── Ride frontage anchors (name marquee + on/off control panel), declared UP-FRONT so vegetation
  //    keeps clear of them. Both face the central pedestrian path (x=0 corridor) and the entrance
  //    gate (south, +z). The ControlPanel console and the sign board both face +Z, so one yaw aims
  //    them at the walkway; SOUTH_BIAS angles that aim toward the entrance for arriving visitors.
  const SOUTH_BIAS = 25;
  const faceYaw = (x) => Math.atan2(-x, SOUTH_BIAS); // +Z → toward x=0 (path) and +z (entrance)
  const FRONTAGES = [
    { title: 'TANGLED TWISTER', theme: 'coaster',  groupName: 'coaster',     sign: [15, 0, 44],   panel: [9, 0, 50] },
    { title: 'SKY WHEEL',       theme: 'ferris',    groupName: 'ferrisWheel', sign: [-26, 0, -38], panel: [-18, 0, -32] },
    { title: 'GOLDEN CAROUSEL', theme: 'carousel',  groupName: 'carousel',    sign: [22, 0, -26],  panel: [15, 0, -20] },
    { title: 'TURBO TAGADA',    theme: 'tagada',    groupName: 'tagada',      sign: [-22, 0, 28],  panel: [-15, 0, 34] },
    { title: 'SCENIC RAILWAY',  theme: 'train',     groupName: 'train',       sign: [76, 0, -65],   panel: [68, 0, -60] },
    { title: 'SHOOTING GALLERY', theme: 'gallery',  groupName: 'shootingGallery', sign: [11, 0, 20], panel: null },
  ];
  // Tree keep-out [x, z, radius] for each frontage so the signs/panels stay visible from the path:
  // a circle at the sign, another IN FRONT of it (along its facing dir, toward the path), + the panel.
  const signKeepOut = [];
  for (const f of FRONTAGES) {
    const yaw = faceYaw(f.sign[0]);
    const fx = Math.sin(yaw), fz = Math.cos(yaw); // unit vector the sign faces (toward the path)
    signKeepOut.push([f.sign[0], f.sign[2], 10.0]);
    signKeepOut.push([f.sign[0] + fx * 9, f.sign[2] + fz * 9, 8.0]);
    if (f.panel) {
      signKeepOut.push([f.panel[0], f.panel[2], 4.5]);
    }
  }

  
  // Panoramic train — loops around the park on a deformed ring
  const train = await buildTrain({ anisotropy: maxAniso });
  environmentGroup.add(train);
  window.__lp.train = train.userData.controller;

  // Train footprint added as obstacle so visitors won't walk on tracks
  if (train.userData.footprint) {
    const pad = train.userData.footprint.pad;
    for (let i = 0; i < train.userData.footprint.pts.length; i += 2) {
      signKeepOut.push([train.userData.footprint.pts[i], train.userData.footprint.pts[i+1], pad]);
    }
  }

  const vegetation = await buildVegetation({ 
    coasterFootprint: coaster.userData.footprint, 
    trainFootprint: train.userData.footprint,
    signKeepOut 
  });
  environmentGroup.add(vegetation);

  const benches = await buildBenches();
  environmentGroup.add(benches);

  // NPC visitors roam the whole park, routing around the (now-placed) trees & rides
  // and grounded onto the terrain, lifted smoothly over the central bridge deck.
  
  const bridge = paths.getObjectByName('japanese_bridge');
  const visitors = await buildVisitors({
    count: 10,
    obstacles: vegetation.userData.obstacles || [],
    coasterFootprint: coaster.userData.footprint,
    bridge,
  });
  environmentGroup.add(visitors);

  environmentGroup.add(buildEntranceGate());
  const stage = buildStage({ anisotropy: maxAniso });
  environmentGroup.add(stage);

  // Night-time fireworks show behind the stage + path spotlights at the key
  // walkway points (both driven by the day/night cycle via 'time-phase-change').
  const fireworks = buildFireworks();
  scene.add(fireworks);
  // Hot air balloon — drifts slowly across the sky with tether cables
  const balloon = await buildBalloon();
  environmentGroup.add(balloon);



  // Shooting gallery — interactive FPV aim mode with targets
  const shootingGallery = await buildShootingGallery({ camera, renderer, controls });
  shootingGallery.position.set(12, 0, 24);
  environmentGroup.add(shootingGallery);
  window.__lp.shootingGallery = shootingGallery.userData.controller;

  
  const ferrisWheel = await buildFerrisWheel({ position: [-50, 0, -50], camera, renderer });
  environmentGroup.add(ferrisWheel);
  window.__lp.ferrisWheel = ferrisWheel.userData.controller;

  
  const carousel = await buildCarousel({ position: [40, 0, -40], camera, renderer, anisotropy: maxAniso });
  environmentGroup.add(carousel);
  window.__lp.carousel = carousel.userData.controller;

  
  const tagada = await buildTagada({ position: [-40, 0, 40], camera, renderer, anisotropy: maxAniso });
  environmentGroup.add(tagada);
  window.__lp.tagada = tagada.userData.controller;

  // ── Place each ride's frontage: build the name marquee and move the ride's on/off control panel
  //    to it, both facing the path/entrance (see FRONTAGES above). ──
  
  rideSigns = FRONTAGES.map(({ title, theme, groupName, sign, panel }) => {
    const group = environmentGroup.getObjectByName(groupName);

    // Name marquee
    const s = buildRideSign({ title, theme, anisotropy: maxAniso });
    s.position.set(sign[0], sign[1], sign[2]);
    s.rotation.y = faceYaw(sign[0]);
    environmentGroup.add(s);

    // Move the ride's existing on/off control panel to the frontage, same facing. The panel is a
    // child of the (translation-only) ride group, so local = world − groupPosition.
    const ctrl = group && group.userData.controller;
    if (ctrl && ctrl.panel) {
      const gp = group.position;
      ctrl.panel.position.set(panel[0] - gp.x, -gp.y, panel[2] - gp.z);
      ctrl.panel.rotation.set(0, faceYaw(panel[0]), 0);
    }

    // Floating interaction hint above the panel — fades in when the camera is near.
    const hintPos = panel ? [panel[0], 9.2, panel[2]] : [sign[0], 9.2, sign[2]];
    const hint = buildRideHint({ position: hintPos });
    hint.name = 'rideHint_' + groupName;
    environmentGroup.add(hint);
    rideHints.push(hint);
    return s;
  });
  window.__lp.rideSigns = rideSigns;

  // Day/night controller — slider in HUD drives this.
  // (The stage spotlight is intentionally NOT wired here: Stage.js owns it —
  // two writers per frame fought each other and the winner depended on order.)
  dayNight = new DayNightCycle({
    scene,
    renderer,
    sun: lightInfo.sun,
    hemi: lightInfo.hemi,
    setSkyTime: skyInfo.setTime,
    getLamps: () => lamps.children,
    getWaterMaterial: () => {
      const water = river.getObjectByName('water');
      const surface = water?.getObjectByName('river_surface');
      return surface?.material;
    },
  });

  setupTimeOfDayUI();
  // Initial time = noon.
  dayNight.setHour(12);

  // --- Interaction Manager & Event Wiring ---
  const interactionManager = new InteractionManager(camera, renderer, scene, controls);

  // Register lampposts (only the lamp roots, not the instanced meshes)
  lamps.children.forEach(lamp => {
    if (lamp.name.startsWith('lamp_')) {
      interactionManager.registerClickable(lamp);
    }
  });

  // Register ride control panels (all four — the coaster's used to run its own
  // private raycaster, which double-raycasted every mousemove and let clicks on
  // its panel ALSO trigger the camera's click-to-fly).
  interactionManager.registerClickable(ferrisWheel.userData.controller.panel);
  interactionManager.registerClickable(carousel.userData.controller.panel);
  interactionManager.registerClickable(tagada.userData.controller.panel);
  interactionManager.registerClickable(coaster.userData.controller.panel);
  interactionManager.registerClickable(train.userData.controller.panel);
  
  const sgHint = rideHints.find(h => h.name === 'rideHint_shootingGallery');
  if (sgHint) {
    interactionManager.registerClickable(sgHint);
  }

  // Register stage spotlight for manual toggle
  interactionManager.registerClickable(stage.userData.spotLight);

  // Share interactive objects with CameraManager for optimized raycasting
  cameraManager.setInteractiveObjects(interactionManager.interactiveObjects);

  // Share interactive objects with CameraManager for optimized raycasting
  cameraManager.setInteractiveObjects(interactionManager.interactiveObjects);

  // EventBus: click interactions
  eventBus.on('interact-click', ({ object }) => {
    // Check if lamppost clicked
    let curr = object;
    while (curr && !curr.userData.lampId) {
      curr = curr.parent;
    }
    if (curr && curr.userData.lampId) {
      const isNight = isNightNow(curr);
      if (!curr.userData.mode) curr.userData.mode = 'auto';

      if (isNight) {
        // Night cycle: auto -> off -> on -> auto
        if (curr.userData.mode === 'auto') {
          curr.userData.mode = 'off';
          curr.userData.blinkTime = 0;
        } else if (curr.userData.mode === 'off') {
          curr.userData.mode = 'on';
          curr.userData.blinkTime = 0;
        } else {
          curr.userData.mode = 'auto';
          curr.userData.blinkTime = 0.4;
        }
      } else {
        // Day cycle: auto -> on -> off -> auto
        if (curr.userData.mode === 'auto') {
          curr.userData.mode = 'on';
          curr.userData.blinkTime = 0;
        } else if (curr.userData.mode === 'on') {
          curr.userData.mode = 'off';
          curr.userData.blinkTime = 0;
        } else {
          curr.userData.mode = 'auto';
          curr.userData.blinkTime = 0.4;
        }
      }
      return;
    }

    // Check if control panel clicked
    curr = object;
    while (curr && curr.name !== 'controlPanel') {
      curr = curr.parent;
    }
    if (curr) {
      if (ferrisWheel.userData.controller.panel === curr) ferrisWheel.userData.controller.toggle();
      if (carousel.userData.controller.panel === curr) carousel.userData.controller.toggle();
      if (tagada.userData.controller.panel === curr) tagada.userData.controller.toggle();
      if (coaster.userData.controller.panel === curr) coaster.userData.controller.toggle();
      if (train.userData.controller.panel === curr) train.userData.controller.toggle();
      return;
    }

    let checkHint = object;
    while (checkHint && checkHint.name !== 'rideHint_shootingGallery') {
      checkHint = checkHint.parent;
    }
    if (checkHint && checkHint.name === 'rideHint_shootingGallery') {
      shootingGallery.userData.controller.enterAimMode();
      return;
    }

    // Check if stage spotlight clicked
    curr = object;
    while (curr && curr.name !== 'stage_spotlight') {
      curr = curr.parent;
    }
    if (curr && curr.name === 'stage_spotlight') {
      const isNight = isNightNow(curr);
      if (!curr.userData.mode) curr.userData.mode = 'auto';

      if (isNight) {
        // Night cycle: auto -> off -> on -> auto
        if (curr.userData.mode === 'auto') {
          curr.userData.mode = 'off';
          curr.userData.blinkTime = 0;
        } else if (curr.userData.mode === 'off') {
          curr.userData.mode = 'on';
          curr.userData.blinkTime = 0;
        } else {
          curr.userData.mode = 'auto';
          curr.userData.blinkTime = 0.4;
        }
      } else {
        // Day cycle: auto -> on -> off -> auto
        if (curr.userData.mode === 'auto') {
          curr.userData.mode = 'on';
          curr.userData.blinkTime = 0;
        } else if (curr.userData.mode === 'on') {
          curr.userData.mode = 'off';
          curr.userData.blinkTime = 0;
        } else {
          curr.userData.mode = 'auto';
          curr.userData.blinkTime = 0.4;
        }
      }
    }
  });

  // EventBus: speed adjustments
  eventBus.on('speed-scroll', ({ rideId, delta }) => {
    if (rideId === 'coaster') {
      // the coaster's speed knob is `speedScale` (it scales the station
      // state-machine's physical speeds, not a simple angular multiplier)
      const c = coaster.userData.controller;
      c.speedScale = Math.max(0.2, Math.min(1.5, c.speedScale + delta));
      return;
    }
    let controller = null;
    if (rideId === 'ferrisWheel') controller = ferrisWheel.userData.controller;
    if (rideId === 'carousel') controller = carousel.userData.controller;
    if (rideId === 'tagada') controller = tagada.userData.controller;

    if (controller) {
      controller.speedMultiplier = Math.max(0.2, Math.min(1.5, controller.speedMultiplier + delta));
    }
  });

  // HUD Interactive Elements
  const colorInput = document.getElementById('lightColor');
  if (colorInput) {
    colorInput.addEventListener('input', () => {
      eventBus.emit('color-change', colorInput.value);
    });
  }

  const autoCheckbox = document.getElementById('autoTime');
  if (autoCheckbox) {
    autoCheckbox.addEventListener('change', () => {
      autoAdvance = autoCheckbox.checked;
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'BUTTON')) {
        return;
      }
      autoAdvance = !autoAdvance;
      if (autoCheckbox) autoCheckbox.checked = autoAdvance;
    }
    // T key: enter shooting gallery aim mode if nearby
    if (e.code === 'KeyT') {
      const sg = shootingGallery.userData.controller;
      if (sg && !sg.aimMode) {
        const dist = camera.position.distanceTo(new THREE.Vector3(12, 0, 24));
        if (dist < 50) {
          sg.enterAimMode();
        }
      }
    }
    // F key: trigger fireworks show
    if (e.code === 'KeyF') {
      eventBus.emit('trigger-fireworks-show');
    }
  });

  const helpBtn = document.getElementById('helpBtn');
  const helpPanel = document.getElementById('helpPanel');
  if (helpBtn && helpPanel) {
    helpBtn.addEventListener('click', () => {
      helpPanel.style.display = helpPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Cache every per-frame reference once — animate() must never traverse the scene.
  Object.assign(world, {
    river, vegetation, visitors, stage, ferrisWheel, carousel, tagada, coaster,
    lamps, stalls, fireworks, balloon, train, shootingGallery,
    gate: environmentGroup.getObjectByName('entranceGate'),
    timeInput: document.getElementById('timeOfDay'),
    timeVal: document.getElementById('timeVal'),
  });

  loaderEl.classList.add("hidden");

  // Emit initial light color after all async objects are loaded and listening
  if (colorInput) {
    eventBus.emit('color-change', colorInput.value);
  }
}

// ── Time HUD arc: a semicircular day-track with a sun/moon icon riding it ──
// Day (06–18) the sun travels the arc left→right; night the moon does. The
// label states the current phase (Dawn / Day / Dusk / Night).
let lastArcHour = -1;
function drawTimeArc(hour) {
  if (Math.abs(hour - lastArcHour) < 0.02) return;
  lastArcHour = hour;
  const cv = document.getElementById('timeArc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const cx = W / 2, cy = H - 22, R = 78;
  ctx.clearRect(0, 0, W, H);

  const isDay = hour >= 6 && hour < 18;
  // position along the arc: π (left/rise) → 0 (right/set)
  const frac = isDay ? (hour - 6) / 12 : ((hour + 6) % 12) / 12;
  const a = Math.PI * (1 - frac);
  const px = cx + Math.cos(a) * R, py = cy - Math.sin(a) * R;

  // track
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // horizon line
  ctx.beginPath();
  ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx + R + 8, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (isDay) {
    // sun: warm disc + rays
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = '#ffd76a';
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const ra = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra) * 11, Math.sin(ra) * 11);
      ctx.lineTo(Math.cos(ra) * 15, Math.sin(ra) * 15);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // moon: crescent via two discs
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = '#cdd8f5';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(5, -3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const label = (hour >= 5 && hour < 8) ? 'Dawn'
    : (hour >= 8 && hour < 17) ? 'Day'
    : (hour >= 17 && hour < 20) ? 'Dusk' : 'Night';
  ctx.fillStyle = 'rgba(255,235,200,0.85)';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + 17);
}

function setupTimeOfDayUI() {
  const timeInput = document.getElementById('timeOfDay');
  const timeVal = document.getElementById('timeVal');
  if (!timeInput || !timeVal) return;

  function fmt(h) {
    const hours = Math.floor(h);
    const mins = Math.floor((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  timeInput.addEventListener('input', () => {
    const h = parseFloat(timeInput.value);
    timeVal.textContent = fmt(h);
    if (dayNight) dayNight.setHour(h);
    drawTimeArc(h);
  });
  timeVal.textContent = fmt(parseFloat(timeInput.value));
  drawTimeArc(parseFloat(timeInput.value));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();
  const wind = getWindSpeed();
  if (!cameraManager || cameraManager.state !== 'flying') {
    controls.update(delta);
  }

  if (autoAdvance && dayNight) {
    const hoursPerSec = 0.05; // full day in ~8 minutes — slow enough to enjoy each phase
    let nextHour = dayNight.t * 24 + hoursPerSec * delta;
    if (nextHour >= 24) nextHour -= 24;
    dayNight.setHour(nextHour);

    if (world.timeInput) world.timeInput.value = nextHour;
    if (world.timeVal) {
      const h = Math.floor(nextHour);
      const m = Math.floor((nextHour - h) * 60);
      world.timeVal.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    drawTimeArc(nextHour);
  }

  if (world.river) world.river.userData.update(delta, time);
  if (world.vegetation?.userData.tick) world.vegetation.userData.tick(delta, time, wind);
  if (world.visitors?.userData.tick) world.visitors.userData.tick(delta, time);
  if (world.gate?.userData.tick) world.gate.userData.tick(delta, time, wind);
  if (world.stalls?.userData.tick) world.stalls.userData.tick(delta, time, wind);
  if (world.stage?.userData.tick) world.stage.userData.tick(delta, time);
  if (world.ferrisWheel?.userData.tick) world.ferrisWheel.userData.tick(delta, time);
  if (world.carousel?.userData.tick) world.carousel.userData.tick(delta, time);
  if (world.tagada?.userData.tick) world.tagada.userData.tick(delta, time);
  if (world.coaster?.userData.tick) world.coaster.userData.tick(delta, time);
  if (world.fireworks?.userData.tick) world.fireworks.userData.tick(delta, time);
  if (world.balloon?.userData.tick) world.balloon.userData.tick(delta, time, wind);
  if (world.train?.userData.tick) world.train.userData.tick(delta, time);
  if (world.shootingGallery?.userData.tick) world.shootingGallery.userData.tick(delta, time);

  for (const sign of rideSigns) {
    if (sign.userData.tick) sign.userData.tick(time, delta);
  }
  for (const hint of rideHints) {
    hint.userData.tick(time, camera, delta);
  }

  if (cameraManager) cameraManager.tick(delta);
  if (world.lamps?.userData.tick) world.lamps.userData.tick(delta, time);

  composer.render();

  // FPS counter
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLastTime >= 500) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
    if (fpsEl) fpsEl.textContent = `FPS: ${fps}`;
    fpsFrames = 0;
    fpsLastTime = now;
  }

  requestAnimationFrame(animate);
}


init()
  .then(() => animate())
  .catch((err) => {
    console.error('Init failed:', err);
    loaderEl.textContent = 'Failed to load scene — see console.';
  });

window.__lp = { THREE, scene, camera, renderer, controls, cameraManager };
