import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { Easings } from './utils/Easings.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { buildGround } from './environment/Ground.js';
import { buildPaths } from './environment/Paths.js';
import { buildSky } from './environment/Sky.js';
import { buildLights } from './lighting/LightManager.js';
import { buildFence } from './environment/Fence.js';
import { buildExternalScenery } from './environment/ExternalScenery.js';
import { buildLampposts } from './environment/Lampposts.js';
import { buildFoodStalls } from './environment/FoodStalls.js';
import { buildStage } from './environment/Stage.js';
import { buildVegetation } from './environment/Vegetation.js';
import { buildBenches } from './environment/Benches.js';
import { buildEntranceGate } from './environment/Props.js';
import { buildRiver } from './environment/River.js';
import { buildFerrisWheel } from './rides/FerrisWheel.js';
import { buildCarousel } from './rides/Carousel.js';
import { buildTagada } from './rides/Tagada.js';
import { buildCoaster } from './rides/Coaster.js';
import { buildBalloon } from './rides/Balloon.js';
import { buildTrain } from './rides/Train.js';
import { buildShootingGallery } from './rides/ShootingGallery.js';
import { buildRideSign } from './ui/RideSign.js';
import { buildRideHint } from './ui/RideHints.js';
import { buildVisitors } from './people/Visitors.js';
import { buildFireworks } from './environment/Fireworks.js';
import { DayNightCycle, isNightNow } from './lighting/DayNightCycle.js';
import { CameraManager } from './controls/CameraManager.js';
import { eventBus } from './utils/EventBus.js';
import { InteractionManager } from './controls/InteractionManager.js';
import { getWindSpeed, drawTimeArc, setupTimeOfDayUI } from './ui/Hud.js';
import { setupRideHotbar } from './ui/RideHotbar.js';

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

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
bloomPass.threshold = 1.5;
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
const world = {};
let balloons = []; // populated in init(), referenced by the CameraManager rides callback

cameraManager = new CameraManager(camera, scene, controls, renderer, () => {
  const rides = [];
  const tmpVec = new THREE.Vector3();
  const fw = environmentGroup.getObjectByName('ferrisWheel');
  if (fw) rides.push({
    group: fw,
    getFpvTarget: () => {
      const c = fw.userData.controller;
      if (!c || !c.gondolaMounts || c.gondolaMounts.length === 0) {
        console.warn('[FPV] ferris: no gondolaMounts available');
        return null;
      }
      // Prefer the highest gondola; fall back to the first if no cameraRig found.
      let best = null, bestY = -Infinity;
      for (const gm of c.gondolaMounts) {
        gm.gondolaMesh.getWorldPosition(tmpVec);
        if (tmpVec.y > bestY) { bestY = tmpVec.y; best = gm; }
      }
      if (best?.cameraRig) return best.cameraRig;
      // Fallback: any mount with a cameraRig, else first mount's cameraRig
      for (const gm of c.gondolaMounts) {
        if (gm.cameraRig) return gm.cameraRig;
      }
      return c.gondolaMounts[0].cameraRig || null;
    },
    getFpvOffset: () => new THREE.Vector3(0, 0, 0),
    getRiders: () => {
      const c = fw.userData.controller;
      if (!c || !c.gondolaMounts) return [];
      let best = null, bestY = -Infinity;
      for (const gm of c.gondolaMounts) {
        gm.gondolaMesh.getWorldPosition(tmpVec);
        if (tmpVec.y > bestY) { bestY = tmpVec.y; best = gm; }
      }
      return best ? best.passengers : [];
    },
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTarget.getWorldPosition(targetVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // 10m along the rig's -Z (= gondola's +Z = radial outward = view direction)
      fpvTmpVec.set(0, 0, -10);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      // Rig is child of gondolaMesh. Read gondolaMesh's world up so the camera
      // follows the gondola's orientation (gondola is world-stable, so up = world Y).
      fpvTarget.parent.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  const cr = environmentGroup.getObjectByName('carousel');
  if (cr) rides.push({
    group: cr,
    getFpvTarget: () => cr.userData.controller.horses[0]?.cameraRig || null,
    getFpvOffset: () => new THREE.Vector3(0, 0, 0),
    getRiders: () => {
      const r = cr.userData.controller.horses[0]?.rider;
      return r ? [r] : [];
    },
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTarget.getWorldPosition(targetVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // 10m along the rig's -Z (= container's +X = tangential forward = travel direction)
      fpvTmpVec.set(0, 0, -10);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      // Rig is child of horseContainer. Read container's world up so the camera
      // follows the carousel rotation (rotatingAssembly yaw + per-horse Y-bob).
      fpvTarget.parent.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  const tg = environmentGroup.getObjectByName('tagada');
  if (tg) rides.push({
    group: tg,
    getFpvTarget: () => tg.userData.controller.seats[0]?.cameraRig || null,
    getFpvOffset: () => new THREE.Vector3(0, 0, 0),
    getRiders: () => {
      const r = tg.userData.controller.seats[0]?.rider;
      return r ? [r] : [];
    },
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTarget.getWorldPosition(targetVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // 10m along the rig's +Z. Rig has no Y-flip, so its +Z = seat-local +Z,
      // pointing toward the disc centre (matching the rider's gaze).
      fpvTmpVec.set(0, 0, 10);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      // Rig is child of seatGroup. Read seatGroup's world up so the camera
      // follows the disc tilt (armTilt applied to ancestor of discMeshGroup).
      fpvTarget.parent.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  const co = environmentGroup.getObjectByName('coaster');
  if (co) rides.push({
    group: co,
    getFpvTarget: () => co.userData.controller.cars[0]?.cameraRig || null,
    getFpvOffset: () => new THREE.Vector3(0, 0, 0),
    getRiders: () => co.userData.controller.cars[0].riders,
    // FPV via camera-rig: rig is a child of cars[0].dolly (built in Coaster.js),
    // positioned at the head of the front-row passenger with rotation.y = PI
    // so its local -Z aligns with the dolly's +Z (direction of travel).
    // Rig inherits dolly's full transform (roll, pitch, yaw) automatically.
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTarget.getWorldPosition(targetVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // 10m along the rig's -Z (= dolly's +Z = forward direction of travel)
      fpvTmpVec.set(0, 0, -10);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      // Rig is child of dolly. Read dolly's world up so the camera follows
      // the dolly's banking (roll) as it traverses the track.
      fpvTarget.parent.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  const tr = environmentGroup.getObjectByName('train');
  if (tr) rides.push({
    group: tr,
    getFpvTarget: () => tr.userData.controller.cars[0]?.cameraRig || null,
    getFpvOffset: () => new THREE.Vector3(0, 0, 0),
    getRiders: () => tr.userData.controller.riders ? tr.userData.controller.riders.slice(0, 1) : [],
    getFpvCameraPos: (fpvTarget, targetVec) => {
      fpvTarget.getWorldPosition(targetVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // 10m along the rig's -Z. Rig has Y-rotation = PI, so its -Z = wrapper's +Z
      // (= direction of travel, where the existing look target offset pointed).
      fpvTmpVec.set(0, 0, -10);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      // Rig is child of car mesh. Read car's world up so the camera follows
      // the curve-banking tilt (cars[i].mesh.rotateZ applied in tick).
      fpvTarget.parent.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
  if (balloons && balloons[0]) {
    const b1 = balloons[0];
    rides.push({
      group: b1,
      getFpvTarget: () => b1.userData.cameraRig,
      getFpvOffset: () => new THREE.Vector3(0, 0, 0),
      getRiders: () => (b1.userData.riders || []).map(r => ({ pivot: r.pivot })),
      getFpvCameraPos: (fpvTarget, targetVec) => {
        fpvTarget.getWorldPosition(targetVec);
      },
      getFpvLookTarget: (fpvTarget, targetVec) => {
        // 10m along the rig's -Z. Rig has no Y-flip, so its -Z gives a stable
        // horizontal gaze direction in the basket frame. The balloon doesn't
        // yaw, so this direction is fixed in world space (modulo pitch/roll
        // from b.rotation.x/z in tick).
        fpvTmpVec.set(0, 0, -10);
        fpvTarget.localToWorld(fpvTmpVec);
        targetVec.copy(fpvTmpVec);
      },
      getFpvUp: (fpvTarget, upVec) => {
        // Rig is child of node. Read node's world up (parent of rig is the
        // GLB sub-root, but node itself is parent of rig; b.rotation.x/z tilt
        // is applied to the b group, which is the GRANDPARENT of the rig).
        // Use b's world up to capture the basket pitch/roll.
        fpvTarget.parent.parent.getWorldQuaternion(fpvTmpQuat);
        upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
      }
    });
  }
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

  buildExternalScenery(scene);

  const lamps = await buildLampposts();
  environmentGroup.add(lamps);

  const stalls = await buildFoodStalls();
  environmentGroup.add(stalls);

  const coaster = await buildCoaster({ position: [52, 0, 54], camera, renderer, anisotropy: maxAniso });
  environmentGroup.add(coaster);
  window.__lp.coaster = coaster.userData.controller;

  const SOUTH_BIAS = 25;
  const faceYaw = (x) => Math.atan2(-x, SOUTH_BIAS);
  const FRONTAGES = [
    { title: 'TANGLED TWISTER', theme: 'coaster',  groupName: 'coaster',     sign: [15, 0, 44],   panel: [9, 0, 50] },
    { title: 'SKY WHEEL',       theme: 'ferris',    groupName: 'ferrisWheel', sign: [-26, 0, -38], panel: [-18, 0, -32] },
    { title: 'GOLDEN CAROUSEL', theme: 'carousel',  groupName: 'carousel',    sign: [22, 0, -26],  panel: [15, 0, -20] },
    { title: 'TURBO TAGADA',    theme: 'tagada',    groupName: 'tagada',      sign: [-22, 0, 28],  panel: [-15, 0, 34] },
    { title: 'SCENIC RAILWAY',  theme: 'train',     groupName: 'train',       sign: [76, 0, -65],   panel: [68, 0, -60] },
    { title: 'SHOOTING GALLERY', theme: 'gallery',  groupName: 'shootingGallery', sign: [11, 0, 20], panel: null },
  ];
  const signKeepOut = [];
  for (const f of FRONTAGES) {
    const yaw = faceYaw(f.sign[0]);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    signKeepOut.push([f.sign[0], f.sign[2], 10.0]);
    signKeepOut.push([f.sign[0] + fx * 9, f.sign[2] + fz * 9, 8.0]);
    if (f.panel) {
      signKeepOut.push([f.panel[0], f.panel[2], 4.5]);
    }
  }

  const train = await buildTrain({ anisotropy: maxAniso });
  environmentGroup.add(train);
  window.__lp.train = train.userData.controller;

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

  const fireworks = buildFireworks();
  scene.add(fireworks);

  const balloonData = await buildBalloon();
  const balloonContainer = balloonData.group;
  balloons = balloonData.balloons;
  environmentGroup.add(balloonContainer);

  const shootingGallery = await buildShootingGallery({ camera, renderer, controls });
  const sgYaw = faceYaw(11);
  const sgOffset = new THREE.Vector3(0, 0, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), sgYaw);
  shootingGallery.position.set(11 + sgOffset.x, 0, 20 + sgOffset.z);
  shootingGallery.rotation.y = sgYaw;
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

  {
    const fw = environmentGroup.getObjectByName('ferrisWheel');
    if (fw) { fw.userData.rideId = 'ferris'; fw.userData.rideName = 'Ruota'; }
    const cr = environmentGroup.getObjectByName('carousel');
    if (cr) { cr.userData.rideId = 'carousel'; cr.userData.rideName = 'Carosello'; }
    const tg = environmentGroup.getObjectByName('tagada');
    if (tg) { tg.userData.rideId = 'tagada'; tg.userData.rideName = 'Tagada'; }
    const co = environmentGroup.getObjectByName('coaster');
    if (co) { co.userData.rideId = 'coaster'; co.userData.rideName = 'Montagne Russe'; }
    const tr = environmentGroup.getObjectByName('train');
    if (tr) { tr.userData.rideId = 'train'; tr.userData.rideName = 'Brucomela'; }
  }

  rideSigns = FRONTAGES.map(({ title, theme, groupName, sign, panel }) => {
    const group = environmentGroup.getObjectByName(groupName);

    const s = buildRideSign({ title, theme, anisotropy: maxAniso });
    s.position.set(sign[0], sign[1], sign[2]);
    s.rotation.y = faceYaw(sign[0]);
    environmentGroup.add(s);

    const ctrl = group && group.userData.controller;
    if (ctrl && ctrl.panel) {
      const gp = group.position;
      ctrl.panel.position.set(panel[0] - gp.x, -gp.y, panel[2] - gp.z);
      ctrl.panel.rotation.set(0, faceYaw(panel[0]), 0);
    }

    // For the shooting gallery there is no panel — put the hint above the
    // sign itself so it floats clearly above it.
    const hintPos = groupName === 'shootingGallery'
      ? [sign[0], 10.8, sign[2]]
      : panel ? [panel[0], 9.2, panel[2]] : [sign[0], 9.2, sign[2]];
    const hintLines = groupName === 'shootingGallery'
      ? ['🎯  Click to Play', 'Press ESC to Exit  •  T to aim']
      : ['Click Panel to Turn On/Off', 'Scroll on Panel: Speed'];
    const hint = buildRideHint({ position: hintPos, lines: hintLines });
    hint.name = 'rideHint_' + groupName;
    environmentGroup.add(hint);
    rideHints.push(hint);
    return s;
  });
  window.__lp.rideSigns = rideSigns;

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

  setupTimeOfDayUI(dayNight);
  dayNight.setHour(12);

  const interactionManager = new InteractionManager(camera, renderer, scene, controls);

  lamps.children.forEach(lamp => {
    if (lamp.name.startsWith('lamp_')) {
      interactionManager.registerClickable(lamp);
    }
  });

  interactionManager.registerClickable(ferrisWheel.userData.controller.panel);
  interactionManager.registerClickable(carousel.userData.controller.panel);
  interactionManager.registerClickable(tagada.userData.controller.panel);
  interactionManager.registerClickable(coaster.userData.controller.panel);
  interactionManager.registerClickable(train.userData.controller.panel);

  const sgHint = rideHints.find(h => h.name === 'rideHint_shootingGallery');
  if (sgHint) {
    interactionManager.registerClickable(sgHint);
  }

  interactionManager.registerClickable(stage.userData.spotLight);
  cameraManager.setInteractiveObjects(interactionManager.interactiveObjects);

  setupRideHotbar({
    rides: [
      { id: 'ferris',   name: 'Ruota',          icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="7"/><path d="M12 3v14M5 10h14M7.05 5.05l9.9 9.9M7.05 14.95l9.9-9.9"/><circle cx="12" cy="10" r="1.2" fill="currentColor"/></svg>' },
      { id: 'carousel', name: 'Carosello',      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M3 9h18v2a9 9 0 0 1-18 0V9z"/><path d="M12 7v4"/></svg>' },
      { id: 'coaster',  name: 'Montagne Russe', icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h4v-3a3 3 0 0 1 6 0v3h4v-3a3 3 0 0 1 6 0v3"/><circle cx="6" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>' },
      { id: 'tagada',   name: 'Tagada',         icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>' },
      { id: 'train',    name: 'Brucomela',      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="6" width="14" height="11" rx="2"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="15" cy="20" r="1.5" fill="currentColor"/><path d="M5 12h14"/></svg>' },
      { id: 'balloon',  name: 'Mongolfiera',    icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-3.5 0-6 2.5-6 6 0 4 3 8 6 8s6-4 6-8c0-3.5-2.5-6-6-6z"/><path d="M9 17l3 4 3-4"/><path d="M12 7v6"/></svg>' }
    ],
    onSelect: (id, opts) => {
      if (opts && opts.toggle) {
        cameraManager.exitFPV();
      } else {
        cameraManager.enterFPVById(id);
      }
    },
    getActiveRideId: () =>
      cameraManager.isFPV ? cameraManager._fpvRide?.group?.userData?.rideId ?? null : null
  });

  eventBus.on('interact-click', ({ object }) => {
    let curr = object;
    while (curr && !curr.userData.lampId) {
      curr = curr.parent;
    }
    if (curr && curr.userData.lampId) {
      const isNight = isNightNow(curr);
      if (!curr.userData.mode) curr.userData.mode = 'auto';

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
      return;
    }

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

    curr = object;
    while (curr && curr.name !== 'stage_spotlight') {
      curr = curr.parent;
    }
    if (curr && curr.name === 'stage_spotlight') {
      const isNight = isNightNow(curr);
      if (!curr.userData.mode) curr.userData.mode = 'auto';

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
  });

  eventBus.on('speed-scroll', ({ rideId, delta }) => {
    if (rideId === 'coaster') {
      const c = coaster.userData.controller;
      const target = Math.max(0.2, Math.min(1.5, c.speedScale + delta));
      new TWEEN.Tween(c).to({ speedScale: target }, 300).easing(Easings.SMOOTH).start();
      return;
    }
    let controller = null;
    if (rideId === 'ferrisWheel') controller = ferrisWheel.userData.controller;
    if (rideId === 'carousel') controller = carousel.userData.controller;
    if (rideId === 'tagada') controller = tagada.userData.controller;

    if (controller) {
      const target = Math.max(0.2, Math.min(1.5, controller.speedMultiplier + delta));
      new TWEEN.Tween(controller).to({ speedMultiplier: target }, 300).easing(Easings.SMOOTH).start();
    }
  });

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
    if (e.code === 'KeyT') {
      const sg = shootingGallery.userData.controller;
      if (sg && !sg.aimMode) {
        const dist = camera.position.distanceTo(new THREE.Vector3(12, 0, 24));
        if (dist < 50) {
          sg.enterAimMode();
        }
      }
    }
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

  Object.assign(world, {
    river, vegetation, visitors, stage, ferrisWheel, carousel, tagada, coaster,
    lamps, stalls, fireworks, balloons, train, shootingGallery,
    gate: environmentGroup.getObjectByName('entranceGate'),
    timeInput: document.getElementById('timeOfDay'),
    timeVal: document.getElementById('timeVal'),
  });

  loaderEl.classList.add("hidden");

  if (colorInput) {
    eventBus.emit('color-change', colorInput.value);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  TWEEN.update();
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();
  const wind = getWindSpeed();
  if (!cameraManager || cameraManager.state !== 'flying') {
    controls.update(delta);
  }

  if (autoAdvance && dayNight) {
    const hoursPerSec = 0.05;
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
  if (world.balloons) {
    for (const b of world.balloons) {
      if (b.userData.tick) b.userData.tick(delta, time, wind);
    }
  }
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
