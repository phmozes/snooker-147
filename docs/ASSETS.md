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
## Sound options (PLAN 9.1 step 1, mockups/sounds/; the B picks are now in the game, see below)
All CC0 1.0 (public domain): commercial use allowed, no credit needed. Licence checked on each sound's own page
(Freesound) or in the pack's License.txt (Kenney) on 2026-11-27. Freesound files are the site's 128 kbps preview of
the original; trimmed and levelled by us (same loudness, mono 96 kbps mp3). Times = the part of the original we used.

| File | Source page | Author | Licence | Part used |
|---|---|---|---|---|
| cue-A | https://freesound.org/people/craigsmith/sounds/675330/ | craigsmith | CC0 1.0 | 7.21-7.60 s |
| cue-B | https://freesound.org/people/mccarthy@bedmas.com/sounds/42365/ | mccarthy@bedmas.com | CC0 1.0 | 0.29-0.66 s |
| cue-C | https://freesound.org/people/AmberdeMeillon/sounds/443067/ | AmberdeMeillon | CC0 1.0 | 5.05-5.42 s |
| ball-A-soft, ball-A-hard | https://freesound.org/people/DigPro120/sounds/531226/ | DigPro120 | CC0 1.0 | 0.23-0.45 s / 0.45-0.64 s |
| ball-B-soft, ball-B-hard | https://freesound.org/people/rvdw2004/sounds/709674/ | rvdw2004 | CC0 1.0 | 1.07-1.20 s / 0.50-0.78 s |
| ball-C-soft, ball-C-hard | https://freesound.org/people/Cymeon/sounds/245397/ | Cymeon | CC0 1.0 | 4.16-4.45 s / 1.68-1.90 s |
| pocket-A | https://freesound.org/people/Yarmonics/sounds/441857/ | Yarmonics | CC0 1.0 | whole |
| pocket-B | https://freesound.org/people/Caitlin_100/sounds/365525/ | Caitlin_100 | CC0 1.0 | 6.39-7.42 s |
| pocket-C | https://freesound.org/people/ChloePieterse/sounds/763601/ | ChloePieterse | CC0 1.0 | 9.44-10.90 s |
| cushion-A | https://freesound.org/people/mccarthy@bedmas.com/sounds/42364/ | mccarthy@bedmas.com | CC0 1.0 | 0.37 s-end |
| cushion-B | https://kenney.nl/assets/impact-sounds (impactSoft_medium_000) | Kenney | CC0 1.0 | whole |
| cushion-C | https://kenney.nl/assets/impact-sounds (impactSoft_heavy_001) | Kenney | CC0 1.0 | whole |
| win-A | https://freesound.org/people/Qvantor/sounds/878618/ | Qvantor | CC0 1.0 | whole |
| win-B | https://freesound.org/people/Zott820/sounds/209578/ | Zott820 | CC0 1.0 | whole |
| win-C | https://freesound.org/people/steaq/sounds/387232/ | steaq | CC0 1.0 | whole |
| tap-A | https://kenney.nl/assets/interface-sounds (click_001) | Kenney | CC0 1.0 | whole |
| tap-B | https://kenney.nl/assets/ui-audio (click1) | Kenney | CC0 1.0 | whole |
| tap-C | https://kenney.nl/assets/interface-sounds (select_001) | Kenney | CC0 1.0 | whole |

Tools (development only, not in the game, not in the repo): ffmpeg 9 (via the pip package imageio-ffmpeg, LGPL/GPL
binary) and numpy, in a temporary folder, for trimming, levelling and mp3 encoding.

## Sounds in the game (PLAN 9.1/9.2, public/sounds/; owner's picks 2026-11-27: B for cue, ball-ball, pocket, cushion; round 2: WIN A, TAP B, BREAK-OFF C)
The same files as the B options above (copied unchanged from mockups/sounds/). All CC0 1.0: commercial use, no credit.

| File in public/sounds/ | Copy of | Source page | Author | Licence |
|---|---|---|---|---|
| cue.mp3 | cue-B | https://freesound.org/people/mccarthy@bedmas.com/sounds/42365/ | mccarthy@bedmas.com | CC0 1.0 |
| ball-soft.mp3, ball-hard.mp3 | ball-B-soft, ball-B-hard | https://freesound.org/people/rvdw2004/sounds/709674/ | rvdw2004 | CC0 1.0 |
| pocket.mp3 | pocket-B | https://freesound.org/people/Caitlin_100/sounds/365525/ | Caitlin_100 | CC0 1.0 |
| cushion.mp3 | cushion-B | https://kenney.nl/assets/impact-sounds (impactSoft_medium_000) | Kenney | CC0 1.0 |
| break.mp3 | break-C (round 2, owner's pick) | https://freesound.org/people/DariusOW/sounds/766411/ | DariusOW | CC0 1.0 |
| win.mp3 | win-A (round 2, owner's pick, crowd applause) | https://freesound.org/people/miuziqa/sounds/858309/ | miuziqa | CC0 1.0 |
| tap.mp3 | tap-B (round 2, owner's pick) | https://freesound.org/people/NenadSimic/sounds/268108/ | NenadSimic | CC0 1.0 |

Played with the browser's own Web Audio (no library, so nothing to licence).

## Sound options round 2 (mockups/sounds2/; picks WIN A, TAP B, BREAK-OFF C are in the game, see above)
Win A/B/C and tap A/B/C were rejected in round 1. New options, all from Freesound, CC0 1.0 only (licence checked on
each sound's own page on 2026-11-27). Not used: freesoundeffects.com (its free sounds are non-commercial only).
Same treatment as round 1: the site's 128 kbps preview, trimmed, faded out, levelled (loudest 50 ms = -18 dB), mono 96 kbps.

| File | Source page | Author | Licence | Part used |
|---|---|---|---|---|
| win-A (applause) | https://freesound.org/people/miuziqa/sounds/858309/ | miuziqa | CC0 1.0 | 0.30-2.50 s, 0.7 s fade-out |
| win-B (applause) | https://freesound.org/people/hz37/sounds/792298/ | hz37 | CC0 1.0 | 0.10-2.30 s, 0.8 s fade-out |
| win-C (chime) | https://freesound.org/people/arseniiv/sounds/614833/ | arseniiv | CC0 1.0 | whole (1.38 s) |
| tap-A | https://freesound.org/people/Jummit/sounds/528561/ | Jummit | CC0 1.0 | 0-0.08 s |
| tap-B | https://freesound.org/people/NenadSimic/sounds/268108/ | NenadSimic | CC0 1.0 | 0-0.08 s |
| tap-C | https://freesound.org/people/SignatureSoundsOrg/sounds/876010/ | SignatureSoundsOrg | CC0 1.0 | 0-0.25 s, 0.15 s fade-out |
| break-A (break-off) | https://freesound.org/people/reg7783/sounds/204187/ | reg7783 | CC0 1.0 | 0.45-2.25 s, 0.5 s fade-out |
| break-B (break-off) | https://freesound.org/people/LewisEmmott5/sounds/732672/ | LewisEmmott5 | CC0 1.0 | 0.25-1.95 s, 0.5 s fade-out |
| break-C (break-off) | https://freesound.org/people/DariusOW/sounds/766411/ | DariusOW | CC0 1.0 | 0.05-1.75 s, 0.4 s fade-out |

## Applause levels options (mockups/applause/; options page only, not in the game yet)
Owner 2026-11-27: 6 applause levels, 2 options each. All from Freesound, CC0 1.0 only (licence checked on each sound's
own page on 2026-11-27). Same treatment as before (site's 128 kbps preview, trimmed, 30 ms fade-in, fade-out over the
last 35% (at least 0.5 s), mono 96 kbps), but NOT levelled the same: average loudness rises 3 dB a level
(level 1 = -30 dB ... level 6 = -15 dB RMS; soft limit at -1 dB).

| File | Level | Source page | Author | Licence | Part used | Length |
|---|---|---|---|---|---|---|
| 1-A | CASH OUT | https://freesound.org/people/Breviceps/sounds/462362/ | Breviceps | CC0 1.0 | 0.40-1.90 s | 1.5 s |
| 1-B | CASH OUT | https://freesound.org/people/jodybruchon/sounds/433880/ | jodybruchon | CC0 1.0 | 0.45-1.95 s | 1.5 s |
| 2-A | 50 break | https://freesound.org/people/miuziqa/sounds/858309/ | miuziqa | CC0 1.0 | 0.30-2.50 s (= current win.mp3) | 2.2 s |
| 2-B | 50 break | https://freesound.org/people/bowlingballout/sounds/481646/ | bowlingballout | CC0 1.0 | 0.30-2.50 s | 2.2 s |
| 3-A | needs snookers | https://freesound.org/people/ElevatorFan2020/sounds/859009/ | ElevatorFan2020 | CC0 1.0 | 0.25-3.25 s | 3.0 s |
| 3-B | needs snookers | https://freesound.org/people/AudioSea/sounds/583130/ | AudioSea | CC0 1.0 | 0.60-3.60 s | 3.0 s |
| 4-A | 100 break | https://freesound.org/people/3to1video/sounds/845594/ | 3to1video | CC0 1.0 | 0.60-4.60 s | 4.0 s |
| 4-B | 100 break | https://freesound.org/people/AlaskaRobotics/sounds/221567/ | AlaskaRobotics | CC0 1.0 | 0.25-4.05 s | 3.8 s |
| 5-A | clearance | https://freesound.org/people/AlaskaRobotics/sounds/221568/ | AlaskaRobotics | CC0 1.0 | 1.00-5.50 s | 4.5 s |
| 5-B | clearance | https://freesound.org/people/mglennsound/sounds/678543/ | mglennsound | CC0 1.0 | 11.50-16.50 s | 5.0 s |
| 6-A | MAXIMUM | https://freesound.org/people/kyles/sounds/455660/ | kyles | CC0 1.0 | 6.50-12.50 s | 6.0 s |
| 6-B | MAXIMUM | https://freesound.org/people/FoolBoyMedia/sounds/397434/ | FoolBoyMedia | CC0 1.0 | 1.50-7.50 s | 6.0 s |
