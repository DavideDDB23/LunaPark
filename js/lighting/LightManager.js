import * as THREE from 'three';

export function buildLights(scene) {
  const group = new THREE.Group();
  group.name = 'lights';

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.8);
  hemi.position.set(0, 100, 0);
  hemi.name = 'hemi';
  group.add(hemi);

  const sun = new THREE.DirectionalLight(0xfffae0, 2.5);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, 0);
  sun.name = 'sun';
  group.add(sun);
  group.add(sun.target);

  scene.add(group);
  return { hemi, sun, group };
}
