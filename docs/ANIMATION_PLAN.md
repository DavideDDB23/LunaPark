# Animation Plan — Highest Grade Strategy

> **Obiettivo**: concentrare ogni ora di sviluppo residua sulle animazioni che massimizzano il voto.
> **Deadline**: 20 Giugno 2026
> **Principio guida**: ogni animazione è JavaScript math — niente imported clips, niente AnimationMixer.

---

## Situazione attuale

| Componente | Stato | Note |
|---|---|---|
| Ferris Wheel (counter-rotation + gondola sway) | ✅ Completo | 10 gondole, 2 passeggeri ciascuna |
| Carousel (platform spin + horse bob + jockey) | ✅ Completo | 8 cavalli, sfasamento sinusoidale |
| Roller Coaster (CatmullRom + Frenet frame + cart) | ✅ Completo | Velocità variabile con fisica |
| Tagada (compound oscillation + spin + pistons) | ✅ Completo | 2 assi simultanei + molle inerziali |
| NPC Visitors (procedural gait + A* navigation) | ✅ Implementato | ~800 righe, IK analitico 2-bone, pathfinding |
| Stage structure | ✅ Completo | Fari, beam volumetrici, altoparlanti, microfono |
| Luci decorative notturne (blink/pulse/chase) | ✅ Presenti | Ma NON tutte collegate al color-picker |
| Day/Night cycle | ✅ Completo | Sky crossfade, hemisfera, sole orbitale |
| Water shader (waves, caustics, foam) | ✅ Completo | Custom shader |

---

## Tier 1 — Critical (massimo impatto, da fare SUBITO)

### 1. Performer sul palco

**File**: `js/environment/Stage.js`

**Cosa**: Aggiungere 1-2 personaggi sul palco usando i template Quaternius già presenti (`Passengers.js`). Un cantante al microfono + un musicista. Animazione procedurale scheletro.

**Dettagli implementazione**:
- Riciclare `loadVisitorTemplates()` + `makeRider()` da `Passengers.js` (stessi modelli dei visitatori)
- Posizionare il performer al microfono esistente (posizione `(0, 0.6, Z - 5)`)
- Animazione braccia: `Math.sin(time * ritmo)` per sway + gestualità
- Animazione testa: annuire a ritmo, guardare il pubblico
- Animazione corpo: dondolio sulle gambe, peso shift
- Sincronizzare con i beam volumetrici già presenti (intensità / colore pulsante col ritmo)

**Perché funziona per il voto**:
- Dimostra gerarchia di trasformazioni (Lezione 05)
- Mostra animazione scheletro procedurale senza imported clips
- Colpisce durante la demo — "wow moment"
- Rende vivo il palco che ora è vuoto

**Stima**: ~150 righe in Stage.js

```js
// Pseudocode struttura:
// 1. loadVisitorTemplates(2) → 2 performer templates
// 2. makeRider() per cantante + musicista
// 3. Nel tick():
//    - beat = Math.floor(time * BPM / 60)
//    - phase = (time * BPM / 60) % 1
//    - Braccia: swing = Math.sin(phase * 2 * PI) * 0.3
//    - Testa: headNod = Math.sin(phase * 2 * PI) * 0.1
//    - Corpo: weightShift = Math.sin(phase * 2 * PI) * 0.05
// 4. Beam intensity sincronizzata con beat
```

---

### 2. Moonlight + Night Lighting Fix

**File**: `js/lighting/DayNightCycle.js`, `js/main.js`

**Cosa**: Aggiungere luce lunare opposta al sole e fixare l'illuminazione notturna.

**Dettagli**:
- `DirectionalLight(0x4466aa)` posizionata all'opposto del sole
- Intensità: 0.05–0.1 di notte, 0 di giorno (crossfade)
- Hemisphere light intensity: 0.22 → ~0.35 di notte (attualmente troppo buio)
- Tone mapping exposure: 0.36 → ~0.45–0.50 di notte
- Background intensity: alzare per cielo notturno + riflessioni

**Perché funziona**:
- Trasforma la qualità visiva notturna (l'esaminatore vede tutto, non solo silhouette)
- Dimostra comprensione di lighting systems + rendering equation
- Pochissimo codice per impatto enorme

**Stima**: ~50 righe in DayNightCycle.js

---

### 3. NPC Idle Animation Variety

**File**: `js/environment/Visitors.js` (funzione `applyGaitPose`)

**Cosa**: Quando i visitatori sono in stato `waiting`, invece di stare immobili, fare animazioni di idle variate.

**Dettagli**:
- Aggiungere un array `idleActions` per visitatore (scelto random allo spawn)
- `lookAtPhone`: testa china, braccio alzato a 90° col telefono
- `stretch`: braccia sopra la testa, torso allungato
- `lookAround`: testa che ruota a sx/dx lentamente
- `pointAtRide`: un braccio teso verso la giostra più vicina
- `clap`: mani battenti (usi già `UpperArm.L/R` + `LowerArm.L/R`)
- Transizione graduale: quando `state === 'waiting' && wait > 2s`, attiva idle

**Perché funziona**:
- I visitatori fermi sono il difetto più visibile dell'animazione NPC
- Mostra controllo fine dello scheletro
- Poche righe (ogni idle è 3-5 rotazioni ossee)

**Stima**: ~80 righe in Visitors.js

```js
// Esempio idle "lookAtPhone":
const idleActions = {
  phone: (w, t) => {
    spinBone(U['UpperArm.R'], -0.8, -0.3, 0.4);  // braccio su
    spinBone(U['LowerArm.R'], 0.9, 0, 0);          // avambraccio piegato
    spinBone(U['Head'], 0.25, -0.2, 0);            // testa china
    spinBone(U['Neck'], -0.15, 0.1, 0);
  },
  stretch: (w, t) => {
    // braccia su + torso esteso
  },
  // ...
};
```

---

### 4. Food Stall Steam / Smoke Particles

**File**: `js/environment/FoodStalls.js`

**Cosa**: Aggiungere un sistema particellare minimale per simulare vapore/cottura.

**Dettagli**:
- Usare `THREE.Points` con ~20–30 particelle per stall
- Texture: sprite circolare soft (generata via canvas, 32×32)
- Ogni particella: posizione iniziale sopra lo stall, velocity.y = 0.3–0.6, drift.x random
- Lifecycle: spawn in alto → fade out → respawn in basso
- Leggero wind effect (leggi `getWindSpeed()` da main.js)

**Perché funziona**:
- Dettaglio che fa la differenza nella demo
- Mostra comprensione di particle systems (Three.js Points)
- Non esiste ancora nessun particle effect nel progetto — si distingue

**Stima**: ~100 righe in FoodStalls.js

```js
// Particle system base:
const particleCount = 25;
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);
const lifetimes = new Float32Array(particleCount);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const material = new THREE.PointsMaterial({
  map: steamSprite, transparent: true, opacity: 0.3,
  blending: THREE.AdditiveBlending, depthWrite: false,
  size: 0.4,
});
const particles = new THREE.Points(geometry, material);
// tick(): update position + lifetime, respawn dead ones
```

---

## Tier 2 — Medium Impact (da fare dopo Tier 1)

### 5. Decoration Lights — Verifica Completa Color-Picker

**File**: `js/environment/Tagada.js`, `js/environment/Carousel.js`

**Cosa**: Assicurarsi che TUTTI i gruppi di bulbi rispondano al `color-change` event.

**Verifica attuale**:
- **Tagada**: `bulbs[]` + `ridePointLights[]` → aggiornati ✅
- **Carousel**: `bulbMat` + `ridePointLights[]` → aggiornati ✅
- **MA**: Carousel ha anche `cFestoon[]`, `cSeam[]`, `cColumn[]`, `cNeonMat` → NON vengono aggiornati dal color-picker ❌
- **MA**: Tagada ha `canopyBulbs[]`, `rimBulbs[]`, `ledRings[]`, `basePanels[]`, `festoonBulbs[]`, `seatLeds[]`, `armStrips[]` → NON vengono aggiornati ❌

**Fix**: Aggiungere `eventBus.on('color-change', ...)` handler che aggiorna TUTTI questi gruppi.

**Stima**: ~20 righe

---

### 6. Entrance Gate Sign Animation

**File**: `js/environment/Props.js`

**Cosa**: Potenziare l'animazione del telone "LUNA PARK" all'ingresso.

**Dettagli**:
- Già esiste un `tick` nel gate (main.js lo chiama a linea 478)
- Aggiungere leggero wave/deform periodico al telo (deformazione vertici)
- Oppure: sway al vento con `getWindSpeed()`
- Oppure: luci che scorrono lungo il bordo del cartello

**Stima**: ~30 righe

---

### 7. Ferris Wheel Passenger Pose Variety

**File**: `js/environment/FerrisWheel.js`

**Cosa**: Variare le pose dei passeggeri per gondola.

**Dettagli**:
- Attualmente tutti i passeggeri hanno la stessa posa (`ACTIONS_SEATED_GENERAL`)
- Assegnare pose diverse per gondola: chi parla, chi guarda fuori, chi filma col telefono
- Usare gli `ACTIONS_*` già esistenti in `Passengers.js`
- Alternare per gondola index (pari/dispari)

**Stima**: ~20 righe

---

## Tier 3 — Polish (tempo permettendo)

### 8. Time HUD — Arc + Sun/Moon Icon

**File**: `index.html`, `js/main.js`

**Cosa**: Aggiungere l'arco semi-circolare con icona sole/luna che segue la posizione.

**Dettagli**:
- Canvas 2D overlay (come il resto dell'HUD)
- Arco 180° con cursore che rappresenta la posizione del sole
- Icona sole/luna sul cursore
- Label "Day / Dusk / Night"

**Stima**: ~80 righe (HTML/CSS/JS)

### 9. In-World Ride Hints

**Cosa**: Piccoli cartelli 3D near le giostre che appaiono quando il visitatore è vicino.

**Stima**: ~50 righe

### 10. Water Night Tint

**File**: Shader dell'acqua

**Cosa**: Schiarire il colore notturno del river shader.

**Stima**: ~10 righe

---

## Ordine di implementazione

```
Priority  │ Task                    │ Stima │ Impatto demo
──────────┼─────────────────────────┼───────┼─────────────
  1       │ Performer sul palco     │ 150 r │ ★★★★★
  2       │ Moonlight + night fix   │  50 r │ ★★★★☆
  3       │ NPC idle variety        │  80 r │ ★★★★☆
  4       │ Steam particles         │ 100 r │ ★★★☆☆
  5       │ Color-picker complete   │  20 r │ ★★★☆☆
  6       │ Gate sign animation     │  30 r │ ★★☆☆☆
  7       │ Ferris pose variety     │  20 r │ ★★☆☆☆
```

---

## Cosa NON fare (spreco di tempo per il voto)

| Cosa | Perché no |
|------|-----------|
| Ottimizzazioni performance (LOD, instancing) | Già performante — tempo sprecato |
| Rifare UI del tempo con react/vue | Non richiesto dal corso |
| Aggiungere nuovi modelli 3D importati | Nessuna animazione importata = regola d'oro |
| Suoni / audio | Non parte del corso |
| Post-processing bloom/SSAO | Carino ma non richiesto, rischioso per performance |

---

## Collegamenti con le lezioni (per l'orale)

Ogni animazione proposta si aggancia ai topic del corso:

| Lezione | Feature |
|---------|---------|
| 05 — Trasformazioni 3D | Performer: gerarchia scheletro, rotazioni composte |
| 18 — Animazioni computer | Tutte: parametri temporali `f(t)` |
| 19 — Fisica per animazione | Steam particles: velocità, gravità,衰减 |
| 13 — Equazione di rendering | Moonlight: emisfera + direzionale + tone mapping |
| 11–12 — Shading | Decorazione luci: emissive, PBR |

---

## Tempo totale stimato

- Tier 1: ~4–6 ore
- Tier 2: ~1–2 ore
- Tier 3: ~1–2 ore

**Totale: 6–10 ore** per completare tutto. Priorità assoluta al **performer sul palco**.
