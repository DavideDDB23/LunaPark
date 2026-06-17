import puppeteer from 'puppeteer-core';

(async () => {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  page.on('console', msg => {
    console.log('[BROWSER CONSOLE]:', msg.text());
  });

  page.on('pageerror', err => {
    console.error('[BROWSER ERROR]:', err);
  });

  console.log('Navigating to http://localhost:8080...');
  await page.goto('http://localhost:8080', { waitUntil: 'load', timeout: 30000 });

  console.log('Page loaded. Waiting 10 seconds for assets to load and render...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Since local X is UP (world +Y), setting negative X will move it down.
  // Let's test a sweep of X values from -0.04 to -0.12.
  // We'll also test small adjustments to Y (length/forward) and Z (height/width).
  const testCases = [
    { name: 'x0.0_y0.05_z0.02', x: 0.0, y: 0.05, z: 0.02 },
    { name: 'x_neg0.04_y0.05_z0.02', x: -0.04, y: 0.05, z: 0.02 },
    { name: 'x_neg0.06_y0.05_z0.02', x: -0.06, y: 0.05, z: 0.02 },
    { name: 'x_neg0.08_y0.05_z0.02', x: -0.08, y: 0.05, z: 0.02 },
    { name: 'x_neg0.10_y0.05_z0.02', x: -0.10, y: 0.05, z: 0.02 },
    { name: 'x_neg0.08_y0.03_z0.01', x: -0.08, y: 0.03, z: 0.01 },
    { name: 'x_neg0.08_y0.07_z0.03', x: -0.08, y: 0.07, z: 0.03 }
  ];

  for (const tc of testCases) {
    console.log(`Running test case: ${tc.name}...`);
    
    await page.evaluate((tc) => {
      const { scene, camera, controls } = window.__lp || {};
      const cowboy = window.__lp.cowboy;
      if (!cowboy) {
        console.error('Cowboy not found');
        return;
      }
      
      // Hide loader
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';

      // Find the gunWrapper (the parent of Sketchfab_Scene)
      const gunModel = cowboy.getObjectByName('Sketchfab_Scene');
      if (gunModel && gunModel.parent) {
        const gunWrapper = gunModel.parent;
        // Adjust offset (x is UP/DOWN, y is FORWARD/BACK, z is LEFT/RIGHT)
        gunWrapper.position.set(tc.x, tc.y, tc.z);
        
        // Hide the bullet
        const bullet = gunModel.getObjectByName('defaultMaterial');
        if (bullet) {
          bullet.visible = false;
        }
      }
      
      // Position camera close to the cowboy's right hand to inspect grip
      const fist = cowboy.getObjectByName('FistR') || cowboy.getObjectByName('Fist.R');
      if (fist) {
        const fp = new window.__lp.THREE.Vector3();
        fist.getWorldPosition(fp);
        camera.position.set(fp.x + 0.8, fp.y + 0.3, fp.z + 0.8);
        controls.target.copy(fp);
      }
      controls.update();
    }, tc);

    // Wait 1 second for render to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    const path = `/Users/davide/.gemini/antigravity/brain/127df2d9-5bac-4556-93ac-711283e40db3/test_x_offset_${tc.name}.png`;
    await page.screenshot({ path });
    console.log(`Saved screenshot to ${path}`);
  }

  await browser.close();
  console.log('Browser closed.');
})();
