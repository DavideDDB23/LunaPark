import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('tests/out', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[error]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });

await page.goto('http://localhost:8123/index.html');
await page.waitForSelector('#loader.hidden', { timeout: 120000 });
console.log('scene ready');

// stop auto time so shots are deterministic
await page.evaluate(() => { const cb = document.getElementById('autoTime'); if (cb.checked) cb.click(); });

const setHour = (h) => page.evaluate((hh) => {
  const t = document.getElementById('timeOfDay');
  t.value = hh;
  t.dispatchEvent(new Event('input'));
}, h);

const setCam = (pos, tgt) => page.evaluate(([p, t]) => {
  const { camera, controls } = window.__lp;
  camera.position.set(...p);
  controls.target.set(...t);
  controls.update();
}, [pos, tgt]);

const shot = async (name, waitMs = 1200) => {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `tests/out/${name}.png` });
  console.log('shot', name);
};

// let async performers/templates finish loading
await page.waitForTimeout(4000);

// 1. Stage performers, day
await setHour(12);
await setCam([0, 8, -64], [0, 3, -86]);
await shot('stage_day');

// 2. Stage performers + beams, night
await setHour(22);
await shot('stage_night');

// 3. Night overview (moonlight check)
await setCam([60, 45, 80], [0, 1, 0]);
await shot('overview_night');

// 4. Day overview
await setHour(12);
await shot('overview_day');

// 5. Food stall steam
await setCam([-4, 6, 32], [-14, 4, 22]);
await shot('stall_steam');

// 6. NPC idles — central path area near hub
await setCam([10, 7, 18], [0, 2, 0]);
await shot('npc_idle_1');
await shot('npc_idle_2', 4000);

// 7. Entrance gate sign (wave)
await setCam([0, 12, 122], [0, 11, 100]);
await shot('gate_sign');

// 8. Ride hint near tagada panel
await setCam([-8, 5, 38], [-15, 3, 34]);
await shot('ride_hint');

// 9. Tagada with picked color at night (color coverage)
await setHour(22);
await page.evaluate(() => {
  const c = document.getElementById('lightColor');
  c.value = '#00ff66';
  c.dispatchEvent(new Event('input'));
});
await setCam([-18, 12, 65], [-40, 6, 40]);
await shot('tagada_color');

// 10. Carousel color coverage
await setCam([20, 12, -18], [40, 6, -40]);
await shot('carousel_color');

// 11. Ferris gondola variety (day, close)
await setHour(12);
await setCam([-30, 30, -20], [-50, 28, -50]);
await shot('ferris_day');

// HUD arc visible in all shots (top-right). Done.
await browser.close();
console.log('done');
