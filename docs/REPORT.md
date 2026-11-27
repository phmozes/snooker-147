# Report: sound options page (PLAN 9.1 step 1, 2026-11-27)

No change to the game. No builds (as asked).

## What was done
- 18 sounds found, 3 options (A/B/C) for each of the 6 sounds. Ball-hits-ball has a soft and a hard version per
  option, so 21 sound files in total. Every one is **CC0 1.0** (public domain): commercial use allowed, no credit needed.
- Sources: Freesound (13 sounds, licence checked on each sound's own page) and Kenney packs (5 sounds, licence in the
  pack's License.txt). Mixkit and OpenGameArt had no usable pool/snooker sounds.
- Each file was trimmed (silence cut, short fade-out), set to the same loudness (loudest 50 ms = -18 dB, all within
  0.2 dB; a gentle limiter stops sharp clicks from clipping), and saved as mono 96 kbps mp3. Largest file 35.2 KB.
- docs/ASSETS.md: new section "Sound options" with source page, author, licence and the part of the original used.
- mockups/sounds/index.html: one row per sound, big A/B/C buttons (ball row: soft + hard buttons), licence under each.
  Relative paths, no external requests, a sound loads and plays only when its button is tapped.

## Please note
- I cannot hear sounds. I picked the parts of each recording by measuring where the hits are, not by listening.
  Some picks may be wrong (for example a second ball or noise in the clip). Your listening test decides.
- Freesound files are the site's 128 kbps preview copy (downloading the original needs a login). For short game
  sounds this is fine; if you pick one, I can get the original later with your Freesound login.
- In the game, soft table hits will also be played quieter (PLAN 9.1: sound scaled by impact).

## Files (mockups/sounds/)
| File | Size (bytes) | Length | Source | Author | Licence |
|---|---|---|---|---|---|
| index.html | 6072 | - | (ours) | - | - |
| cue-A.mp3 | 5642 | 0.39 s | freesound.org/people/craigsmith/sounds/675330/ | craigsmith | CC0 1.0 |
| cue-B.mp3 | 5015 | 0.36 s | freesound.org/people/mccarthy@bedmas.com/sounds/42365/ | mccarthy@bedmas.com | CC0 1.0 |
| cue-C.mp3 | 5015 | 0.36 s | freesound.org/people/AmberdeMeillon/sounds/443067/ | AmberdeMeillon | CC0 1.0 |
| ball-A-soft.mp3 | 3448 | 0.22 s | freesound.org/people/DigPro120/sounds/531226/ | DigPro120 | CC0 1.0 |
| ball-A-hard.mp3 | 3134 | 0.19 s | freesound.org/people/DigPro120/sounds/531226/ | DigPro120 | CC0 1.0 |
| ball-B-soft.mp3 | 2507 | 0.14 s | freesound.org/people/rvdw2004/sounds/709674/ | rvdw2004 | CC0 1.0 |
| ball-B-hard.mp3 | 4075 | 0.29 s | freesound.org/people/rvdw2004/sounds/709674/ | rvdw2004 | CC0 1.0 |
| ball-C-soft.mp3 | 4075 | 0.29 s | freesound.org/people/Cymeon/sounds/245397/ | Cymeon | CC0 1.0 |
| ball-C-hard.mp3 | 3448 | 0.22 s | freesound.org/people/Cymeon/sounds/245397/ | Cymeon | CC0 1.0 |
| pocket-A.mp3 | 8777 | 0.68 s | freesound.org/people/Yarmonics/sounds/441857/ | Yarmonics | CC0 1.0 |
| pocket-B.mp3 | 13165 | 1.03 s | freesound.org/people/Caitlin_100/sounds/365525/ | Caitlin_100 | CC0 1.0 |
| pocket-C.mp3 | 18181 | 1.46 s | freesound.org/people/ChloePieterse/sounds/763601/ | ChloePieterse | CC0 1.0 |
| cushion-A.mp3 | 5329 | 0.37 s | freesound.org/people/mccarthy@bedmas.com/sounds/42364/ | mccarthy@bedmas.com | CC0 1.0 |
| cushion-B.mp3 | 2194 | 0.12 s | kenney.nl/assets/impact-sounds (impactSoft_medium_000) | Kenney | CC0 1.0 |
| cushion-C.mp3 | 7523 | 0.57 s | kenney.nl/assets/impact-sounds (impactSoft_heavy_001) | Kenney | CC0 1.0 |
| win-A.mp3 | 31346 | 2.56 s | freesound.org/people/Qvantor/sounds/878618/ | Qvantor | CC0 1.0 |
| win-B.mp3 | 22569 | 1.83 s | freesound.org/people/Zott820/sounds/209578/ | Zott820 | CC0 1.0 |
| win-C.mp3 | 36049 | 2.94 s | freesound.org/people/steaq/sounds/387232/ | steaq | CC0 1.0 |
| tap-A.mp3 | 1253 | 0.04 s | kenney.nl/assets/interface-sounds (click_001) | Kenney | CC0 1.0 |
| tap-B.mp3 | 1880 | 0.09 s | kenney.nl/assets/ui-audio (click1) | Kenney | CC0 1.0 |
| tap-C.mp3 | 1253 | 0.04 s | kenney.nl/assets/interface-sounds (select_001) | Kenney | CC0 1.0 |

Total: 22 files, about 187 KB.

## Owner's turn
Open mockups/sounds/index.html on the phone (dev server: http://192.168.1.111:5181/mockups/sounds/ when it is
running) and pick A, B or C for each of the 6 sounds.
