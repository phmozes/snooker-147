# Report: table sounds in the game + sound options round 2 (PLAN 9.1, 2026-11-27)

## Part 1: the 4 picked table sounds are in the game
Your picks: cue B, ball-ball B, pocket B, cushion B. Files in `public/sounds/` (cue, ball-soft, ball-hard, cushion,
pocket; 26 KB together), copied unchanged from mockups/sounds/.

- **New file `src/game/tableSounds.ts`.** It plays the sounds from the shot recording's events: the cue strike (when
  the cue tip reaches the cue ball), every ball-ball hit, every cushion hit (pocket jaws use the cushion sound too),
  every ball that drops. It only reads the recording; it never changes it.
- **When:** the playback clock decides. Each screen frame plays the events between the last moment shown and the
  moment shown now. So in the **pocket-camera cut** and the **clearance replay** (slow motion) the sounds come later,
  exactly when the balls touch on screen. The sound itself keeps its normal pitch.
- **Phones:** nothing loads or plays before the first tap anywhere on the page. That tap switches sound on and loads
  the 5 files.
- **Mute:** the existing mute button (remembered on the device). Turning it on also stops sounds that are playing.
- **Overlap:** at most 6 sounds at the same time (a break has many hits at once; extra ones are left out). The same
  two balls (or ball + cushion) sound at most once in 25 ms, so one contact is never heard twice.
- No library (PLAN said Howler): the browser's own Web Audio is enough, so there is nothing extra to licence.

### How the volume scales (all numbers in `src/config/game.config.ts`, `sound.tableHits`)
Impact speed s (m/s). Below `min` the hit is **silent**. Above it:
volume = floor + (1 - floor) x ((s - min) / (max - min)) ^ 0.6, at most 1, then x master volume 0.8.

| Sound | Speed used | Silent below | Full at | Quietest heard |
|---|---|---|---|---|
| Cue strike | the shot's cue speed | 0.05 | 6.0 (hardest shot) | 25% |
| Ball hits ball | closing speed of the two balls | 0.08 | 4.0 | 10% |
| Cushion / jaw | speed into the cushion | 0.12 | 3.5 | 10% |
| Pocket drop | ball speed just before it drops | (always heard) | 2.5 | 45% |

Ball hits ball uses the **soft** file below 1.2 m/s and the **hard** file from 1.2 m/s. The power 0.6 means soft hits
stay audible and hard hits do not get much louder. These are first guesses: tell me "too loud / too quiet" for any
sound and I change one number.

## Part 2: new options page `mockups/sounds2/` (phone: http://192.168.1.111:5181/mockups/sounds2/)
Same format as round 1. All from Freesound, **CC0 1.0** only, licence checked on each sound's own page. No sound
from freesoundeffects.com. This round I searched Freesound only (Kenney's clicks were round 1; Mixkit not searched).

| Option | What | Length | Source | Author | Licence |
|---|---|---|---|---|---|
| WIN A | small crowd applause | 2.2 s | Freesound #858309 | miuziqa | CC0 1.0 |
| WIN B | small indoor crowd applause | 2.2 s | Freesound #792298 | hz37 | CC0 1.0 |
| WIN C | soft crystal bell chime | 1.4 s | Freesound #614833 | arseniiv | CC0 1.0 |
| TAP A | "Soft UI Button Click" | 0.08 s | Freesound #528561 | Jummit | CC0 1.0 |
| TAP B | "Button Tick" | 0.08 s | Freesound #268108 | NenadSimic | CC0 1.0 |
| TAP C | "Starry UI Click 63" (short part) | 0.25 s | Freesound #876010 | SignatureSoundsOrg | CC0 1.0 |

Full sources and the trimmed parts: docs/ASSETS.md. Again: I cannot hear. I picked the parts by measuring loudness,
so the applause was cut to 2.2 s with a soft fade-out; your ears decide.

## Checks
- **Replay check** (bench/camera-replay.test.ts, 10 round codes, every outcome and every ball path frame by frame):
  before and after are **identical** (bench/results/sounds/replay-before.txt = replay-after.txt).
- **npm test: 308 / 308 passed** (30 files). New: tests/tableSounds.test.ts (soft touches silent, louder with speed,
  never above 1; only the game page uses the sound code and it takes nothing from the core but types; files exist).
- **Live check** (new scripts/sound-check.mjs, headless Chrome, phone size): no sound before the first tap (0); after
  the tap step 1 played sounds; with mute on a whole break-off played with 0 sounds; no page errors.
  It counts sounds started; it cannot judge how they sound.

## Soak failures
No soak ran (sound only, outcomes proven unchanged by the replay check). Nothing new to list.

## Build files
`npm run build` (production, dist/):
| File | Size |
|---|---|
| index.html | 10.6 KB |
| assets/index-SOeE9r0i.js | 678.5 KB |
| assets/solverWorker-CIEVpTZV.js | 48.6 KB |
| sounds/ball-hard.mp3 | 4.0 KB |
| sounds/ball-soft.mp3 | 2.4 KB |
| sounds/cue.mp3 | 4.9 KB |
| sounds/cushion.mp3 | 2.1 KB |
| sounds/pocket.mp3 | 12.9 KB |
| breaks/reds6.json, reds10.json, reds15.json | 478.4 / 575.3 / 696.0 KB |
| breaks-v3/reds6.json, reds10.json, reds15.json | 477.4 / 576.0 / 696.2 KB |

`npm run build:test` (dist-test/: developer menu, no PC posting): the same files, except
| index.html | 10.8 KB |
|---|---|
| assets/index-BxWcdQDD.js | 691.8 KB |

## Tools
ffmpeg 9 (pip package imageio-ffmpeg) and numpy, installed in the user Python (development only, not in the game or
repo), for trimming and levelling the round-2 files.

## Owner's turn
1. Listen to the table sounds in the game on the phone (tap once first). Say if any is too loud, too quiet or wrong.
2. Pick A/B/C for WIN and TAP on mockups/sounds2/.
3. The hosted demo is not republished (your word).

Committed and pushed to origin/master (standing approval). Nothing published.
