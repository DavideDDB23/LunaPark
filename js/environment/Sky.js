import * as THREE from 'three';
import { loadHDR } from '../utils/loaders.js';

export async function buildSky(scene, renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const texture = await loadHDR('assets/sunflowers_puresky_2k.hdr');
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;

  scene.background = envMap;
  scene.environment = envMap;

  texture.dispose();
  pmremGenerator.dispose();
  
  return { sky: texture };
}
