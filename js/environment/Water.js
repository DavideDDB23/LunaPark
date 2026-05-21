import * as THREE from 'three';
import { riverCenter, riverHalfWidth, RIVER_X_MIN, RIVER_X_MAX } from '../utils/river.js';

const RIVER_Y = 0.25;

function buildRiverSurfaceGeometry() {
  const segmentsAlongX = 320;
  const segmentsAcross = 16;
  const positions = [];
  const indices = [];
  const uvs = [];
  for (let i = 0; i <= segmentsAlongX; i++) {
    const t = i / segmentsAlongX;
    const x = RIVER_X_MIN + t * (RIVER_X_MAX - RIVER_X_MIN);
    const cz = riverCenter(x);
    const hw = riverHalfWidth(x);
    for (let j = 0; j <= segmentsAcross; j++) {
      const s = j / segmentsAcross;
      const z = cz + (s * 2 - 1) * hw;
      positions.push(x, 0, z);
      uvs.push(t, s);
    }
  }
  const rowLen = segmentsAcross + 1;
  for (let i = 0; i < segmentsAlongX; i++) {
    for (let j = 0; j < segmentsAcross; j++) {
      const a = i * rowLen + j;
      const b = a + 1;
      const c = (i + 1) * rowLen + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  vec3 sinWave(vec3 pos, vec2 dir, float wavelength, float amp, float speed, float t) {
    float k = 6.2831853 / wavelength;
    float phase = k * dot(dir, pos.xz) - speed * t;
    float h = amp * sin(phase);
    float dh = amp * cos(phase) * k;
    return vec3(h, dh * dir.x, dh * dir.y);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Sum of sine waves — primary flow direction +X.
    vec3 w1 = sinWave(pos, normalize(vec2( 1.0, 0.1)), 14.0, 0.10, 0.6, uTime);
    vec3 w2 = sinWave(pos, normalize(vec2( 1.0,-0.3)),  7.0, 0.06, 1.0, uTime);
    vec3 w3 = sinWave(pos, normalize(vec2( 0.7, 0.7)),  3.2, 0.03, 1.6, uTime);
    vec3 w4 = sinWave(pos, normalize(vec2(-0.4, 1.0)),  1.6, 0.015, 2.2, uTime);

    float h  = w1.x + w2.x + w3.x + w4.x;
    float dx = w1.y + w2.y + w3.y + w4.y;
    float dz = w1.z + w2.z + w3.z + w4.z;

    pos.y += h;

    vNormal = normalize(vec3(-dx, 1.0, -dz));
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    float bank = abs(vUv.y - 0.5) * 2.0;

    vec2 flowUv = vec2(vUv.x * 80.0 - uTime * 1.2, vUv.y * 16.0);
    float n1 = noise(flowUv);
    float n2 = noise(flowUv * 2.3 + uTime * 0.3);
    float caustic = pow(0.5 + 0.5 * (n1 - n2), 3.0);

    vec3 deep    = vec3(0.04, 0.18, 0.40);
    vec3 shallow = vec3(0.22, 0.58, 0.78);
    vec3 foamCol = vec3(0.96, 0.99, 1.00);
    vec3 col = mix(deep, shallow, 1.0 - bank * 0.7);

    col += caustic * vec3(0.25, 0.30, 0.20) * (1.0 - bank * 0.5);

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(0.0, dot(normalize(vNormal), H)), 80.0);
    col += spec * 0.8;

    float fres = pow(1.0 - max(0.0, dot(normalize(vNormal), V)), 4.0);
    col = mix(col, vec3(0.7, 0.85, 0.95), fres * 0.25);

    float foamStrip = smoothstep(0.78, 1.0, bank);
    float foamRipple = smoothstep(0.55, 1.0, noise(vec2(vUv.x * 200.0 + uTime * 2.0, vUv.y * 40.0)));
    col = mix(col, foamCol, foamStrip * (0.6 + foamRipple * 0.4));

    gl_FragColor = vec4(col, 0.85);
  }
`;

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(buildRiverSurfaceGeometry(), material);
  mesh.position.y = RIVER_Y;
  mesh.name = 'river_surface';
  group.add(mesh);

  group.userData.tick = (delta) => {
    material.uniforms.uTime.value += delta;
  };
  return group;
}

export { RIVER_Y };
