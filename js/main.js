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
import { DayNightCycle } from "./lighting/DayNightCycle.js";

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

  console.log("hiding loader"); loaderEl.classList.add("hidden");
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
  controls.update(delta);

  const river = environmentGroup.getObjectByName('river');
  if (river && river.userData.update) river.userData.update(delta, time);

  const vegetation = environmentGroup.getObjectByName('vegetation');
  if (vegetation && vegetation.userData.tick) vegetation.userData.tick(delta, time, wind);

  const gate = environmentGroup.getObjectByName('entranceGate');
  if (gate && gate.userData.tick) gate.userData.tick(delta, time, wind);

  const ferris = environmentGroup.getObjectByName('ferrisWheel');
  if (ferris && ferris.userData.tick) ferris.userData.tick(delta, time);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

init()
  .then(() => animate())
  .catch((err) => {
    console.error('Init failed:', err);
    loaderEl.textContent = 'Failed to load scene — see console.';
  });

window.__lp = { scene, camera, renderer, controls };
