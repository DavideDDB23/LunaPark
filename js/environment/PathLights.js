import * as THREE from 'three';

export function buildPathLights() {
  const group = new THREE.Group();
  group.name = 'pathLights';

  const positions = [
    [-3, 0, 35], [3, 0, 35],
    [-3, 0, -15], [3, 0, -15],
    [-3, 0, -50], [3, 0, -50],
  ];

  const bulbGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffeeaa,
    emissive: 0xffdd88,
    emissiveIntensity: 0,
    roughness: 0.3,
  });

  for (const [x, y, z] of positions) {
    const bulb = new THREE.Mesh(bulbGeo, bulbMat.clone());
    bulb.position.set(x, 0.5, z);
    group.add(bulb);

    const light = new THREE.SpotLight(0xffeedd, 0, 25, Math.PI / 5, 0.6, 1.5);
    light.position.set(x, 4, z);
    light.target.position.set(x, 0, z - 4);
    light.layers.set(3);
    group.add(light);
    group.add(light.target);
  }

  const bulbs = group.children.filter(c => c.isMesh);
  const spots = group.children.filter(c => c.isLight);

  group.userData.tick = (delta, time) => {
    const sun = group.parent?.getObjectByName('sun') || group.parent?.parent?.getObjectByName('sun');
    const isNight = sun ? (sun.position.y < 5.0 || sun.intensity < 0.5) : false;
    const target = isNight ? 1.2 : 0;
    for (const b of bulbs) {
      b.material.emissiveIntensity += (target - b.material.emissiveIntensity) * 0.05;
    }
    for (const s of spots) {
      s.intensity += (isNight ? 8 : 0 - s.intensity) * 0.05;
    }
  };

  return group;
}
