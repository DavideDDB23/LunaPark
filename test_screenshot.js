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

  console.log('Repositioning camera and hiding loader...');
  await page.evaluate(() => {
    // Hide loader
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    // Get THREE, scene, camera, controls from window.__lp
    const { scene, camera, controls } = window.__lp || {};
    if (!scene || !camera || !controls) {
      console.error('Three.js objects not found in window.__lp');
      return;
    }

    // Find the cowboy operator and shooting gallery in the scene
    const cowboy = scene.getObjectByName('shooting_operator');
    const sg = scene.getObjectByName('shootingGallery');
    if (sg) {
      const bbox = new window.__lp.THREE.Box3().setFromObject(sg);
      const size = new window.__lp.THREE.Vector3();
      bbox.getSize(size);
      const center = bbox.getCenter(new window.__lp.THREE.Vector3());
      console.log('Shooting Gallery Group World Position:', sg.position.x, sg.position.y, sg.position.z);
      console.log('Shooting Gallery Bounding Box Min:', bbox.min.x, bbox.min.y, bbox.min.z, 'Max:', bbox.max.x, bbox.max.y, bbox.max.z);
      console.log('Shooting Gallery Size:', size.x, size.y, size.z, 'Center:', center.x, center.y, center.z);
      
      // Let's traverse children to see local positions
      sg.children.forEach(c => {
        console.log('  - Child of sg:', c.name, 'type:', c.type, 'localPos:', c.position.x, c.position.y, c.position.z, 'worldPos:', c.getWorldPosition(new window.__lp.THREE.Vector3()));
      });
    }

    if (cowboy) {
      console.log('Found cowboy operator in scene!');
      
      // Print detailed hierarchy info for ALL meshes and bones
      cowboy.traverse((node) => {
        const isBone = node.isBone;
        const isMesh = node.isMesh;
        if (isBone || isMesh || node.name.includes('gun') || node.name.includes('Scene')) {
          const wp = new window.__lp.THREE.Vector3();
          node.getWorldPosition(wp);
          const ws = new window.__lp.THREE.Vector3();
          node.getWorldScale(ws);
          console.log('  - Node:', node.name, 'type:', node.type, 'visible:', node.visible, 'worldPos:', wp.x.toFixed(3), wp.y.toFixed(3), wp.z.toFixed(3), 'worldScale:', ws.x.toFixed(5), ws.y.toFixed(5), ws.z.toFixed(5));
          if (isMesh && node.material) {
            console.log('    -> Material:', node.material.name, 'transparent:', node.material.transparent, 'opacity:', node.material.opacity, 'color:', node.material.color.getHexString());
          }
        }
      });

      // Get cowboy's world position
      const p = new window.__lp.THREE.Vector3();
      cowboy.getWorldPosition(p);
      console.log('Cowboy world position:', p.x, p.y, p.z);
      
      // Position camera close to the cowboy's right hand to inspect grip in detail
      const fist = cowboy.getObjectByName('FistR') || cowboy.getObjectByName('Fist.R');
      if (fist) {
        const fp = new window.__lp.THREE.Vector3();
        fist.getWorldPosition(fp);
        camera.position.set(fp.x + 0.8, fp.y + 0.3, fp.z + 0.8);
        controls.target.copy(fp);
      } else {
        camera.position.set(p.x + 3.0, p.y + 1.8, p.z + 3.0);
        controls.target.copy(p).add(new window.__lp.THREE.Vector3(0, 1.0, 0));
      }
      controls.update();
      console.log('Camera and controls updated');
    } else {
      console.error('Cowboy operator not found in scene');
    }
  });

  console.log('Waiting 5 seconds for rendering and animation update...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Taking screenshot...');
  const screenshotPath = '/Users/davide/.gemini/antigravity/brain/127df2d9-5bac-4556-93ac-711283e40db3/puppeteer_screenshot.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to', screenshotPath);

  await browser.close();
  console.log('Browser closed.');
})();
