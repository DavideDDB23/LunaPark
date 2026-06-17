import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:8080');
  
  // Wait for full load
  await new Promise(r => setTimeout(r, 10000));
  
  // Click to dismiss loading screen
  await page.click('body');
  await new Promise(r => setTimeout(r, 4000));

  // Navigate camera close to shooting gallery first
  await page.evaluate(() => {
    if (window.__lp && window.__lp.camera) {
      let gallery = null;
      window.__lp.scene.traverse(o => { if (o.name === 'shootingGallery') gallery = o; });
      if (gallery) {
        const THREE = window.__lp.THREE || window.THREE;
        const pos = new THREE.Vector3(0, 2.5, 6.5);
        gallery.localToWorld(pos);
        const look = new THREE.Vector3(0, 1.5, -2.0);
        gallery.localToWorld(look);
        window.__lp.camera.position.copy(pos);
        window.__lp.camera.lookAt(look);
        if (window.__lp.controls) {
          window.__lp.controls.target.copy(look);
          window.__lp.controls.update();
        }
      }
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  // Press T
  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 4000));

  const path = '/Users/davide/.gemini/antigravity/brain/127df2d9-5bac-4556-93ac-711283e40db3/fps_gun_v2.png';
  await page.screenshot({ path });
  console.log('Saved fps_gun_v2.png');
  
  await browser.close();
})();
