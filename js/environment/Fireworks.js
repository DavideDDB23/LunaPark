import * as THREE from 'three';

export function buildFireworks() {
  const group = new THREE.Group();
  group.name = 'fireworks';

  const particles = [];

  const geo = new THREE.BufferGeometry();
  const count = 200;
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 2;
    pos[i * 3 + 1] = Math.random() * 10;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    vel[i * 3] = (Math.random() - 0.5) * 4;
    vel[i * 3 + 1] = Math.random() * 6 + 2;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 4;
    life[i] = Math.random();
    sizes[i] = 0.3 + Math.random() * 0.4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xff6600,
    size: 3.5,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.position.set(0, 20, -100);
  group.add(points);

  let lastBurst = 0;

  group.userData.tick = (delta, time) => {
    if (lastBurst === 0) lastBurst = time;
    const dt = Math.min(delta, 0.05);
    const p = points.geometry.attributes.position.array;
    const colors = [];
    const colorAttr = points.geometry.attributes.color;

    if (time - lastBurst > 3) {
      lastBurst = time;
      const cx = (Math.random() - 0.5) * 60;
      const cy = 5 + Math.random() * 15;
      const cz = (Math.random() - 0.5) * 20;
      const hue = Math.random();
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 5 + Math.random() * 12;
        p[i * 3] = cx;
        p[i * 3 + 1] = cy;
        p[i * 3 + 2] = cz;
        vel[i * 3] = Math.sin(theta) * Math.cos(phi) * speed;
        vel[i * 3 + 1] = Math.sin(phi) * speed;
        vel[i * 3 + 2] = Math.cos(theta) * Math.cos(phi) * speed;
        life[i] = 1;
      }
      if (!colorAttr) {
        const ca = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const c = new THREE.Color().setHSL(hue + (Math.random() - 0.5) * 0.2, 1, 0.6);
          ca[i * 3] = c.r;
          ca[i * 3 + 1] = c.g;
          ca[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      } else {
        for (let i = 0; i < count; i++) {
          const c = new THREE.Color().setHSL(hue + (Math.random() - 0.5) * 0.2, 1, 0.6);
          colorAttr.array[i * 3] = c.r;
          colorAttr.array[i * 3 + 1] = c.g;
          colorAttr.array[i * 3 + 2] = c.b;
        }
        colorAttr.needsUpdate = true;
      }
      points.material.vertexColors = true;
    }

    for (let i = 0; i < count; i++) {
      if (life[i] > 0) {
        vel[i * 3 + 1] -= 9.8 * dt;
        p[i * 3] += vel[i * 3] * dt;
        p[i * 3 + 1] += vel[i * 3 + 1] * dt;
        p[i * 3 + 2] += vel[i * 3 + 2] * dt;
        life[i] -= dt * 0.5;
      }
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.material.opacity = 0.6 + 0.3 * Math.sin(time * 0.5);
  };

  return group;
}
