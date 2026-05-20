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
import { buildEntranceGate } from './environment/Props.js';

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

async function init() {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  console.log("buildSky"); await buildSky(scene, renderer);
  buildLights(scene);

  environmentGroup.add(buildGround({ anisotropy: maxAniso }));
  
  console.log("buildPaths"); const paths = await buildPaths({ anisotropy: maxAniso });
  environmentGroup.add(paths);

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
  environmentGroup.add(buildStage({ anisotropy: maxAniso }));

  console.log("hiding loader"); loaderEl.classList.add("hidden");
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  const delta = clock.getDelta();
  controls.update(delta);
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
