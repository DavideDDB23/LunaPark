import * as THREE from 'three';

function createSeededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function createConeTree(rand) {
  const trunkHeight = 2 + rand() * 3;
  const trunkRadius = 0.15 + rand() * 0.15;
  const crownHeight = 4 + rand() * 4;
  const crownRadius = 1.5 + rand() * 2;
  const greenShade = 0.2 + rand() * 0.3;

  const group = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 1, metalness: 0 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const crownGeo = new THREE.ConeGeometry(crownRadius, crownHeight, 6);
  const crownMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(greenShade * 0.8 + 0.1, greenShade + 0.2, greenShade * 0.5 + 0.05),
    roughness: 1,
    metalness: 0
  });
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.position.y = trunkHeight + crownHeight / 2;
  group.add(crown);

  return group;
}

export function buildExternalScenery(scene) {
  const group = new THREE.Group();
  group.name = 'externalScenery';

  const rand = createSeededRandom(12345);

  // 1. External ground ring at y=-0.1 to avoid z-fighting with park ground
  const ringGeo = new THREE.RingGeometry(100, 500, 64);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x3a5c2a,
    roughness: 1,
    metalness: 0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.1;
  ring.receiveShadow = false;
  group.add(ring);

  // 2. External trees (~150) outside the fence with 10m buffer
  const treeCount = 150;
  let placed = 0;
  let attempts = 0;

  while (placed < treeCount && attempts < treeCount * 20) {
    attempts++;
    const x = (rand() - 0.5) * 560;
    const z = (rand() - 0.5) * 560;

    const outsideX = Math.abs(x) > 110;
    const outsideZ = Math.abs(z) > 110;
    if (!outsideX && !outsideZ) continue;
    if (Math.abs(x) > 280 || Math.abs(z) > 280) continue;

    const tree = createConeTree(rand);
    tree.position.set(x, 0, z);

    const scale = 0.7 + rand() * 0.6;
    tree.scale.setScalar(scale);
    tree.rotation.y = rand() * Math.PI * 2;

    tree.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    group.add(tree);
    placed++;
  }

  // 3. Distant hills (6 low-poly hills at radius 150-300)
  const hillCount = 6;
  for (let i = 0; i < hillCount; i++) {
    const angle = (i / hillCount) * Math.PI * 2 + rand() * 0.3;
    const dist = 160 + rand() * 120;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const hillRadius = 25 + rand() * 30;

    const geo = new THREE.SphereGeometry(hillRadius, 10, 7);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.15 + rand() * 0.15, 0.25 + rand() * 0.2, 0.08 + rand() * 0.1),
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.y = 0.25 + rand() * 0.3;
    mesh.position.set(x, -0.1, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    group.add(mesh);
  }

  scene.add(group);
}
