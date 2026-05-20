import * as THREE from 'three';
import { loadObjMtl } from '../utils/loaders.js';

const MODELS = [
  'BirchTree_1', 'BirchTree_2', 'BirchTree_4',
  'CommonTree_1', 'CommonTree_2', 'CommonTree_4',
  'PineTree_1', 'PineTree_3', 'PineTree_5',
  'Willow_1', 'Willow_3',
  'Bush_1', 'Bush_2',
  'BushBerries_1',
  'Rock_1', 'Rock_3', 'Rock_Moss_1', 
  'WoodLog', 'TreeStump', 'Flowers'
];
const BASE_URL = 'assets/models/Environment/';

export async function buildVegetation() {
  const group = new THREE.Group();
  group.name = 'vegetation';

  const loadedModels = [];
  const promises = MODELS.map(name => 
    loadObjMtl(`${BASE_URL}${name}.obj`, `${BASE_URL}${name}.mtl`)
      .then(model => {
        model.name = name;
        // Need to scale? Usually these poly packs are not exactly 1 unit but let's check size
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        let targetHeight = 10.0;
        if (name.includes('Bush')) targetHeight = 1.5;
        if (name.includes('Berries')) targetHeight = 1.2;
        if (name.includes('Pine')) targetHeight = 12.0;
        if (name.includes('Rock')) targetHeight = 0.8 + Math.random() * 1.5;
        if (name.includes('Log') || name.includes('Stump')) targetHeight = 0.6;
        if (name.includes('Flower')) targetHeight = 0.4;

        const scale = size.y > 0 ? targetHeight / size.y : 1;
        model.scale.setScalar(scale);

        // Normalize Y origin
        bbox.setFromObject(model);
        const yOffset = -bbox.min.y;
        
        model.userData = { yOffset, original: true };
        loadedModels.push(model);
      })
      .catch(err => console.error(`Failed to load ${name}:`, err))
  );

  await Promise.all(promises);

  const numItems = 400; // reduced instances
  for (let i = 0; i < numItems; i++) {
    const x = (Math.random() - 0.5) * 190;
    const z = (Math.random() - 0.5) * 190;

    // Skip paths
    if (Math.abs(x) < 5 || Math.abs(z) < 11) continue;
    
    // Skip central ring
    if (x * x + z * z < 15 * 15) continue;

    // Skip stage area
    if (Math.abs(x) < 15 && z < -65) continue;

    // Skip 4 ride holes (approx radius 30 around |x|=50, |z|=50)
    if (Math.hypot(Math.abs(x) - 50, Math.abs(z) - 50) < 30) continue;

    const source = loadedModels[Math.floor(Math.random() * loadedModels.length)];
    if (!source) continue;

    const instance = source.clone(true);
    
    // Random rotation & scale variation
    instance.rotation.y = Math.random() * Math.PI * 2;
    const scaleVar = 0.8 + Math.random() * 0.4;
    instance.scale.multiplyScalar(scaleVar);
    
    instance.position.set(x, source.userData.yOffset * scaleVar, z);
    group.add(instance);
  }

  return group;
}
