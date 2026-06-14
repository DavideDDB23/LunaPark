import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/out', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('pageerror', (e) => console.log('[error]', e.message));
page.on('console', (m) => {
  console.log('[page]', m.text());
});

console.log('Navigating to Luna Park...');
await page.goto('http://localhost:8123/index.html');

console.log('Waiting for loader to hide...');
await page.waitForSelector('#loader.hidden', { timeout: 120000 });
console.log('Scene loaded. Waiting 2 seconds for rendering stability...');
await page.waitForTimeout(2000);

console.log('Positioning camera to view river crossing and East fence...');
await page.evaluate(() => {
  if (window.__lp) {
    const { camera, controls, scene, THREE } = window.__lp;
    camera.position.set(40, 28, 65);
    controls.target.set(85, 3, 20);
    controls.update();

    const trainGroup = scene.getObjectByName('train');
    if (trainGroup) {
      console.log('Found train group');
      trainGroup.traverse((child) => {
        if (child.isInstancedMesh && child.geometry && child.geometry.type === 'CylinderGeometry') {
          console.log('Found pillars InstancedMesh, count =', child.count);
          const matrix = new THREE.Matrix4();
          const position = new THREE.Vector3();
          for (let i = 0; i < child.count; i++) {
            child.getMatrixAt(i, matrix);
            position.setFromMatrixPosition(matrix);
            console.log(`Pillar ${i}: [${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}]`);
          }
        }
      });
    } else {
      console.log('Train group not found');
    }
  } else {
    console.error('window.__lp not found!');
  }
});

await page.waitForTimeout(1000); // wait for frame render
await page.screenshot({ path: 'tests/out/train_final.png' });
console.log('Captured tests/out/train_final.png');

await browser.close();
console.log('Verification script completed.');
