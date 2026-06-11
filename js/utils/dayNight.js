// Shared day/night probe for scene modules.
//
// Every ride/prop used to call `group.parent?.parent?.getObjectByName('sun')`
// inside its tick — a full recursive traversal of the whole scene graph, per
// module, per frame (7 modules ≈ 7 scene walks every frame). This helper walks
// to the scene root ONCE per object, caches the sun light in a WeakMap, and
// from then on the night test is two property reads.
const sunCache = new WeakMap();

export function getSunFor(obj) {
  let sun = sunCache.get(obj);
  if (sun === undefined) {
    let root = obj;
    while (root.parent) root = root.parent;
    sun = root.getObjectByName('sun') || null;
    // Only cache once the object is actually attached to the scene (root has
    // children beyond itself); ticks always run after init, so this is cheap.
    if (sun) sunCache.set(obj, sun);
  }
  return sun;
}

// Same threshold every module used inline: the sun parked at its lowest point
// (DayNightCycle clamps y to ~4) or faded out counts as night.
export function isNightNow(obj) {
  const sun = getSunFor(obj);
  return sun ? (sun.position.y < 5.0 || sun.intensity < 0.5) : false;
}
