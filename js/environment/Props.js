import * as THREE from 'three';

function makeWelcomeTexture(text = 'LUNA  PARK') {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Background — rich crimson gradient with vignette
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#2a0404');
  bg.addColorStop(0.5, '#8e1818');
  bg.addColorStop(1, '#2a0404');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer gold border
  ctx.strokeStyle = '#f0c060';
  ctx.lineWidth = 26;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.strokeStyle = '#7a5520';
  ctx.lineWidth = 4;
  ctx.strokeRect(58, 58, canvas.width - 116, canvas.height - 116);

  // Decorative side ornaments
  ctx.fillStyle = '#f0c060';
  for (const side of [120, canvas.width - 120]) {
    ctx.beginPath();
    ctx.arc(side, canvas.height / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(side, canvas.height / 2 - 80, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(side, canvas.height / 2 + 80, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // "WELCOME TO" subtitle
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 90px Georgia, serif';
  ctx.fillStyle = '#f8d878';
  ctx.shadowColor = '#ff8020';
  ctx.shadowBlur = 25;
  ctx.fillText('★  WELCOME TO  ★', canvas.width / 2, canvas.height / 2 - 130);

  // Main text — glowing
  ctx.font = 'bold 240px Georgia, serif';
  ctx.shadowColor = '#ffc060';
  ctx.shadowBlur = 70;
  ctx.fillStyle = '#fff5d0';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 50);

  // Crisp gold outline on main text
  ctx.shadowBlur = 0;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffd070';
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildEntranceGate() {
  const group = new THREE.Group();
  group.name = 'entranceGate';

  const Z = 100;
  const halfSpan = 9;       // gate 18m wide
  const pillarH = 11.0;
  const baseH = 1.6;

  // ─── Materials ────────────────────────────────────────────────
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xada088, roughness: 0.92, metalness: 0.0 });
  const stoneDarkMat = new THREE.MeshStandardMaterial({ color: 0x6c5d48, roughness: 0.95, metalness: 0.0 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5e3216, roughness: 0.85, metalness: 0.05 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe6c060, roughness: 0.35, metalness: 0.8 });
  const archMat = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.75, metalness: 0.15 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b0, emissive: 0xffd060, emissiveIntensity: 1.4, roughness: 0.3,
  });
  const signTex = makeWelcomeTexture();
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 1.5,
    roughness: 0.55,
    metalness: 0.1,
    side: THREE.FrontSide, // only the entrance-facing face shows the text
  });

  // ─── Stone bases (stepped pedestals) ─────────────────────────
  for (const sx of [-1, 1]) {
    const lowerBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), stoneDarkMat);
    lowerBase.position.set(sx * halfSpan, 0.25, Z);
    lowerBase.castShadow = true;
    lowerBase.receiveShadow = true;
    group.add(lowerBase);

    const upperBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.8), stoneMat);
    upperBase.position.set(sx * halfSpan, 0.5 + 0.55, Z);
    upperBase.castShadow = true;
    upperBase.receiveShadow = true;
    group.add(upperBase);

    // Gold band on base
    const bandGeo = new THREE.BoxGeometry(1.9, 0.08, 1.9);
    const band = new THREE.Mesh(bandGeo, goldMat);
    band.position.set(sx * halfSpan, baseH - 0.06, Z);
    group.add(band);
  }

  // ─── Pillars (substantial square columns) ─────────────────────
  for (const sx of [-1, 1]) {
    const x = sx * halfSpan;

    // Main column
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, pillarH, 1.2), woodMat);
    col.position.set(x, baseH + pillarH / 2, Z);
    col.castShadow = true;
    col.receiveShadow = true;
    group.add(col);

    // Vertical gold inlay strips on column front and back
    for (const dz of [-0.61, 0.61]) {
      const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.15, pillarH - 1.2, 0.02), goldMat);
      inlay.position.set(x, baseH + pillarH / 2, Z + dz);
      group.add(inlay);
    }

    // Carved gold rings at 1/3 and 2/3 height
    for (const ry of [pillarH * 0.33, pillarH * 0.66]) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.18, 1.36), goldMat);
      ring.position.set(x, baseH + ry, Z);
      group.add(ring);
    }

    // Column capital
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), goldMat);
    cap.position.set(x, baseH + pillarH + 0.25, Z);
    cap.castShadow = true;
    group.add(cap);

    // Decorative finial on top of each pillar (small obelisk)
    const finialBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), goldMat);
    finialBase.position.set(x, baseH + pillarH + 0.65, Z);
    group.add(finialBase);
    const finialSpire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4), goldMat);
    finialSpire.position.set(x, baseH + pillarH + 1.5, Z);
    finialSpire.rotation.y = Math.PI / 4;
    group.add(finialSpire);

    // Hanging lantern on each pillar (interior side)
    const lanternY = baseH + pillarH - 1.5;
    const lanternX = x + (-sx) * 0.85; // hang on inside of gate

    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), woodMat);
    rope.position.set(lanternX, lanternY + 0.4, Z);
    group.add(rope);

    const lanternBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.7, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfff2a0, emissive: 0xffc060, emissiveIntensity: 1.8, roughness: 0.4,
      })
    );
    lanternBody.position.set(lanternX, lanternY, Z);
    group.add(lanternBody);

    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 8), goldMat);
    lanternCap.position.set(lanternX, lanternY + 0.5, Z);
    group.add(lanternCap);

    const lanternLight = new THREE.PointLight(0xffd080, 2.5, 14, 2);
    lanternLight.position.set(lanternX, lanternY, Z);
    group.add(lanternLight);
  }

  // ─── Arch (extruded curve connecting the pillars) ────────────
  const archW = halfSpan * 2 + 2.2;
  const archH = 3.4;
  const archShape = new THREE.Shape();
  archShape.moveTo(-archW / 2, 0);
  archShape.lineTo(archW / 2, 0);
  archShape.lineTo(archW / 2, archH * 0.35);
  archShape.quadraticCurveTo(0, archH * 1.55, -archW / 2, archH * 0.35);
  archShape.lineTo(-archW / 2, 0);

  const archDepth = 1.6;
  const archGeo = new THREE.ExtrudeGeometry(archShape, { depth: archDepth, bevelEnabled: false });
  const arch = new THREE.Mesh(archGeo, archMat);
  arch.position.set(0, baseH + pillarH + 0.7, Z - archDepth / 2);
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  // Gold trim along arch base
  const trim = new THREE.Mesh(new THREE.BoxGeometry(archW + 0.4, 0.22, archDepth + 0.2), goldMat);
  trim.position.set(0, baseH + pillarH + 0.7, Z);
  group.add(trim);

  // ─── Welcome sign — floats in front and behind the arch as a billboard ─
  const signW = archW * 0.78;
  const signH = 2.9;
  const signY = baseH + pillarH + 1.9;
  const signOffsetZ = archDepth / 2 + 0.6;  // well in front of arch so it's not buried inside it
  const signGeo = new THREE.PlaneGeometry(signW, signH);

  function makeSignAssembly(facingNorth) {
    const dir = facingNorth ? 1 : -1; // +Z = outside park (front), -Z = inside park (back)
    const zPos = Z + dir * signOffsetZ;

    const board = new THREE.Mesh(signGeo, signMat);
    board.position.set(0, signY, zPos);
    if (!facingNorth) board.rotation.y = Math.PI;
    group.add(board);

    // Gold frame around board
    const ft = 0.18, fd = 0.16;
    for (const side of [-1, 1]) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(ft, signH + ft * 2, fd), goldMat);
      v.position.set(side * (signW / 2 + ft / 2), signY, zPos);
      group.add(v);
    }
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(signW + ft * 2, ft, fd), goldMat);
      h.position.set(0, signY + side * (signH / 2 + ft / 2), zPos);
      group.add(h);
    }

    // Decorative chains hanging the sign from the arch
    for (const side of [-1, 1]) {
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6),
        goldMat
      );
      chain.position.set(side * (signW / 2 - 0.6), signY + signH / 2 + 0.7, zPos);
      group.add(chain);
    }
  }

  // Only the outward-facing sign (entrance side). The inside should not show the welcome text.
  makeSignAssembly(true);

  // Spotlights illuminating sign at night-equivalent
  for (const sx of [-1, 1]) {
    const sLight = new THREE.SpotLight(0xfff1c0, 2.5, 18, Math.PI / 5, 0.4, 1);
    sLight.position.set(sx * 3.5, baseH + pillarH + 5.5, Z + 3);
    sLight.target.position.set(0, baseH + pillarH + 1.9, Z);
    group.add(sLight);
    group.add(sLight.target);
  }

  // ─── Marquee bulbs running along underside of arch ───────────
  const bulbGeo = new THREE.SphereGeometry(0.16, 12, 10);
  const bulbCount = 13;
  for (let i = 0; i < bulbCount; i++) {
    const t = i / (bulbCount - 1);
    const lx = THREE.MathUtils.lerp(-archW / 2 + 0.6, archW / 2 - 0.6, t);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(lx, baseH + pillarH + 0.55, Z + archDepth / 2 + 0.18);
    group.add(bulb);
    const bulbBack = new THREE.Mesh(bulbGeo, bulbMat);
    bulbBack.position.set(lx, baseH + pillarH + 0.55, Z - archDepth / 2 - 0.18);
    group.add(bulbBack);
  }

  // ─── Decorative flags — sit right ON the arch top (no longer floating high above) ──
  const flagColors = [0xe04040, 0x40a0e0, 0xf0c040, 0x40c060, 0xb050d0];
  // Quadratic Bézier from (±archW/2, archH*0.35) with control (0, archH*1.55):
  // actual apex at t=0.5 is y = 0.5*(0.35 + 1.55)*archH = 0.95*archH.
  // (Using the control-point Y here put the flags ~2m above the real arch.)
  const archTopY = baseH + pillarH + 0.7 + archH * 0.95;
  const swayingFlags = [];
  // Flags sit just above the arch — pole rooted slightly into the arch top.
  const poleBaseY = archTopY - 0.3;  // a touch lower than before
  const poleH = 1.5;
  for (let i = -2; i <= 2; i++) {
    const px = i * 1.8;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, poleH, 8), goldMat);
    pole.position.set(px, poleBaseY + poleH / 2, Z);
    group.add(pole);

    // Gold ball cap on top of pole.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), goldMat);
    cap.position.set(px, poleBaseY + poleH, Z);
    group.add(cap);

    // Pivot at the very top of pole — flag swings from here.
    const pivot = new THREE.Group();
    pivot.position.set(px, poleBaseY + poleH - 0.05, Z);
    group.add(pivot);

    // Segmented plane so we can ripple the cloth per-vertex.
    const flagGeo = new THREE.PlaneGeometry(0.95, 0.65, 16, 5);
    // Cache the rest-pose vertex positions so we can re-displace from them every frame.
    const restPos = new Float32Array(flagGeo.attributes.position.array);
    const flag = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({
        color: flagColors[(i + 2) % flagColors.length],
        roughness: 0.85,
        side: THREE.DoubleSide,
      })
    );
    flag.position.set(0.52, -0.3, 0);
    pivot.add(flag);

    pivot.userData.flag = {
      phase: Math.random() * Math.PI * 2 + i,
      basePhase: i * 0.3,
      gustPhase: Math.random() * Math.PI * 2,
      mesh: flag,
      geo: flagGeo,
      restPos,
      width: 0.95,
    };
    swayingFlags.push(pivot);
  }

  // No more side fence wings — they were overlapping the park perimeter fence.

  // ─── Wind animation tick — flags ──────────────────────────────────
  // Three coupled motions:
  //   1. Pivot yaw  — whole flag swings around the pole (gust direction)
  //   2. Pivot roll — slight tilt (cloth catching breeze)
  //   3. Per-vertex cloth ripple — sine wave travelling along the flag's length,
  //      attenuated at the pole-side edge (vertices clamped near the hoist).
  group.userData.tick = (delta, time, windSpeed) => {
    if (!windSpeed) {
      for (const f of swayingFlags) {
        f.rotation.set(0, 0, 0);
        // Restore flag to rest pose.
        const d = f.userData.flag;
        d.geo.attributes.position.array.set(d.restPos);
        d.geo.attributes.position.needsUpdate = true;
      }
      return;
    }

    // Saturating wind intensity (matches trees) — gentle at 0.2, near-max at 3.
    const baseIntensity = 1.0 - Math.exp(-windSpeed * 0.7);

    for (const f of swayingFlags) {
      const d = f.userData.flag;
      const t = time * (1.0 + windSpeed * 0.5);

      // Gust — low-freq surge that modulates the overall amplitude.
      const gust = 0.65 + 0.45 * Math.sin(time * 0.7 + d.gustPhase);
      const intensity = baseIntensity * gust;

      // Subtle pivot motions — kept small so the hoist edge stays attached to the pole.
      f.rotation.y = Math.sin(t * 3.0 + d.phase) * 0.28 * intensity;
      f.rotation.z = Math.sin(t * 2.2 + d.phase + 1.0) * 0.12 * intensity;
      f.rotation.x = Math.sin(t * 1.7 + d.phase * 1.3) * 0.05 * intensity;

      // ── Per-vertex cloth ripple ────────────────────────────────────
      const arr = d.geo.attributes.position.array;
      const rest = d.restPos;
      const width = d.width;
      const W = windSpeed;
      const amp = 0.07 * intensity;   // ripple amplitude
      const k1 = 11.0 / width;        // primary wave number
      const k2 = 6.5  / width;        // secondary
      const sp1 = 5.5 * (0.5 + W * 0.3);
      const sp2 = 3.2 * (0.5 + W * 0.3);
      for (let v = 0; v < arr.length; v += 3) {
        const rx = rest[v];
        const ry = rest[v + 1];
        // Distance along the cloth from the hoist edge (x = -width/2 → 0; x = +width/2 → 1).
        const distAlong = (rx + width / 2) / width; // 0..1
        // Clamp ripple to ~0 near the hoist edge so cloth stays attached to pole.
        const clothMask = distAlong * distAlong;
        const wave =
          Math.sin(rx * k1 - t * sp1 + d.phase) * 0.6 +
          Math.sin(rx * k2 + ry * 7.0 - t * sp2) * 0.4;
        arr[v]     = rx;
        arr[v + 1] = ry;
        arr[v + 2] = wave * amp * clothMask;
      }
      d.geo.attributes.position.needsUpdate = true;
      d.geo.computeVertexNormals();
    }
  };

  return group;
}
