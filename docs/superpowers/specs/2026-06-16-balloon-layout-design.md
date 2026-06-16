# Balloon Layout — Sciolto ma Vicino

**Date:** 2026-06-16
**Status:** Approved
**Scope:** `src/rides/Balloon.js` only

## Problem

The 3 hot air balloons spawn at distances 30, 60, 90 from the park center (computed via `((index * 7.3) % 1) * SPAWN_RADIUS`). The third balloon ends up at ~90m, outside the typical camera view, so only 1–2 balloons appear above the park at a time.

## Goal

All 3 balloons should be visible above the park, in a "loose but close" arrangement — distinct positions, none too far from center.

## Design

Replace the random distance/height/angle formula with fixed per-index values that keep every balloon within ~35m of center and 65–70m altitude.

| Index | Angle (rad) | Distance (m) | Base Y (m) |
|-------|-------------|--------------|------------|
| 1     | 0.52        | 22           | 66         |
| 2     | 2.62        | 35           | 70         |
| 3     | 4.45        | 28           | 68         |

### Implementation

In `src/rides/Balloon.js` (lines 48–53), replace the deterministic-seed-based computation with three literal `const` lookup tables indexed by `i - 1` (since the loop is `for (let i = 1; i <= 3; i++)`):

```js
const ANGLES  = [0.52, 2.62, 4.45];
const DISTANCES = [22, 35, 28];
const HEIGHTS  = [66, 70, 68];

const idx = index - 1;
const angle = ANGLES[idx];
const dist  = DISTANCES[idx];
const baseY = HEIGHTS[idx];
```

The `deterministicSeed` helper becomes unused — remove it. The `SPAWN_RADIUS`, `SPAWN_Y_MIN`, `SPAWN_Y_MAX` constants become unused — remove them.

### What does NOT change

- `buildOneBalloon` signature and GLB scaling/centering logic
- The point light on each balloon
- The drift tick (`b.userData.tick`) — drift, sin oscillation, rotation
- The 70m "stay within" bound (line 77) — still valid since max initial distance is 35
- `buildBalloon` orchestration, the `rideId`/`rideName` userData on balloon[0]

## Verification

1. Reload the scene on `localhost:8080`.
2. Confirm 3 balloons are visible above the park in the default view.
3. Wait ~30s and confirm drift does not push any balloon out of view.
4. Confirm no regressions on coaster / carousel / ferris wheel (untouched files).
