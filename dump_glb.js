import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read('./assets/models/environment/food_stall.glb');
const root = document.getRoot();
const nodes = root.listNodes();

nodes.forEach(n => {
  console.log(`Node: ${n.getName()}`);
  const t = n.getTranslation();
  console.log(`  Translation: ${t}`);
});
