### Summary of Completed Work
  
1. Lightweight Decoupled EventBus: Created EventBus.js to publish input/time updates.
2. Unified InteractionManager: Created InteractionManager.js with 50ms throttled hover raycasting, cursor updates, scroll speed control, and touch support.
3. Decoupled Rides: Refactored FerrisWheel.js, Carousel.js, and Tagada.js to use EventBus events, support speed multipliers (clamped  0.2  to  3.0 ), reset speed to  1.0  on stop,
and removed local raycasting.
4. Lamppost Tweens: Updated Lampposts.js with 0.8s transition easing, manual toggle overrides, and automatic schedule reset hooks when DayNightCycle.js emits time phase changes.          
5. HUD HTML Control & Space Key: Enhanced index.html with color picker, auto-time checkbox, and keyboard shortcut info overlay. Wired in main.js.
6. Task Check: Updated TODO.md to check off interactions.

### Fix Details
  
1. Zoom Intercepted: Registered  wheel  event in the capture phase inside InteractionManager.js. Hovering and scrolling over a ride now halts event propagation ( stopPropagation  +  
stopImmediatePropagation ), preventing OrbitControls zoom.
2. Speed Clamp Adjusted: Clamped maximum  speedMultiplier  to  1.5  in main.js to avoid physics-breaking speeds.
3. Ride Color Picker Feedback:
    • Added 4 dynamic PointLight objects to FerrisWheel.js, Carousel.js, and Tagada.js.
    • PointLights pulse dynamically alongside emissive bulbs at night and turn off during the day.
    • Connected all PointLights to the color-picker event.
    • Fixed initialization race condition: Initial color state is now emitted at the end of the  init()  sequence in main.js after all asynchronous asset loaders have completed.