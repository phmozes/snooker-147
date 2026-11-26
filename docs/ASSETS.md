# Assets and libraries (free, commercial use allowed)

| What | Version | Licence | Source | Used for |
|---|---|---|---|---|
| Three.js | 0.187.0 | MIT | https://threejs.org (npm `three`) | 3D table view (from task 2.1) |
| @types/three | 0.187.0 | MIT | npm `@types/three` | TypeScript types for Three.js (development only) |

## Look options page (night 3, docs/look-options.html; not used by the game)
No image, model or font files. Cloth, wood grain and the lamp vignette are drawn in code (canvas noise) at page load,
so there is nothing to licence. The page uses only Three.js (MIT, above) and the game's own table geometry and camera.

## Pocket options page (docs/pocket-options.html; not used by the game)
No image, model or font files. Cloth, wood, net and leather are drawn in code. Brass reflections use Three.js's own
`RoomEnvironment` (three/addons, part of the MIT package above): a room generated in code, no image file.
