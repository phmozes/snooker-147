# STATUS: PLAN.md stages 8-11 (checked against the code, 2026-11-27)
## Stage 8 - Messages, score, cameras
- 8.1 PARTLY. Done: "BREAK n" (left of the status line under the table, not in the top bar; gamePage breakHtml).
  Missing: the 10 messages with priority (only listed in config `messages.priority`, no code shows them); frame-ball marks on the colour buttons.
- 8.2 NOT STARTED. Six pocket cameras and `slowMotionScale` / `clearanceFinale` exist only as config numbers; no code
  uses them (no camera cuts, no slow-motion clearance replay).
- 8.3 PARTLY. Done: clearance message on the cloth, at most 3 s, tap to skip, text "MAXIMUM n" or "TOTAL CLEARANCE n"
  (gamePage clearanceMessage, roundView). Missing: separate MAXIMUM 75/107/147 moments; a FLUKE message (a fluke is
  only detected as a shot type in core/shotType.ts and shown as a developer label).

## Stage 9 - Sound
- 9.1 NOT STARTED. No sound files, no Howler (not in package.json), no table sounds.
- 9.2 PARTLY. Done: mute button in the top bar, remembered on the device (game/sound.ts). Missing: UI sounds, the
  14 voice slots wired to messages.

## Stage 10 - Visual polish, crowd, announcer
- 10.1 DONE. Look A "club": cloth, rail wood with grain, T1 pockets (leather, net), lights and ball shading
  (view/tableLook.ts, table3d.ts). Also the table markings and camera 57° (see below).
- 10.2 PARTLY. Done: phone layout (top bar, ladder strip, bottom area of fixed height, short-screen layout), balance
  count-up. Missing: no check yet that it matches the mockups exactly; no strip animation.
- 10.3 NOT STARTED. No crowd sounds or reactions.
- 10.4 NOT STARTED. No announcer files (owner supplies them); final balancing not done.

## Stage 11 - Later
- History strip of last rounds: NOT STARTED.
- Turbo mode: NOT STARTED (owner 2026-11-27: no playback speed-up; view/fastEnd.ts exists but is switched off).
- Landscape/desktop layout: PARTLY. A wide window (PC) shows a phone-shaped screen; no real landscape layout.
- DEMO label: DONE (footer "147 · DEMO · Round <code> · <clock>").

## Built but NOT in PLAN.md
- The cue (C1): drawn on every shot along the shot line, rises over cushions/balls (view/cue.ts); extra 0.25 s per shot.
- Break-off played with the cue, cue ball on the baulk line; the game waits and SHOOT plays step 1 (round version v3).
- Table markings: baulk line, D and the six colour spots, thin and subtle.
- Round codes (v1/v2/v3) and free replay of a round by its code (no bet, no pay, REPLAY label) - developer menu only.
- Outcome generator v2/v3 with HMAC-SHA256 (docs/FAIRNESS.md); break libraries (public/breaks, breaks-v3).
- Next shot solved ahead in a Web Worker while the player decides; RE-RACK fallback.
- Rules page (footer "Rules"); level balls 6/10/15 in the top bar; short-screen layout; camera 57° (in-app 91% wide).
- Developer tools: test panel, weird-shot flag + PC posting, phone cost log, /replay.html and /debug.html check pages.
- Static production build (relative paths, developer parts compiled out); hosted demo artifact.
