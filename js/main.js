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
import { DayNightCycle } from "./lighting/DayNightCycle.js";
import { CameraManager } from './camera/CameraManager.js';
import { eventBus } from './utils/EventBus.js';
import { InteractionManager } from './utils/InteractionManager.js';

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

const clock = new THREE.Clock();

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
let cameraManager = null;
const fpvTmpVec = new THREE.Vector3();

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
  return rides;
});
let autoAdvance = true;

async function init() {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  console.log("buildSky"); const skyInfo = await buildSky(scene, renderer);
  const lightInfo = buildLights(scene);

  environmentGroup.add(buildGround({ anisotropy: maxAniso }));

  console.log("buildPaths"); const paths = await buildPaths({ anisotropy: maxAniso });
  environmentGroup.add(paths);

  console.log("buildRiver"); const river = await buildRiver();
  environmentGroup.add(river);

  console.log("buildFence"); const fence = await buildFence({ anisotropy: maxAniso });
  environmentGroup.add(fence);

  console.log("buildLampposts"); const lamps = await buildLampposts();
  environmentGroup.add(lamps);

  console.log("buildFoodStalls"); const stalls = await buildFoodStalls();
  environmentGroup.add(stalls);

  console.log("buildVegetation"); const vegetation = await buildVegetation();
  environmentGroup.add(vegetation);

  console.log("buildBenches"); const benches = await buildBenches();
  environmentGroup.add(benches);

  environmentGroup.add(buildEntranceGate());
  const stage = buildStage({ anisotropy: maxAniso });
  environmentGroup.add(stage);

  console.log("buildFerrisWheel");
  const ferrisWheel = await buildFerrisWheel({ position: [-50, 0, -50], camera, renderer });
  environmentGroup.add(ferrisWheel);
  window.__lp.ferrisWheel = ferrisWheel.userData.controller;

  console.log("buildCarousel");
  const carousel = await buildCarousel({ position: [40, 0, -40], camera, renderer, anisotropy: maxAniso });
  environmentGroup.add(carousel);
  window.__lp.carousel = carousel.userData.controller;

  console.log("buildTagada");
  const tagada = await buildTagada({ position: [-40, 0, 40], camera, renderer, anisotropy: maxAniso });
  environmentGroup.add(tagada);
  window.__lp.tagada = tagada.userData.controller;

  // Day/night controller — slider in HUD drives this.
  dayNight = new DayNightCycle({
    scene,
    renderer,
    sun: lightInfo.sun,
    hemi: lightInfo.hemi,
    setSkyTime: skyInfo.setTime,
    getLamps: () => lamps.children,
    getStageSpotLight: () => stage.userData.spotLight,
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
  const interactionManager = new InteractionManager(camera, renderer, scene);

  // Register lampposts
  lamps.children.forEach(lamp => {
    interactionManager.registerClickable(lamp);
  });

  // Register ride control panels
  interactionManager.registerClickable(ferrisWheel.userData.controller.panel);
  interactionManager.registerClickable(carousel.userData.controller.panel);
  interactionManager.registerClickable(tagada.userData.controller.panel);

  // Register rides for speed-scrolling
  interactionManager.registerRide(ferrisWheel);
  interactionManager.registerRide(carousel);
  interactionManager.registerRide(tagada);

  // EventBus: click interactions
  eventBus.on('interact-click', ({ object }) => {
    // Check if lamppost clicked
    let curr = object;
    while (curr && !curr.userData.lampId) {
      curr = curr.parent;
    }
    if (curr && curr.userData.lampId) {
      curr.userData.isManual = true;
      curr.userData.targetOn = !curr.userData.targetOn;
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
    }
  });

  // EventBus: speed adjustments
  eventBus.on('speed-scroll', ({ rideId, delta }) => {
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
  });

  const helpBtn = document.getElementById('helpBtn');
  const helpPanel = document.getElementById('helpPanel');
  if (helpBtn && helpPanel) {
    helpBtn.addEventListener('click', () => {
      helpPanel.style.display = helpPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  console.log("hiding loader"); loaderEl.classList.add("hidden");

  // Emit initial light color after all async objects are loaded and listening
  if (colorInput) {
    eventBus.emit('color-change', colorInput.value);
  }
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
  });
  timeVal.textContent = fmt(parseFloat(timeInput.value));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();
  const wind = getWindSpeed();
  if (!cameraManager || cameraManager.state !== 'flying') {
    controls.update(delta);
  }

  if (autoAdvance && dayNight) {
    const hoursPerSec = 0.4;
    let nextHour = dayNight.t * 24 + hoursPerSec * delta;
    if (nextHour >= 24) nextHour -= 24;
    dayNight.setHour(nextHour);

    const timeInput = document.getElementById('timeOfDay');
    const timeVal = document.getElementById('timeVal');
    if (timeInput) timeInput.value = nextHour;
    if (timeVal) {
      const h = Math.floor(nextHour);
      const m = Math.floor((nextHour - h) * 60);
      timeVal.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const river = environmentGroup.getObjectByName('river');
  if (river && river.userData.update) river.userData.update(delta, time);

  const vegetation = environmentGroup.getObjectByName('vegetation');
  if (vegetation && vegetation.userData.tick) vegetation.userData.tick(delta, time, wind);

  const gate = environmentGroup.getObjectByName('entranceGate');
  if (gate && gate.userData.tick) gate.userData.tick(delta, time, wind);

  const stage = environmentGroup.getObjectByName('stage');
  if (stage && stage.userData.tick) stage.userData.tick(delta, time);

  const ferris = environmentGroup.getObjectByName('ferrisWheel');
  if (ferris && ferris.userData.tick) ferris.userData.tick(delta, time);

  const carousel = environmentGroup.getObjectByName('carousel');
  if (carousel && carousel.userData.tick) carousel.userData.tick(delta, time);

  const tagada = environmentGroup.getObjectByName('tagada');
  if (tagada && tagada.userData.tick) tagada.userData.tick(delta, time);

  if (cameraManager) cameraManager.tick(delta);
  const lamps = environmentGroup.getObjectByName('lampposts');
  if (lamps && lamps.userData.tick) {
    lamps.userData.tick(delta, time);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

init()
  .then(() => animate())
  .catch((err) => {
    console.error('Init failed:', err);
    loaderEl.textContent = 'Failed to load scene — see console.';
  });

window.__lp = { THREE, scene, camera, renderer, controls, cameraManager };
