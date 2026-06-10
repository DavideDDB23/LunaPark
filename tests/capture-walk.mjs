import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/out', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[error]', e.message));

await page.goto('http://localhost:8123/tests/walk-test.html');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
console.log('scene ready');
console.log(await page.evaluate(() => {
  const r = window.__vis.rig;
  return r ? JSON.stringify({
    L1: +r.legs.L.L1.toFixed(3), L2: +r.legs.L.L2.toFixed(3),
    legLen: +r.legLen.toFixed(3), hipSpan: +r.hipSpan.toFixed(3),
    ankleH: +r.ankleH.toFixed(3), scale: +r.scale.toFixed(3),
    stride: +window.__vis.strideArm.toFixed(3),
  }) : 'NO RIG';
}));

// wait until visitor 0 is fully walking
await page.waitForFunction(
  () => window.__vis.state === 'walking' && window.__vis.moveBlend > 0.92,
  null, { timeout: 60000 }
);
console.log('walking');

for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `tests/out/walk_${i}.png` });
  const info = await page.evaluate(() => ({
    phase: window.__vis.phase.toFixed(3),
    mb: window.__vis.moveBlend.toFixed(2),
    state: window.__vis.state,
  }));
  console.log(`frame ${i}`, JSON.stringify(info));
  await page.waitForTimeout(170);
}

// idle shot
await page.waitForFunction(
  () => window.__vis.state === 'waiting' && window.__vis.moveBlend < 0.1,
  null, { timeout: 120000 }
).catch(() => console.log('no idle reached'));
await page.screenshot({ path: 'tests/out/idle.png' });
console.log('done');
await browser.close();
