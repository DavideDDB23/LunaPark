# Audio Plan — Luna Park 3D

> Back to [README](../README.md)

---

## Status: Optional (Phase 4)

Audio is not required by the project specification. It will be added in Phase 4 only if time allows and it does not impact performance.

---

## Planned Audio

### Ambient — Fairground Atmosphere
- Distant crowd noise, music, general fairground ambience
- Always playing at low volume when scene loads
- Volume decreases slightly at night

**Source:** [freesound.org](https://freesound.org) — search "fairground ambience" or "amusement park crowd" — CC0 or CC-BY  
**Format:** MP3 (compressed, ~100KB), looping  
**Implementation:** `Web Audio API`, `AudioContext`, `AudioBufferSourceNode.loop = true`

---

### Ride Sounds (per ride, positional audio)

| Ride | Sound | Variation |
|---|---|---|
| Ferris Wheel | Slow creaking metal, low hum | Volume proportional to speed |
| Carousel | Carousel music organ (classic) | Pitch proportional to speed |
| Roller Coaster | Track rattling, whoosh on curves | Volume on curves |
| Tagada | Mechanical clanking, crowd screams | Varies with arm angle |

**Positional audio:** `THREE.PositionalAudio` + `THREE.AudioListener` attached to camera. Each ride has a `PositionalAudio` node as a child, so its volume/pan is automatically computed from camera distance.

**Source:** freesound.org (CC0 preferred). Search terms:
- "carousel organ music loop"
- "rollercoaster track noise"
- "mechanical arm clank loop"
- "amusement park ride ambient"

---

### Click Feedback Sounds
- Control panel click: subtle mechanical click sound
- Lamppost toggle: small electrical buzz

Brief, non-looping, triggered on `InteractionManager.handleClick`.

---

## Implementation Notes

```
Web Audio API integration with Three.js:
  
  listener = new THREE.AudioListener()
  camera.add(listener)
  
  // Global ambient
  ambientSound = new THREE.Audio(listener)
  audioLoader.load('fairground_ambient.mp3', (buffer) => {
    ambientSound.setBuffer(buffer)
    ambientSound.setLoop(true)
    ambientSound.setVolume(0.3)
    ambientSound.play()
  })
  
  // Per-ride positional
  rideSound = new THREE.PositionalAudio(listener)
  audioLoader.load('carousel_music.mp3', (buffer) => {
    rideSound.setBuffer(buffer)
    rideSound.setLoop(true)
    rideSound.setRefDistance(20)    // full volume within 20 units
    rideSound.setVolume(0)          // start silent (ride is stopped)
  })
  ride.root.add(rideSound)  // attach to ride group — automatic 3D positioning
  
  // Start/stop sound with ride
  onRideStart: rideSound.setVolume(0.8); rideSound.play()
  onRideStop:  rideSound.setVolume(0)
```

---

## Performance Note

Audio processing runs on the Web Audio API's audio thread, separate from the main JS/rendering thread. Performance impact is negligible unless many concurrent sounds play simultaneously. Limit to 5–6 concurrent audio sources maximum.

---

## Fallback

If audio causes any issues (autoplay policy, memory, or performance), it will be completely disabled. Audio is a nice-to-have, not a graded requirement.

**Browser autoplay policy:** Most browsers block audio that starts without user interaction. Trigger `AudioContext.resume()` on the first user click event to satisfy this requirement.
