import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  // Log browser console messages and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:8080');
  
  // Wait for page load
  console.log('Waiting for load...');
  await new Promise(r => setTimeout(r, 8000));
  
  // Dismiss start/loading screen
  await page.click('body');
  await new Promise(r => setTimeout(r, 3000));

  // Mock pointer lock before entering aim mode
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      let locked = false;
      Object.defineProperty(document, 'pointerLockElement', {
        get: () => locked ? canvas : null,
        configurable: true
      });
      canvas.requestPointerLock = function() {
        locked = true;
        setTimeout(() => {
          document.dispatchEvent(new Event('pointerlockchange'));
        }, 10);
      };
    }
  });

  // Navigate close to the gallery
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

  // Press 't' to enter aim mode
  console.log('Entering aim mode...');
  await page.keyboard.press('t');
  
  // Wait for aimMode to become true
  console.log('Waiting for aimMode to be true...');
  await page.waitForFunction(() => {
    return window.__lp && window.__lp.shootingGallery && window.__lp.shootingGallery.aimMode === true;
  }, { timeout: 10000 });
  console.log('Aim mode is now true!');

  // Click center of screen to shoot
  console.log('Firing shot...');
  
  const canvasElement = await page.$('canvas');
  const box = await canvasElement.boundingBox();
  const clickX = box.x + box.width / 2;
  const clickY = box.y + box.height / 2;
  
  await page.mouse.move(clickX, clickY);
  await page.mouse.down();
  
  // Wait 40ms to capture bullet in flight and muzzle flash
  await new Promise(r => setTimeout(r, 40));
  const path1 = '/Users/davide/.gemini/antigravity/brain/127df2d9-5bac-4556-93ac-711283e40db3/bullet_and_muzzle.png';
  await page.screenshot({ path: path1 });
  console.log('Saved screenshot of bullet in flight and muzzle flash to ' + path1);
  
  await page.mouse.up();
  
  // Wait another 160ms (200ms total from click) to capture particle splash
  await new Promise(r => setTimeout(r, 160));
  const path2 = '/Users/davide/.gemini/antigravity/brain/127df2d9-5bac-4556-93ac-711283e40db3/impact_particles.png';
  await page.screenshot({ path: path2 });
  console.log('Saved screenshot of impact particles to ' + path2);
  
  await browser.close();
})();
