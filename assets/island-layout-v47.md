# Island layout artwork v47

Asset: `island-building-swap-v47.png` (transparent PNG).
Generated with the built-in image generation tool, using the existing isolated island illustration as the visual reference.
Generation output: `01a13e37-efbe-7913-97f9-3a095a6fb9bc/exec-c5fff360-c03f-438c-bdff-bab42a350c8d.png`.

Design specification supplied to generation: preserve the original isometric floating island, warm brick and wood materials, trees, terraces, stairs, waterfalls, camera angle and transparent background. Keep the top design clocktower unchanged. Place the verification studio with PCB test equipment and PASS monitors on the upper-right terrace, the glass-domed simulation laboratory on the middle-left terrace, and the manufacturing workshop on the lower-right terrace. Match the original footprints and connect all entrances to the existing walkways. Do not add text labels or people.

Only the three building regions are composited over the existing island in `life.js`; the original roads, clocktower, cliffs and other detail remain the game base. Clip contours live in `outlines.js`. Room identity, entrance and PPT routing are updated together in `game.js`.

Final route: design -> verification -> simulation -> manufacturing.

## Workshop selection v48

The user selected the workshop from the earlier built-in generation output `exec-80759340-492a-47dc-8bf9-7667dc562850.png`. Reuse that exact existing artwork from `island-workshop-reference-v48.png` for the lower-right manufacturing workshop; do not regenerate it. Composite at the original island coordinates, preserve the two PCB assembly tables and wooden gable, and align the click outline and doorway to this version. Other buildings retain the v47 arrangement.
