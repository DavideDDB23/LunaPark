# Design Spec — HUD Ride Hotbar (FPV diretto per giostra)

**Data:** 2026-06-16
**Stato:** Approvato, in attesa di implementation plan
**Scope:** Single-implementation task, no decomposition needed

---

## Sommario

Sostituisce l'attivazione FPV basata sul tasto `C` (euristica "giostra più vicina entro 80u") con una **hotbar a tutta larghezza in fondo allo schermo**: 6 bottoni, uno per giostra. Click → entra in FPV su quella giostra. Stesso bottone in FPV → esce. Altro bottone in FPV → switch istantaneo. `ESC` → esce. Il tasto `C` viene rimosso del tutto.

## Problema

`src/controls/CameraManager.js:319-321` mappa `C` su `enterFPV()`, che sceglie la giostra più vicina alla camera entro 80u. Con 5 giostre nel parco è facile cliccarci sopra per sbaglio e ritrovarsi in una giostra diversa da quella voluta. Inoltre, dopo l'entrata in FPV, la camera può "scaraventare" l'utente in posizioni inattese se la giostra più vicina cambia durante il frame successivo. Serve un selettore esplicito.

## Decisioni approvate

| Decisione | Scelta |
|---|---|
| Tasto `C` | rimosso (handler + help text + README) |
| Mongolfiere in scena | 3, già presenti nel GLB `balloon.glb` (sub-root `V1_HotAirBalloon_{1,2,3}`) |
| Bottone mongolfiera | 1 solo, entra in FPV sempre sulla #1 |
| FPV mongolfiera | segue drift + sway della mongolfiera in tempo reale |
| Layout bottoni | barra inferiore a tutto schermo (hotbar) |
| Comportamento FPV | toggle stesso bottone / switch altro bottone (istantaneo) / `ESC` esce |
| Approccio | B (refactor `Balloon.js` per 3 sub-group + nuovo `RideHotbar` + `enterFPVById` su `CameraManager`) |

## Architettura

```
index.html
  └─ <div id="rideHotbar">  ← 6 bottoni (rendered by RideHotbar)
  └─ <div id="hud">         ← invariata (Wind/Time/Auto/Lights/help)

src/ui/RideHotbar.js            ← NEW: render & eventi dei 6 bottoni
src/rides/Balloon.js            ← MODIFIED: 3 sub-group separati, ognuno con proprio bbox
src/controls/CameraManager.js   ← MODIFIED: enterFPVById(rideId), rimozione tasto C
src/App.js                      ← MODIFIED: balloon ritorna {group, balloons[]}, init hotbar
```

Nessun altro modulo è toccato. Render loop, day/night cycle, visitors, altre 4 giostre, shooting gallery, stage, lampposts, fireworks: invariati.

---

## Componente 1: `src/ui/RideHotbar.js` (NEW)

**API esportata:**

```js
setupRideHotbar({ rides, onSelect, getActiveRideId })
```

- `rides`: `Array<{ id: string, name: string, icon: string /* SVG markup */ }>`. Esattamente 6 entry nell'ordine: `ferris`, `carousel`, `coaster`, `tagada`, `train`, `balloon`.
- `onSelect(rideId, opts)`: callback chiamata su click. `opts.toggle = true` quando il bottone cliccato corrisponde al ride attivo in FPV.
- `getActiveRideId()`: callback iniettata da `App.js` per interrogare lo stato corrente (`cameraManager.isFPV ? cameraManager._fpvRide?.group?.userData?.rideId ?? null : null`).

**Rendering:** un singolo `<div id="rideHotbar">` con 6 `<button class="ride-btn" data-ride-id="...">`. Ogni bottone ha `<span class="ride-btn-icon">{svg}</span>` + `<span class="ride-btn-label">name</span>`. La funzione appende il nodo a `document.body` e ritorna `{ destroy() }` per cleanup (non usato in questa task).

**Stile (CSS inline in RideHotbar.js o allegato come `<style>` iniettato):**

```css
#rideHotbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(12, 15, 22, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  z-index: 6;
  pointer-events: none;     /* sfondo non blocca i click sul canvas */
}
.ride-btn {
  pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-width: 76px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px; font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.ride-btn:hover {
  border-color: rgba(255, 160, 28, 0.55);
  background: rgba(255, 160, 28, 0.08);
}
.ride-btn:active { transform: scale(0.97); }
.ride-btn.is-active {
  border-color: #ffa01c;
  background: rgba(255, 160, 28, 0.18);
  box-shadow: 0 0 12px rgba(255, 160, 28, 0.45);
  color: #ffd9a8;
}
.ride-btn-icon { width: 24px; height: 24px; display: block; }
.ride-btn[disabled] { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
  .ride-btn { min-width: 52px; padding: 6px 8px; }
  .ride-btn-label { font-size: 10px; }
}
```

**Update loop stato attivo:** un `requestAnimationFrame` interno al setup che ogni frame rilegge `getActiveRideId()` e applica/toglie la classe `.is-active` al bottone con `data-ride-id === activeId`. Pattern identico al `syncUI` già presente in `index.html:883-895`.

**Cosa NON fa:** niente logica FPV, niente Three.js, niente EventBus, niente conoscenza del `CameraManager`. Pura view → callback.

---

## Componente 2: `src/rides/Balloon.js` (MODIFIED)

**Cambio firma:** `buildBalloon()` ritorna ora `{ group, balloons }` invece di un singolo `THREE.Group`.

```js
// New return
{ group: THREE.Group, balloons: [b1, b2, b3] }
```

- `group`: contenitore vuoto con nome `balloon` (ciò che `App.js` aggiunge a `environmentGroup`).
- `balloons[i]`: `THREE.Group` con nome `balloon_${i+1}`, figlio di `group`, contenente solo la mesh della mongolfiera i+1, con scala corretta sul **proprio** bbox.

**Algoritmo di split (sostituisce l'attuale `Box3().setFromObject(model)` su tutto il GLB):**

1. Carica GLB come oggi.
2. Per `i` in `[1, 2, 3]`:
   - `node = model.getObjectByName('V1_HotAirBalloon_' + i)` (ricorsivo, Three.js lo fa di default).
   - Se `node` manca: log errore, skip.
   - `bbox = new Box3().setFromObject(node)`.
   - `scale = bbox.max.y > bbox.min.y ? 14 / (bbox.max.y - bbox.min.y) : 1`. `targetHeight = 14` (invariato).
   - `node.scale.setScalar(scale)`.
   - Centra orizzontalmente (`node.position.x -= bbox.center.x * scale;` ...; approccio preciso: applica scala, ricalcola bbox, sottrai center).
   - Allinea fondo a y=0 come oggi.
   - `node.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } })`.
   - Crea `b = new THREE.Group(); b.name = 'balloon_' + i; b.add(node); b.userData.fpvTarget = node;`
   - Posizione iniziale random: angolo + distanza come oggi, ma con seed deterministico per balloon i (es. `i * 137° + 5.7°`) per evitare 3 mongolfiere sovrapposte allo spawn. Altezza y in `[35, 45]` come oggi.
   - Crea `balloonLight = new PointLight(0xff8844, 0, 25, 1.5); balloonLight.position.set(0, 7, 0); b.add(balloonLight);` (centrato nel balloon, non alla metà del model totale).
   - Stato locale: `driftAngle, isNight, nightFactor, baseY` per balloon.
   - `b.userData.tick = (delta, time, windSpeed) => { /* identico al tick attuale ma opera su `b` invece che sul group globale */ }`.
   - `b.userData.enterFPV` (opzionale, vedi sotto).
3. Ritorna `{ group, balloons: [b1, b2, b3] }`.

**Reattività ESC/tasto Space/Time:** i balloon continuano a sentire `eventBus.on('time-phase-change', ...)` come oggi — la registrazione va spostata dentro al loop, una per balloon.

**Esposizione FPV (balloon #1):** `balloons[0].userData.rideId = 'balloon'`, `userData.rideName = 'Mongolfiera'`. `userData.fpvTarget` è la mesh root (il node aggiunto al `THREE.Group` del balloon). App.js userà questo per il getter ride.

---

## Componente 3: `src/controls/CameraManager.js` (MODIFIED)

**Modifica 1 — rimozione tasto C (riga 319-321):**

```diff
   } else if (key === 'c' || key === 'C') {
-    if (this.state === 'fpv') { this.exitFPV(); }
-    else if (this.state === 'orbit' || this.state === 'flying') { this.enterFPV(); }
   } else if (key === 'Escape') {
```

Rimuovere l'intero blocco `else if (key === 'c' || key === 'C') { ... }`. `enterFPV()` resta nel file (non deprecato) ma non viene più chiamato da nessun handler interno.

**Modifica 2 — nuovo metodo `enterFPVById(rideId)`:**

```js
enterFPVById(rideId) {
  const rides = this.getRides();
  if (!rides || rides.length === 0) return;

  const ride = rides.find(r => r.group?.userData?.rideId === rideId);
  if (!ride) {
    console.warn('[CameraManager] No ride with id', rideId);
    return;
  }

  // Toggle: se sono già in FPV su questa giostra → esci.
  if (this.state === 'fpv' && this._fpvRide === ride) {
    this.exitFPV();
    return;
  }

  // Switch o primo ingresso: esci da FPV corrente (se in corso) e atterra sulla nuova.
  if (this.state === 'fpv') {
    // Esci pulito (ripristina riders nascosti, salva _preFpvPos se servono dopo — qui non servono).
    this._cleanupFPV();
  }

  // FPV landing diretto, senza volo intermedio.
  this._fpvTarget = ride.getFpvTarget();
  if (!this._fpvTarget) {
    console.warn('[CameraManager] Ride', rideId, 'has no FPV target');
    return;
  }
  this._fpvRide = ride;
  this._fpvOffset.copy(ride.getFpvOffset());

  // Nascondi riders della nuova giostra per evitare clipping.
  this._hiddenRiders = [];
  if (ride.getRiders) {
    const riders = ride.getRiders();
    if (riders && riders.length > 0) {
      for (const rider of riders) {
        if (rider && rider.pivot) {
          rider.pivot.visible = false;
          this._hiddenRiders.push(rider);
        }
      }
    }
  }

  this.state = 'fpv';
  this.controls.enabled = false;
}
```

Nessun cambio a `exitFPV()`, `_tickFPV()`, `_finishFlight()`, `_cleanupFPV()`. Niente volo in ingresso: la camera "salta" dentro la cesta (così come lo switch tra giostre è istantaneo).

**Niente `enterFPVById` durante flying → target:** deciso. Se l'utente è in volo (state === 'flying'), l'atterrare in FPV sovrascrive lo stato. `_startFlight` chiama già `_cleanupFPV()` e abilita `controls.enabled = false`, quindi il flusso è coerente.

---

## Componente 4: `src/App.js` (MODIFIED)

**Cambio 1 — `buildBalloon` (righe 356-357):**

```diff
-  const balloon = await buildBalloon();
-  environmentGroup.add(balloon);
+  const { group: balloonContainer, balloons } = await buildBalloon();
+  environmentGroup.add(balloonContainer);
```

**Cambio 2 — `world` object (riga 568):**

```diff
-    balloon,
+    balloons,
```

**Cambio 3 — animate loop (riga 624):**

```diff
-  if (world.balloon?.userData.tick) world.balloon.userData.tick(delta, time, wind);
+  if (world.balloons) {
+    for (const b of world.balloons) {
+      if (b.userData.tick) b.userData.tick(delta, time, wind);
+    }
+  }
```

**Cambio 4 — tag rideId sui 5 ride esistenti** (righe 108-266, callback `getRides()`):

Aggiungere a ciascuno dei 5 oggetti ride:
- `userData: { rideId: 'ferris' | 'carousel' | 'coaster' | 'tagada' | 'train', rideName: '...' }`

L'`userData` va sul `fw`, `cr`, `tg`, `co`, `tr` (i `THREE.Group` ritornati dalle factory). I ride objects pushati nell'array fanno riferimento a `group: fw` ecc., quindi `r.group.userData.rideId` è raggiungibile.

**Cambio 5 — balloon #1 come sesto ride:** aggiungere al callback `getRides()`:

```js
if (balloons && balloons[0]) {
  const b1 = balloons[0];
  rides.push({
    group: b1,
    getFpvTarget: () => b1.userData.fpvTarget,
    getFpvOffset: () => new THREE.Vector3(0, 1.5, 0),
    getRiders: () => [],
    getFpvCameraPos: (fpvTarget, targetVec) => {
      // eye height 1.8m sopra la base del fpvTarget, leggermente dietro per guardare avanti
      fpvTmpVec.set(0, 1.8, 0);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvLookTarget: (fpvTarget, targetVec) => {
      // guarda "in avanti" lungo la direzione di drift del balloon, fallback a -Z locale
      const driftAngle = b1.userData.driftAngle ?? 0;
      const dist = 10;
      fpvTmpVec.set(Math.cos(driftAngle) * dist, 1.8, Math.sin(driftAngle) * dist);
      fpvTarget.localToWorld(fpvTmpVec);
      targetVec.copy(fpvTmpVec);
    },
    getFpvUp: (fpvTarget, upVec) => {
      fpvTarget.getWorldQuaternion(fpvTmpQuat);
      upVec.set(0, 1, 0).applyQuaternion(fpvTmpQuat);
    }
  });
}
```

Nota: `b1.userData.driftAngle` deve essere esposto da `Balloon.js` (oggi è locale al modulo). Modifica: salvare `b1.userData.driftAngle` ad ogni update del tick, così la FPV può leggerlo.

**Cambio 6 — init hotbar (dopo la riga 437, dopo `cameraManager.setInteractiveObjects`):**

```js
import { setupRideHotbar } from './ui/RideHotbar.js';

const rideHotbarRides = [
  { id: 'ferris',   name: 'Ruota',           icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="7"/><path d="M12 3v14M5 10h14M7.05 5.05l9.9 9.9M7.05 14.95l9.9-9.9"/><circle cx="12" cy="10" r="1.2" fill="currentColor"/></svg>' },
  { id: 'carousel', name: 'Carosello',       icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M3 9h18v2a9 9 0 0 1-18 0V9z"/><path d="M12 7v4"/></svg>' },
  { id: 'coaster',  name: 'Montagne Russe',  icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h4v-3a3 3 0 0 1 6 0v3h4v-3a3 3 0 0 1 6 0v3"/><circle cx="6" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>' },
  { id: 'tagada',   name: 'Tagada',          icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>' },
  { id: 'train',    name: 'Brucomela',       icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="6" width="14" height="11" rx="2"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="15" cy="20" r="1.5" fill="currentColor"/><path d="M5 12h14"/></svg>' },
  { id: 'balloon',  name: 'Mongolfiera',     icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-3.5 0-6 2.5-6 6 0 4 3 8 6 8s6-4 6-8c0-3.5-2.5-6-6-6z"/><path d="M9 17l3 4 3-4"/><path d="M12 7v6"/></svg>' },
];

setupRideHotbar({
  rides: rideHotbarRides,
  onSelect: (id, opts) => {
    if (opts?.toggle) {
      cameraManager.exitFPV();
    } else {
      cameraManager.enterFPVById(id);
    }
  },
  getActiveRideId: () =>
    cameraManager.isFPV ? cameraManager._fpvRide?.group?.userData?.rideId ?? null : null,
});
```

**Cambio 7 — help text in `index.html` (riga 713):**

```diff
-                <li><kbd>C</kbd>: First-Person FPV Ride</li>
+                <li>Click ride button (bottom bar): Enter FPV</li>
```

**Cambio 8 — README.md (sezione Controls):**

```diff
-| `C` near a ride | Enter FPV ride camera |
+| Click ride button (bottom bar) | Enter FPV ride camera |
```

---

## Error handling

| Caso | Comportamento |
|---|---|
| Click bottone durante `state === 'flying'` (volo in corso) | `enterFPVById` chiama `_cleanupFPV()` (cancella riders nascosti e `fpvTarget/ride`) e atterra direttamente sulla nuova. Lo switch è istantaneo, niente volo. |
| Click su bottone durante `exitFPV()` (flying di ritorno) | `enterFPVById` salva `_preFpvPos/_preFpvTarget = null` in `_cleanupFPV`, atterra su nuova. Volo di ritorno abortito. |
| Ride ID non trovato in `getRides()` | `console.warn`, no-op. |
| `getFpvTarget()` ritorna `null` | `console.warn`, no-op. |
| GLB `balloon.glb` privo di 3 sub-root | `buildBalloon` logga errore, ritorna `{ group: new Group(), balloons: [] }`. Bottone "Mongolfiera" in hotbar riceve `disabled` (controllo in `setupRideHotbar` confrontando `rides` con la ride list attiva). |
| ESC durante FPV | invariato, `exitFPV()`. |
| ESC durante flying di `flyToPreset` (1-6) | invariato, `_finishFlight()`. |

---

## Testing (manuale, no test suite esistente)

1. Aprire `localhost:8080` (server già attivo).
2. Cliccare ciascuno dei 6 bottoni dalla camera orbit → si entra nella FPV della giostra giusta.
3. Dalla FPV, cliccare lo stesso bottone → si esce.
4. Dalla FPV, cliccare un altro bottone → si entra nella nuova FPV senza volo intermedio.
5. Dalla FPV, premere `ESC` → si esce.
6. Verifica mongolfiere: le 3 mongolfiere in scena restano distinte, non sovrapposte, ciascuna con il proprio design.
7. Premere `C` → non fa nulla (rimosso).
8. Su viewport 375px di larghezza: i bottoni si riducono a label abbreviata + icona, restano cliccabili.
9. Aprire la HUD esistente e l'help: `C` non compare più, "Click ride button" sì.
10. L'icona del bottone della giostra attualmente in FPV ha il glow arancione.

---

## Out of scope (YAGNI)

- Volo di avvicinamento/ritorno quando si entra/esce dalla FPV. L'utente sceglie esplicitamente e vuole azione immediata.
- Supporto per più mongolfiere selezionabili dalla HUD (solo #1).
- Pannello impostazioni per cambiare scaling/altezza mongolfiere.
- Effetti sonori all'ingresso in FPV.
- Refactor di `CameraManager.enterFPV()` (rimozione completa) — la funzione resta ma è unreferenced. Rimozione possibile in un task successivo.
- Refactor del callback gigante `getRides()` in `App.js` in una `RideRegistry` separata.

---

## File toccati — riepilogo

| File | Tipo | Cambiamento |
|---|---|---|
| `src/ui/RideHotbar.js` | NEW | ~120 righe (componente + CSS) |
| `src/rides/Balloon.js` | MODIFIED | split 3 sub-group, ritorno `{group, balloons}` |
| `src/controls/CameraManager.js` | MODIFIED | -3 righe (rimozione `C`), +30 righe (`enterFPVById`) |
| `src/App.js` | MODIFIED | ~10 righe cambiate + ~30 nuove per hotbar + balloon split |
| `index.html` | MODIFIED | 1 riga help text |
| `README.md` | MODIFIED | 1 riga tabella Controls |
