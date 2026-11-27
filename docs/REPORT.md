# Report: BREAK-OFF options added to mockups/sounds2/ (2026-11-27)

No change to the game, so no builds and no tests needed. The previous report (table sounds in the game, win + tap
options): docs/reports/2026-11-27-aa9f84f.md.

## What was added
A third row on http://192.168.1.111:5181/mockups/sounds2/: **3. Opponent's break-off**, options A/B/C. Each is a real
pool break recording: the cue ball hits the full pack, then the balls scatter. Same treatment as the other options
(trimmed, soft fade-out, same loudness, mono 96 kbps mp3). Later, in the game, the chosen one replaces the many small
ball-ball sounds on the opponent's break-off only.

| Option | Length | Source | Author | Licence | Part used |
|---|---|---|---|---|---|
| A | 1.8 s | https://freesound.org/people/reg7783/sounds/204187/ ("pool_break") | reg7783 | CC0 1.0 | 0.45-2.25 s |
| B | 1.7 s | https://freesound.org/people/LewisEmmott5/sounds/732672/ ("Pool Break") | LewisEmmott5 | CC0 1.0 | 0.25-1.95 s |
| C | 1.7 s | https://freesound.org/people/DariusOW/sounds/766411/ ("Pool Break") | DariusOW | CC0 1.0 | 0.05-1.75 s |

CC0 = public domain: commercial use allowed, no credit needed. Licence checked on each sound's own page. Nothing from
freesoundeffects.com. Freesound only: Kenney has no break sound, Mixkit was not searched. A fourth candidate
(RossJuterbock #543482) was left out: it has bar noise under it. Sources also in docs/ASSETS.md.

## Please note
- These are **pool** breaks (no snooker break-off with CC0 licence was found). A pool break is a harder hit with
  fewer balls, so it may sound a bit stronger than a snooker break-off.
- I cannot hear. I found the moment of the hit by measuring loudness. Your ears decide.

## Owner's turn
Pick A/B/C for WIN, TAP and BREAK-OFF on mockups/sounds2/; listen to the table sounds in the game.

Committed and pushed to origin/master (standing approval). Nothing published.
