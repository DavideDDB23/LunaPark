import * as THREE from 'three';
import { loadVisitorTemplates, makeRider, updateRider, pose, getPassengerWorldHeight, applyChairSeatedLegs } from './Passengers.js';
import { ControlPanel } from './ControlPanel.js';
import { eventBus } from '../utils/EventBus.js';

// Ride Animation Constants
const MAX_SPIN_SPEED = 2.0;       // rad/s platform rotation at full speed
const BASE_PITCH = 0.28;          // Rest pitch tilt of the arm
const PITCH_AMP = 0.16;           // Pitch oscillation amplitude
const PITCH_FREQ = 2.6;           // Pitch speed (rad/s)
const ROLL_AMP = 0.22;            // Roll oscillation amplitude
const ROLL_FREQ = 1.9;            // Roll speed (rad/s)
const ARM_YAW_SPEED = 0.4;        // Radiant speed for the arm's horizontal rotation
const ARM_PIVOT_Y = 1.2;
const BOARDING_DROP = 6.0;         // How much the arm telescopes down when stopped
const MIN_ARM_LENGTH = 2.5;        // Prevents the arm from collapsing fully

// Jitter/shaking parameters for passengers
const JITTER_FREQ = 14.0;
const JITTER_AMP = 0.02;

const BUMP_FREQ = 18.0; // High frequency for rapid shakes
const BUMP_AMP = 0.04;  // Sharp, short rotation jolts in radians

const TAGADA_ACTIONS = ['cheer', 'wave', 'cheer', 'wave', 'lookUp', 'relax', 'rest'];


function createTagadaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Background base (dark steel gray/blue)
  ctx.fillStyle = '#1c2038';
  ctx.fillRect(0, 0, 512, 512);

  // Draw concentric carnival rings
  const center = 256;
  const rings = [
    { r: 240, color: '#d32f2f' }, // Red outer ring
    { r: 220, color: '#f5f5f5' }, // White ring
    { r: 180, color: '#1976d2' }, // Blue ring
    { r: 155, color: '#fbc02d' }, // Yellow ring
    { r: 120, color: '#f5f5f5' }, // White ring
    { r: 85, color: '#d32f2f' },  // Red ring
    { r: 50, color: '#fbc02d' }   // Yellow inner bullseye
  ];

  for (const ring of rings) {
    ctx.beginPath();
    ctx.arc(center, center, ring.r, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill();
  }

  // Radial segments/lines to give depth during spin
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.cos(angle) * 240, center + Math.sin(angle) * 240);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export async function buildTagada({ position = [-40, 0, 40], camera, renderer, anisotropy = 8 } = {}) {
  // Load 8 random visitor templates for the seats
  const visitors = await loadVisitorTemplates(8);

  const group = new THREE.Group();
  group.name = 'tagada';
  group.position.set(position[0], position[1], position[2]);

  // Materials Setup
  const metalPedestalMat = new THREE.MeshStandardMaterial({
    color: 0x2b303b,
    roughness: 0.4,
    metalness: 0.8
  });

  const industrialArmMat = new THREE.MeshStandardMaterial({
    color: 0xff8800, // Bright orange mechanical arm
    roughness: 0.3,
    metalness: 0.5
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    metalness: 0.9,
    roughness: 0.1
  });

  const discTex = createTagadaTexture();
  discTex.anisotropy = anisotropy;
  const platformMat = new THREE.MeshStandardMaterial({
    map: discTex,
    roughness: 0.7,
    metalness: 0.2
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1177cc, // Blue vinyl cushions
    roughness: 0.6,
    metalness: 0.1
  });

  const seatFrameMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 0.5,
    metalness: 0.7
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.95,
    roughness: 0.05
  });

  const baseConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x5a5f66,
    roughness: 0.9,
    metalness: 0.05
  });

  const baseHousingMat = new THREE.MeshStandardMaterial({
    color: 0x2f333a,
    roughness: 0.55,
    metalness: 0.7
  });

  const accessMat = new THREE.MeshStandardMaterial({
    color: 0x3b3f46,
    roughness: 0.7,
    metalness: 0.2
  });

  // 1. Static Pedestal / Base Platform
  const pedestalGeo = new THREE.CylinderGeometry(9.5, 10.0, 1.2, 32);
  const pedestal = new THREE.Mesh(pedestalGeo, metalPedestalMat);
  pedestal.position.y = 0.6; // rest on grass
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // Decorative brass ring around pedestal
  const ringGeo = new THREE.TorusGeometry(9.6, 0.1, 8, 32);
  const ring = new THREE.Mesh(ringGeo, chromeMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  group.add(ring);

  // Foundation slab and base skirt for a more realistic base
  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.2, 0.35, 40), baseConcreteMat);
  foundation.position.y = 0.175;
  foundation.receiveShadow = true;
  group.add(foundation);

  const baseSkirt = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 11.2, 0.8, 40), baseHousingMat);
  baseSkirt.position.y = 0.4;
  baseSkirt.castShadow = true;
  baseSkirt.receiveShadow = true;
  group.add(baseSkirt);

  const motorBase = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.8, 24), baseHousingMat);
  motorBase.position.y = 0.8;
  motorBase.castShadow = true;
  motorBase.receiveShadow = true;
  group.add(motorBase);

  const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.35, 0.12, 24), chromeMat);
  motorCap.position.y = 1.26;
  motorCap.castShadow = true;
  group.add(motorCap);

  const pivotCollar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.2, 16), metalPedestalMat);
  pivotCollar.position.y = 1.2;
  pivotCollar.castShadow = true;
  group.add(pivotCollar);

  const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, chromeMat);
    bolt.position.set(3.0 * Math.cos(angle), 1.26, 3.0 * Math.sin(angle));
    bolt.castShadow = true;
    group.add(bolt);
  }

  const anchorGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const anchor = new THREE.Mesh(anchorGeo, chromeMat);
    anchor.position.set(11.2 * Math.cos(angle), 0.18, 11.2 * Math.sin(angle));
    anchor.castShadow = true;
    group.add(anchor);
  }

  // 2. Mechanical Arm Pivot Joint (sits at top of pedestal)
  const armPivot = new THREE.Group();
  armPivot.name = 'tagada_arm_pivot';
  armPivot.position.set(0, ARM_PIVOT_Y, 0);
  armPivot.rotation.order = 'YXZ';
  group.add(armPivot);

  // Mechanical hinge cylinder at the joint
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.0, 16), metalPedestalMat);
  hinge.rotation.z = Math.PI / 2;
  armPivot.add(hinge);

  // 3. Mechanical Arm Mesh
  // Arm extends along +Y in armPivot space (height 10, offset by 5 to place pivot at base)
  const armLength = 9.0;
  const armGroup = new THREE.Group();
  armGroup.name = 'tagada_arm_group';
  armPivot.add(armGroup);

  const mainArmGeo = new THREE.CylinderGeometry(0.5, 0.6, armLength, 16);
  const mainArm = new THREE.Mesh(mainArmGeo, industrialArmMat);
  mainArm.position.y = armLength / 2;
  mainArm.castShadow = true;
  mainArm.receiveShadow = true;
  armGroup.add(mainArm);

  // Hydraulic piston cylinders on the sides for premium appearance
  const pistonCylinders = [];
  for (let side of [-1, 1]) {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, armLength * 0.7, 12), chromeMat);
    cylinder.position.set(side * 0.8, armLength * 0.4, -0.3);
    cylinder.castShadow = true;
    armGroup.add(cylinder);
    pistonCylinders.push(cylinder);
  }

  // 4. Spinning Disc Pivot (sits at the end of the arm)
  const discPivot = new THREE.Group();
  discPivot.name = 'tagada_disc_pivot';
  discPivot.position.set(0, armLength, 0);
  armGroup.add(discPivot);

  // Hinge plate connecting arm to disc
  const connector = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16), metalPedestalMat);
  connector.position.y = -0.2;
  discPivot.add(connector);

  // 5. Disc Mesh Group
  const discMeshGroup = new THREE.Group();
  discMeshGroup.name = 'tagada_disc_mesh';
  discPivot.add(discMeshGroup);

  // Large Tagada Disc Platform
  const discRadius = 7.0;
  const platformGeo = new THREE.CylinderGeometry(discRadius, discRadius, 0.4, 48);
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.receiveShadow = true;
  platform.castShadow = true;
  discMeshGroup.add(platform);

  // Outer chrome rim
  const rimGeo = new THREE.CylinderGeometry(discRadius + 0.05, discRadius + 0.05, 0.5, 48);
  const rim = new THREE.Mesh(rimGeo, chromeMat);
  rim.castShadow = true;
  discMeshGroup.add(rim);

  // 6. Security Railings and Seats
  // A circular handrail around the outer edge of the disc
  const railHeight = 1.1;
  const railPolesCount = 20;
  const railRadius = discRadius - 0.25;

  const handrailGeo = new THREE.TorusGeometry(railRadius, 0.06, 8, 48);
  const handrail = new THREE.Mesh(handrailGeo, railMat);
  handrail.rotation.x = Math.PI / 2;
  handrail.position.y = railHeight;
  handrail.castShadow = true;
  discMeshGroup.add(handrail);

  // Vertical guardrail posts
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, railHeight, 8);
  for (let i = 0; i < railPolesCount; i++) {
    const angle = (i / railPolesCount) * Math.PI * 2;
    // Skip 1 pole segment to act as the entrance gate
    if (i === 0) continue;
    const pole = new THREE.Mesh(poleGeo, railMat);
    pole.position.set(railRadius * Math.cos(angle), railHeight / 2, railRadius * Math.sin(angle));
    pole.castShadow = true;
    discMeshGroup.add(pole);
  }

  // Boarding access at the railing gap
  const accessGroup = new THREE.Group();
  accessGroup.name = 'tagada_access';
  accessGroup.rotation.y = 0;
  discMeshGroup.add(accessGroup);

  const gateWidth = 1.4;
  const gatePostGeo = new THREE.CylinderGeometry(0.06, 0.06, railHeight, 8);
  for (let side of [-1, 1]) {
    const post = new THREE.Mesh(gatePostGeo, railMat);
    post.position.set(railRadius, railHeight / 2, side * gateWidth * 0.5);
    post.castShadow = true;
    accessGroup.add(post);
  }

  const gateGroup = new THREE.Group();
  gateGroup.position.set(railRadius, railHeight * 0.55, -gateWidth * 0.5);
  accessGroup.add(gateGroup);

  const gateBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, gateWidth), railMat);
  gateBar.position.set(0, 0, gateWidth * 0.5);
  gateGroup.add(gateBar);
  gateGroup.rotation.y = Math.PI / 2;

  const deckWidth = 1.9;
  const deckDepth = 2.1;
  const deckThickness = 0.12;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckDepth, deckThickness, deckWidth), accessMat);
  deck.position.set(discRadius + deckDepth * 0.5 - 0.1, 0.2 + deckThickness * 0.5, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  accessGroup.add(deck);


  // 7. Seats & Passengers Setup
  const seats = [];
  const seatRadius = discRadius - 1.1; // 5.9, prevents passenger clipping outward
  const currentHumanHeight = getPassengerWorldHeight();
  
  // Scale down riders slightly to 88% to prevent shoulders/hips clipping into armrests or seat backrests
  const riderHeight = currentHumanHeight * 0.88;

  // Create 8 seat slots spaced around the disc
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;

    const seatGroup = new THREE.Group();
    seatGroup.name = `seat_group_${i}`;
    // Placed exactly on the platform top surface (y = 0.2)
    seatGroup.position.set(seatRadius * Math.cos(angle), 0.2, seatRadius * Math.sin(angle));
    
    // Rotate seat to face the center of the disc platform
    seatGroup.lookAt(0, 0.2, 0);
    discMeshGroup.add(seatGroup);

    // Build procedural Seat Mesh (Cushion + Backrest)
    // Seat base height matches biological knee length of scaled human model (hips sit at 0.80 above floor)
    const seatSurfaceY = 0.80;
    const baseHeight = 0.65; // floor to bottom of cushion

    // Cushion: Box (width 1.2, height 0.15, depth 0.6) centered at 0.725
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.6), seatMat);
    cushion.position.set(0, 0.725, 0);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    seatGroup.add(cushion);

    // Seat back: Box (width 1.2, height 0.85, depth 0.15) at the back (-Z in seatGroup space)
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.15), seatMat);
    seatBack.position.set(0, seatSurfaceY + 0.425, -0.3);
    seatBack.castShadow = true;
    seatGroup.add(seatBack);

    // Dark frame base supporting the seat from the platform floor to the cushion base
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.22, baseHeight, 0.62), seatFrameMat);
    frame.position.set(0, baseHeight / 2, 0);
    seatGroup.add(frame);

    // Seat divider side handles
    const armrestGeo = new THREE.BoxGeometry(0.08, 0.5, 0.5);
    for (let side of [-1, 1]) {
      const armrest = new THREE.Mesh(armrestGeo, railMat);
      armrest.position.set(side * 0.6, seatSurfaceY + 0.25, -0.05);
      armrest.castShadow = true;
      seatGroup.add(armrest);
    }

    // Add Passenger
    let rider = null;
    if (visitors && visitors.length > 0) {
      const template = visitors[i % visitors.length];
      rider = makeRider(template, riderHeight, {
        pool: TAGADA_ACTIONS,
        facingY: 0, // Faces forward (+Z) in local seatGroup space
        phase: i * 1.3
      });

      // Update matrices to lock skeletal elements
      rider.fig.updateMatrixWorld(true);

      const hipBone = rider.fig.getObjectByName('Hips');
      const seatSurfaceY = 0.80; // top of seat cushion
      const targetZ = 0.08;      // slightly forward from backrest (backrest is at -0.3)
      const scale = riderHeight / template.height;

      if (hipBone) {
        const localHip = new THREE.Vector3();
        hipBone.getWorldPosition(localHip);
        rider.fig.worldToLocal(localHip);
        
        const scaledHip = localHip.clone().multiplyScalar(scale);
        
        // Pivot position + scaledHip = (0.0, seatSurfaceY, targetZ)
        rider.pivot.position.set(0.0 - scaledHip.x, seatSurfaceY - scaledHip.y, targetZ - scaledHip.z);
      } else {
        // Fallback if Hips bone is not found
        const riderY = seatSurfaceY - riderHeight * 0.28;
        rider.pivot.position.set(0.0, riderY, targetZ);
      }

      rider.restX = rider.pivot.position.x;
      rider.restY = rider.pivot.position.y;
      rider.restZ = rider.pivot.position.z;

      seatGroup.add(rider.pivot);
    }

    seats.push({
      group: seatGroup,
      rider: rider
    });
  }

  // 8. Emissive Blinking Bulbs for night lighting
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const bulbColors = [0xff00ff, 0x00ffff, 0xffff00, 0xff3300, 0x33ff00];

  const bulbCount = 16;
  for (let i = 0; i < bulbCount; i++) {
    const angle = (i / bulbCount) * Math.PI * 2;
    const color = bulbColors[i % bulbColors.length];

    const bulbMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.0, // off by day
      roughness: 0.1
    });

    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    // Positioned on the chrome outer rim just below handrail height
    bulb.position.set((discRadius + 0.06) * Math.cos(angle), 0.3, (discRadius + 0.06) * Math.sin(angle));
    discMeshGroup.add(bulb);
    bulbs.push(bulb);
  }

  const ridePointLights = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const pl = new THREE.PointLight(0xff00ff, 0, 15, 1.5);
    pl.position.set((discRadius + 0.06) * Math.cos(angle), 0.3, (discRadius + 0.06) * Math.sin(angle));
    discMeshGroup.add(pl);
    ridePointLights.push(pl);
  }

  eventBus.on('color-change', (hex) => {
    bulbs.forEach(b => {
      b.material.color.set(hex);
      b.material.emissive.set(hex);
    });
    ridePointLights.forEach(pl => pl.color.set(hex));
  });

  // 9. Control Panel (semaphore + lever)
  const controlPanel = new ControlPanel({ initialRunning: true });
  // Place control panel next to the Tagada pedestal base (Northeast relative to the ride position)
  controlPanel.group.position.set(11, 0, -11);
  group.add(controlPanel.group);
  group.updateMatrixWorld(true);
  controlPanel.group.lookAt(position[0], position[1], position[2]); // Face the ride center horizontally
  controlPanel.group.rotateY(Math.PI); // Orient panel outward to face approach path

  // 10. Controller object
  const controller = {
    armPivot,
    discMeshGroup,
    panel: controlPanel.group,
    speedMultiplier: 1.0,
    get running() { return controlPanel.running; },
    set running(v) { controlPanel.running = v; },
    spinAngle: 0,
    pitchAngle: 0,
    rollAngle: 0,
    bumpAngle: 0,
    armYawAngle: 0,
    maxSpeed: MAX_SPIN_SPEED,
    toggle() { controlPanel.toggle(); },
    start() { controlPanel.running = true; },
    stop() { controlPanel.running = false; },
    setSpeed(v) { this.maxSpeed = Math.max(0, v); },
  };

  group.userData.tick = (delta, time) => {
    // Tick the control panel state machine (handles RAMP_UP / RAMP_DOWN transition)
    const ease = controlPanel.tick(delta);

    // Accumulate angles scaled by ease and delta for glitch-free smooth stop/deceleration
    const speedMult = controller.speedMultiplier !== undefined ? controller.speedMultiplier : 1.0;
    controller.spinAngle += controller.maxSpeed * ease * speedMult * delta;
    controller.pitchAngle += PITCH_FREQ * ease * speedMult * delta;
    controller.rollAngle += ROLL_FREQ * ease * speedMult * delta;
    controller.bumpAngle += BUMP_FREQ * ease * speedMult * delta;
    controller.armYawAngle += ARM_YAW_SPEED * ease * speedMult * delta;

    const idleEase = 1 - ease;

    // 1. Disc Rotation
    discMeshGroup.rotation.y = controller.spinAngle;

    // 2. Compound Mechanical Arm Oscillation (Yaw, Pitch, Roll)
    armPivot.rotation.y = controller.armYawAngle;
    armPivot.rotation.x = (BASE_PITCH + PITCH_AMP * Math.sin(controller.pitchAngle)) * ease;
    armPivot.rotation.z = ROLL_AMP * Math.sin(controller.rollAngle) * ease;

    const targetArmLength = Math.max(MIN_ARM_LENGTH, armLength - BOARDING_DROP * idleEase);
    const armScale = targetArmLength / armLength;
    mainArm.scale.set(1, armScale, 1);
    mainArm.position.y = targetArmLength / 2;
    discPivot.position.y = targetArmLength;
    pistonCylinders.forEach((cyl) => {
      cyl.scale.set(1, armScale, 1);
      cyl.position.y = (armLength * 0.4) * armScale;
    });

    // 3. Platform Shaking/Bumping effect directly on discPivot
    discPivot.rotation.x = Math.sin(controller.bumpAngle) * BUMP_AMP * ease;
    discPivot.rotation.z = Math.cos(controller.bumpAngle * 0.9) * (BUMP_AMP * 0.5) * ease;

    // 3. Update Passenger poses and add dynamic shaking/jitter
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      if (s.rider) {
        updateRider(s.rider, time + s.rider.phase);

        const B = s.rider.bones;

        // --- LEG OVERRIDE (flat Tagada bench seat) ---
        applyChairSeatedLegs(B, s.rider.scale);

        // --- ARM OVERRIDE: raised hands when riding ---
        // Only arm override at higher ease to preserve idle animations when stopped
        const t = time + i * 1.3;
        const variant = i % 4;

        const arm = (name, dx, dy, dz) => {
          const e = B[name];
          if (!e) return;
          pose(B, name, dx * ease, dy * ease, dz * ease);
        };

        if (ease >= 0.02) {
        if (variant === 0 || variant === 3) {
          // Both arms up cheering
          const pump = Math.sin(t * 4.0) * 0.12;
          arm('UpperArmR', 0.2 + pump, 2.2, -0.2);
          arm('UpperArmL', -0.2 - pump, -2.2, 0.2);
          arm('LowerArmR', 0.8, 0, 0);
          arm('LowerArmL', 0.8, 0, 0);
        } else if (variant === 1) {
          // Right arm wave, left holds rail
          arm('UpperArmR', 0.2, 1.9, -0.2);
          arm('LowerArmR', 1.1, Math.sin(t * 8) * 0.35, Math.sin(t * 8) * 0.35);
          arm('UpperArmL', 0.5, -0.3, 0);
          arm('LowerArmL', 0.8, 0, 0);
        } else {
          // One arm up pointing, other relaxed
          arm('UpperArmR', 0.1, 1.5 + Math.sin(t * 2.5) * 0.1, 0);
          arm('LowerArmR', 0.3, 0, 0);
          arm('UpperArmL', 0.5 + Math.sin(t * 2) * 0.06, -0.4, 0);
          arm('LowerArmL', 0.7, 0, 0);
        }

        } // end arm override

        // Subtle torso lean-back and sway as ride intensifies
        if (B.Torso) {
          const tb = B.Torso.bone;
          tb.rotation.x += -0.15 * ease;
          tb.rotation.z += Math.sin(t * 1.5) * 0.05 * ease;
        }

        // Head tilts up and sways with excitement
        if (B.Head) {
          const hb = B.Head.bone;
          hb.rotation.x += -0.15 * ease;
          hb.rotation.y += Math.sin(t * 2.0) * 0.08 * ease;
        }

        // Tagada specific passenger vibration/shaking when running
        const jitterX = Math.sin(time * JITTER_FREQ + i * 2.1) * JITTER_AMP * ease;
        const jitterY = Math.cos(time * (JITTER_FREQ * 0.9) + i * 1.5) * JITTER_AMP * ease;
        const jitterZ = Math.sin(time * (JITTER_FREQ * 1.1) + i * 0.7) * JITTER_AMP * ease;
        
        // Hips offset + dynamic jitter
        s.rider.pivot.position.set(
          s.rider.restX + jitterX,
          s.rider.restY + jitterY,
          s.rider.restZ + jitterZ
        );

        // Quick tilt/jolt rotation on the passenger pivot during bumps
        s.rider.pivot.rotation.x = Math.sin(time * JITTER_FREQ * 0.8 + i) * 0.07 * ease;
        s.rider.pivot.rotation.z = Math.cos(time * JITTER_FREQ * 0.8 + i * 1.4) * 0.07 * ease;
      }
    }

    // 4. Emissive lights update
    const sun = group.parent?.parent?.getObjectByName('sun') || group.parent?.getObjectByName('sun');
    const isNight = sun ? (sun.position.y < 5.0 || sun.intensity < 0.5) : false;

    if (isNight) {
      bulbs.forEach((b, idx) => {
        // Night bulbs pulse with offset sine waves
        const pulse = Math.sin(time * 6.0 + idx * 0.5) * 0.5 + 0.5;
        b.material.emissiveIntensity = 1.2 + pulse * 2.0;
      });
      ridePointLights.forEach((pl, idx) => {
        const pulse = Math.sin(time * 5.0 + idx * 1.6) * 0.5 + 0.5;
        pl.intensity = (1.2 + pulse * 2.0) * 8.0;
      });
    } else {
      bulbs.forEach((b) => { b.material.emissiveIntensity = 0.0; });
      ridePointLights.forEach((pl) => { pl.intensity = 0.0; });
    }

    if (ease === 0) {
      controller.speedMultiplier = 1.0;
    }
  };

  group.userData.controller = controller;
  return group;
}
