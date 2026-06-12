import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/out', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('pageerror', (e) => console.log('[error]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text());
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
    const { camera, controls } = window.__lp;
    // Look at river crossing [82, 5.5, 0] and East fence corridor [92, 0, 30] from a good angle
    camera.position.set(40, 28, 65);
    controls.target.set(85, 3, 20);
    controls.update();
  } else {
    console.error('window.__lp not found!');
  }
});

await page.waitForTimeout(1000); // wait for frame render
await page.screenshot({ path: 'tests/out/train_final.png' });
console.log('Captured tests/out/train_final.png');

await browser.close();
console.log('Verification script completed.');
