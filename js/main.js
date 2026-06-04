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
let rideSigns = [];

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

  // Coaster builds before vegetation so trees can be kept clear of its exact track footprint.
  console.log("buildCoaster");
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
  ];
  // Tree keep-out [x, z, radius] for each frontage so the signs/panels stay visible from the path:
  // a circle at the sign, another IN FRONT of it (along its facing dir, toward the path), + the panel.
  const signKeepOut = [];
  for (const f of FRONTAGES) {
    const yaw = faceYaw(f.sign[0]);
    const fx = Math.sin(yaw), fz = Math.cos(yaw); // unit vector the sign faces (toward the path)
    signKeepOut.push([f.sign[0], f.sign[2], 10.0]);
    signKeepOut.push([f.sign[0] + fx * 9, f.sign[2] + fz * 9, 8.0]);
    signKeepOut.push([f.panel[0], f.panel[2], 4.5]);
  }

  console.log("buildVegetation");
  const vegetation = await buildVegetation({ coasterFootprint: coaster.userData.footprint, signKeepOut });
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

  // ── Place each ride's frontage: build the name marquee and move the ride's on/off control panel
  //    to it, both facing the path/entrance (see FRONTAGES above). ──
  console.log("buildRideFrontages");
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
    return s;
  });
  window.__lp.rideSigns = rideSigns;

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

  const stage = environmentGroup.getObjectByName('stage');
  if (stage && stage.userData.tick) stage.userData.tick(delta, time);

  const ferris = environmentGroup.getObjectByName('ferrisWheel');
  if (ferris && ferris.userData.tick) ferris.userData.tick(delta, time);

  const carousel = environmentGroup.getObjectByName('carousel');
  if (carousel && carousel.userData.tick) carousel.userData.tick(delta, time);

  const tagada = environmentGroup.getObjectByName('tagada');
  if (tagada && tagada.userData.tick) tagada.userData.tick(delta, time);

  const coaster = environmentGroup.getObjectByName('coaster');
  if (coaster && coaster.userData.tick) coaster.userData.tick(delta, time);

  for (const sign of rideSigns) {
    if (sign.userData.tick) sign.userData.tick(time, delta);
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

window.__lp = { THREE, scene, camera, renderer, controls };
