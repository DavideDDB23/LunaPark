import * as THREE from 'three';

export class ControlPanel {
  constructor({ initialRunning = true, onToggle } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'controlPanel';

    this.running = initialRunning;
    this.phase = initialRunning ? 1.0 : 0.0;
    this.ease = initialRunning ? 1.0 : 0.0;
    this.onToggle = onToggle;
    this.eStopPressTime = 0.0;

    this.RAMP_UP = 1.5;
    this.RAMP_DOWN = 2.0;

    this.LEVER_REST = -0.05;  // nearly vertical when off
    this.LEVER_ON = 0.65;     // more forward lean when on

    this.build();
    this.setState(this.ease);
  }

  build() {
    // Scale up the entire control panel group to make it bigger (3.5x size)
    this.group.scale.setScalar(3.5);

    // Premium materials
    const metalBody = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.4, metalness: 0.7 });
    const darkConsoleMat = new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.6, metalness: 0.4 });
    const accentBrass = new THREE.MeshStandardMaterial({ color: 0xb58900, roughness: 0.3, metalness: 0.8 }); // gold/brass trim
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ccff }); // glowing cyan LCD screen
    const emergencyButtonMat = new THREE.MeshStandardMaterial({ color: 0xd30000, roughness: 0.5 });
    const emergencyBaseMat = new THREE.MeshStandardMaterial({ color: 0xffd300, roughness: 0.4 }); // yellow guard
    const greenButtonMat = new THREE.MeshStandardMaterial({ color: 0x00aa22, roughness: 0.5 });
    const blackButtonMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });

    // 1. Base Plate / Pedestal (Flange)
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.08, 16), metalBody);
    basePlate.position.y = 0.04;
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    this.group.add(basePlate);

    // Bolt details on base plate
    const boltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, accentBrass);
      bolt.position.set(Math.cos(angle) * 0.35, 0.09, Math.sin(angle) * 0.35);
      this.group.add(bolt);
    }

    // 2. Post with detailed collars
    const postHeight = 1.1;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, postHeight, 16), metalBody);
    post.position.y = postHeight / 2 + 0.08;
    post.castShadow = true;
    post.receiveShadow = true;
    this.group.add(post);

    // Post collars (rings)
    const collarGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16);
    const bottomCollar = new THREE.Mesh(collarGeo, accentBrass);
    bottomCollar.position.y = 0.18;
    this.group.add(bottomCollar);

    const topCollar = new THREE.Mesh(collarGeo, accentBrass);
    topCollar.position.y = postHeight + 0.02;
    this.group.add(topCollar);

    // 3. Cable Conduit (flexible metal pipe details)
    const conduitGroup = new THREE.Group();
    const conduitSegments = 12;
    const conduitRadius = 0.035;
    for (let i = 0; i < conduitSegments; i++) {
      const t = i / (conduitSegments - 1);
      const angle = t * Math.PI * 0.45;
      const x = 0.16 + Math.sin(angle) * 0.1;
      const y = 1.25 - t * 1.15;
      const z = -0.05 + Math.cos(angle) * 0.08;

      const seg = new THREE.Mesh(new THREE.CylinderGeometry(conduitRadius, conduitRadius, 0.1, 8), accentBrass);
      seg.position.set(x, y, z);
      seg.rotation.z = -angle * 0.8;
      seg.rotation.x = angle * 0.3;
      conduitGroup.add(seg);
    }
    this.group.add(conduitGroup);

    // 4. Sloped Console Group
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0.0, 1.35, 0.0);
    consoleGroup.rotation.x = 0; // vertical panel face
    this.group.add(consoleGroup);

    // Console Housing
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.18), darkConsoleMat);
    consoleBox.castShadow = true;
    consoleBox.receiveShadow = true;
    consoleGroup.add(consoleBox);

    // Bezel (metallic border on console face)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.62, 0.03), metalBody);
    bezel.position.z = -0.08;
    consoleGroup.add(bezel);

    // LCD Screen (cyan glow)
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.02), screenMat);
    screen.position.set(-0.22, 0.08, 0.091);
    consoleGroup.add(screen);

    // Screen frame
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.01), metalBody);
    screenFrame.position.set(-0.22, 0.08, 0.085);
    consoleGroup.add(screenFrame);

    // Emergency Stop Button
    const eStopBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), emergencyBaseMat);
    eStopBase.rotation.x = Math.PI / 2;
    eStopBase.position.set(0.28, 0.12, 0.091);
    consoleGroup.add(eStopBase);

    this.eStopButton = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), emergencyButtonMat);
    this.eStopButton.rotation.x = Math.PI / 2;
    this.eStopButton.position.set(0.28, 0.12, 0.13);
    consoleGroup.add(this.eStopButton);

    // Start / Stop Buttons
    const greenBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), greenButtonMat);
    greenBtn.rotation.x = Math.PI / 2;
    greenBtn.position.set(0.16, -0.12, 0.091);
    consoleGroup.add(greenBtn);

    const blackBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), blackButtonMat);
    blackBtn.rotation.x = Math.PI / 2;
    blackBtn.position.set(0.36, -0.12, 0.091);
    consoleGroup.add(blackBtn);

    // Rotary Dials/Knobs
    const dialGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
    const dialPointerGeo = new THREE.BoxGeometry(0.015, 0.03, 0.05);

    this.dials = [];
    for (let i = 0; i < 2; i++) {
      const dialGroup = new THREE.Group();
      dialGroup.position.set(-0.35 + i * 0.18, -0.15, 0.091);
      
      const dialBase = new THREE.Mesh(dialGeo, metalBody);
      dialBase.rotation.x = Math.PI / 2;
      dialGroup.add(dialBase);

      const dialPointer = new THREE.Mesh(dialPointerGeo, accentBrass);
      dialPointer.position.set(0, 0.03, 0.02);
      dialGroup.add(dialPointer);

      consoleGroup.add(dialGroup);
      this.dials.push(dialGroup);
    }

    // 5. Semaphore Tower housing (arched top)
    const semTower = new THREE.Group();
    semTower.position.set(0.0, 1.95, -0.05);
    this.group.add(semTower);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.68, 0.22), darkConsoleMat);
    housing.castShadow = true;
    housing.receiveShadow = true;
    semTower.add(housing);

    const housingBezel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.7, 0.03), metalBody);
    housingBezel.position.z = -0.1;
    semTower.add(housingBezel);

    // Warning Beacon on top of semaphore housing
    const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), metalBody);
    beaconBase.position.y = 0.36;
    semTower.add(beaconBase);

    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xffa500,
      emissiveIntensity: 0.0,
      roughness: 0.2
    });
    const beaconDome = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.beaconMat);
    beaconDome.position.y = 0.38;
    semTower.add(beaconDome);

    // Lamps & Hoods/Visors
    this._redOff   = new THREE.Color(0x2a0000);
    this._redOn    = new THREE.Color(0xff1100);
    this._greenOff = new THREE.Color(0x002a00);
    this._greenOn  = new THREE.Color(0x00ee33);
    this.redMat   = new THREE.MeshBasicMaterial({ color: this._redOff.clone() });
    this.greenMat = new THREE.MeshBasicMaterial({ color: this._greenOff.clone() });
    const lampGeo = new THREE.SphereGeometry(0.11, 14, 12);
    
    this.redLamp = new THREE.Mesh(lampGeo, this.redMat);
    this.redLamp.position.set(0, 0.16, 0.08);
    semTower.add(this.redLamp);

    this.greenLamp = new THREE.Mesh(lampGeo, this.greenMat);
    this.greenLamp.position.set(0, -0.16, 0.08);
    semTower.add(this.greenLamp);

    // Hoods/Visors (curved traffic-light shields)
    const visorGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.16, 12, 1, true, -Math.PI / 2, Math.PI); // Half cylinder
    
    const redVisor = new THREE.Mesh(visorGeo, metalBody);
    redVisor.rotation.x = Math.PI / 2;
    redVisor.position.set(0, 0.16, 0.12);
    semTower.add(redVisor);

    const greenVisor = new THREE.Mesh(visorGeo, metalBody);
    greenVisor.rotation.x = Math.PI / 2;
    greenVisor.position.set(0, -0.16, 0.12);
    semTower.add(greenVisor);

    // 6. Mechanical Lever
    this.lever = new THREE.Group();
    this.lever.position.set(0.0, 1.45, 0.20);
    this.group.add(this.lever);

    // Lever Hinge Mount
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), metalBody);
    hinge.rotation.z = Math.PI / 2;
    this.lever.add(hinge);

    const hingeCovers = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 10), accentBrass);
    hingeCovers.rotation.z = Math.PI / 2;
    this.lever.add(hingeCovers);

    // Lever Stick (bicolored)
    const lowerStick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), metalBody);
    lowerStick.position.y = 0.15;
    lowerStick.castShadow = true;
    this.lever.add(lowerStick);

    const upperStick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 8), accentBrass);
    upperStick.position.y = 0.42;
    upperStick.castShadow = true;
    this.lever.add(upperStick);

    // Knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 }));
    knob.position.y = 0.55;
    this.lever.add(knob);
  }

  setState(ease) {
    this.redMat.color.lerpColors(this._redOff, this._redOn, 1.0 - ease);
    this.greenMat.color.lerpColors(this._greenOff, this._greenOn, ease);
    this.lever.rotation.x = THREE.MathUtils.lerp(this.LEVER_REST, this.LEVER_ON, ease);

    // Blinking yellow beacon when running, fading off when stopped
    if (this.running) {
      this.beaconMat.emissiveIntensity = 0.75 + Math.sin(Date.now() * 0.01) * 0.45;
    } else {
      this.beaconMat.emissiveIntensity = THREE.MathUtils.lerp(this.beaconMat.emissiveIntensity, 0.0, 0.1);
    }

    // Slowly rotate dials when ease changes
    if (this.dials) {
      this.dials[0].rotation.z = ease * Math.PI * 1.5;
      this.dials[1].rotation.z = (1.0 - ease) * Math.PI * 1.5;
    }

    // Animate emergency button press
    if (this.eStopButton) {
      const btnDepth = this.eStopPressTime > 0 
        ? (0.13 - 0.05 * Math.sin((this.eStopPressTime / 0.3) * Math.PI)) 
        : 0.13;
      this.eStopButton.position.z = btnDepth;
    }
  }

  toggle() {
    this.running = !this.running;
    this.eStopPressTime = 0.3; // trigger 0.3s button press animation
    if (this.onToggle) this.onToggle(this.running);
  }

  tick(delta) {
    const dur = this.running ? this.RAMP_UP : this.RAMP_DOWN;
    this.phase = THREE.MathUtils.clamp(
      this.phase + (this.running ? 1 : -1) * (delta / dur), 0, 1
    );
    this.ease = this.phase * this.phase * (3 - 2 * this.phase); // smoothstep
    
    // Decrement eStop button animation timer
    if (this.eStopPressTime > 0) {
      this.eStopPressTime = Math.max(0, this.eStopPressTime - delta);
    }

    this.setState(this.ease);
    return this.ease;
  }
}
