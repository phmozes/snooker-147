# Assets and libraries (free, commercial use allowed)

| What | Version | Licence | Source | Used for |
|---|---|---|---|---|
| Three.js | 0.187.0 | MIT | https://threejs.org (npm `three`) | 3D table view (from task 2.1) |
| @types/three | 0.187.0 | MIT | npm `@types/three` | TypeScript types for Three.js (development only) |
| puppeteer-core | 23.11 | Apache-2.0 | npm `puppeteer-core` | Development only (night 4): screenshots and frame-time checks with the installed Chrome (scripts/). Not in the game. |
| SHA-256 / HMAC-SHA256 | own code | (ours) | src/core/sha256.ts, written from FIPS 180-4 / RFC 2104 | Outcome generator v2 (docs/FAIRNESS.md). No library. |

## Look options page (night 3, docs/look-options.html; not used by the game)
No image, model or font files. Cloth, wood grain and the lamp vignette are drawn in code (canvas noise) at page load,
so there is nothing to licence. The page uses only Three.js (MIT, above) and the game's own table geometry and camera.

## Table look (night 4: src/view/tableLook.ts, used by the game AND docs/pocket-options.html)
No image, model or font files. Cloth, wood, leather and the pocket net are drawn in code (canvas textures at load).