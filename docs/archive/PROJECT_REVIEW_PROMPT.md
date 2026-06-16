# Prompt per Revisione Generale del Progetto

Copia e incolla questo prompt in una nuova sessione Claude Code (o qualsiasi AI agent) per ottenere una revisione completa e imparziale del progetto Luna Park, con suggerimenti per massimizzare il voto.

---

```
Sei un reviewer esperto di progetti Three.js per un esame universitario di Interactive Graphics.
Analizza a fondo questo progetto e dimmi esattamente cosa manca, cosa può essere migliorato,
e cosa aggiungere per prendere il VOTO MASSIMO.

## Contesto

- Esame: Interactive Graphics — Università di Roma "La Sapienza"
- Professore: Marco Schaerf
- Template: Three.js r184, ES modules, nessun bundler
- Regola SACRA: nessuna imported animation — tutto il movimento è JavaScript math
- Scadenza: 20 Giugno 2026
- Orale: 24 Giugno 2026

## Istruzioni

1. LEGGI TUTTI i file JS nella directory, in particolare:
   - TODO.md (lista completa di cosa è fatto/non fatto)
   - js/main.js (entry point e render loop)
   - js/environment/ (tutti i file: Stage, FerrisWheel, Carousel, Tagada, Coaster, Visitors, ecc.)
   - js/lighting/ (DayNightCycle.js, LightManager.js)
   - js/camera/ (CameraManager.js)
   - js/utils/ (EventBus.js, InteractionManager.js, loaders.js)
   - index.html
   - docs/ (tutti i file .md)
   - tests/ (se presenti)
   - package.json

2. Per OGNI file, analizza:
   - Ci sono bug evidenti?
   - Ci sono performance issue?
   - Ci sono violazioni delle regole del progetto?
   - Il codice segue lo stile del resto del progetto?
   - Ci sono feature incomplete o half-baked?

3. Dopo aver letto tutto, produci un report con:

   ## A. RIEPILOGO COMPLETAMENTO
   Per ogni item in TODO.md, indica se è VERAMENTE completo (codice funzionante,
   non solo spuntato). Identifica eventuali TODO-item che il codice dichiara
   fatti ma in realtà non funzionano o sono incompleti.

   ## B. BUG CRITICI
   Elenca ogni bug che rompe funzionalità, crash, o comportamenti errati.
   Per ognuno: file, linea, descrizione, fix proposto.

   ## C. ANIMAZIONI MANCANTI o MIGLIORABILI
   Concentrati sulle animazioni — sono il cuore del voto.
   Per ogni animazione esistente, valuta qualità e completezza.
   Suggerisci nuove animazioni ad alto impatto seguendo la regola
   "no imported animations".

   ## D. QUALITÀ CODICE
   - Convenzioni di naming
   - Codice morto / commentato
   - Duplicazione
   - Error handling mancante
   - Magic numbers

   ## E. PERFORMANCE
   - Draw call count potenziale
   - Shadow map configuration
   - Eventuali memory leak
   - Texture budget

   ## F. GITHUB PAGES READINESS
   - Percorsi relativi vs assoluti
   - Asset loading
   - MIME types (.hdr, .glb)

   ## G. ORAL EXAM PREPARATION
   - Cosa l'esaminatore chiederà
   - Quali parti del codice mostrare nella demo
   - Quali domande tecniche aspettarsi (Frenet frame, PBR, raycasting,
     rendering equation, shadow maps, counter-rotation)

   ## H. CLASSIFICA PRIORITÀ
   Ordina tutti i suggerimenti per impatto sul voto (ALTO/MEDIO/BASSO)
   e stima ore di lavoro per ognuno.

4. Sii IMPLACABILE. Non essere gentile. Cerca ogni debolezza.
   Il voto massimo richiede perfezione — trova ogni singolo problema.

5. Alla fine, dai un VOTO STIMATO (in trentesimi) per lo stato attuale
   e UN VOTO POTENZIALE se tutti i fix venissero applicati.

```
