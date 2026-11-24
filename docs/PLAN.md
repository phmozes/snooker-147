# 147 - Staged build plan

Each task is about 2 hours and ends with a stop for the owner's review of ONE visible thing.
Estimates are working time; total is about 60 hours (32 tasks) before stage 11.

## Architecture (one idea that makes everything easier)
- `src/core/` = pure TypeScript, no rendering: `physics/`, `rules/`, `solver/`, `round/` (game loop state machine), `rng/`.
- The solver simulates a shot headlessly and RECORDS the trajectory (positions every frame + events: hits, cushions, pots).
  The renderer only PLAYS BACK that recording. There is no live physics on screen. This gives determinism, seed replay,
  slow motion and pocket-camera replays for free.
- Solver runs in a Web Worker and solves the next shot (success AND failure versions, every offered colour) while the
  player is still deciding, so SHOOT starts instantly.
- `src/view/` = Three.js scene + HTML/CSS UI from the mockups. `src/config/game.config.ts` = all numbers.

## Stage 0 - Setup (1 task)
| # | Task | Est. | Review |
|---|------|------|--------|
| 0.1 | Vite + TS + Vitest, git, config file, ladder calculator, tests (fixtures, p strictly decreasing, RTP 96.1-97.0 at every step) | 2h | Test output |

## Stage 1 - Physics without graphics (4 tasks)
| 1.1 | Table geometry: cushions, pocket mouths with angled jaws, spots, rack layouts for 6/10/15 reds | 2h | 2D debug drawing (plain canvas) |
| 1.2 | Ball motion, fixed timestep, friction, cushions, ball-ball collisions; tests: no overlap, never off table, same input = same output | 2h | 2D debug: shots you can click |
| 1.3 | Pockets (capture, jaw bounce = rattles), simple follow/screw spin, trajectory recording + events | 2h | 2D debug: rattles, in-offs |
| 1.4 | Speed benchmark (target < 1 ms per simulated shot) and friction tuning to 1.0-1.5 s shots | 2h | Benchmark numbers |

## Stage 2 - Gray-box table (2 tasks)
| 2.1 | Three.js scene: plain green table, plain spheres, main camera from config, playback of a recording | 2h | Phone screen |
| 2.2 | Portrait page layout from mockups A/C/D with static buttons (no logic yet) | 2h | Phone screen |

## Stage 3 - Snooker rules (2 tasks)
| 3.1 | Rules state: red/colour order, re-spotting, final colour sequence, fouls, "success = only the target ball potted" | 2h | Tests |
| 3.2 | Score, points remaining, "opponent needs snookers", maximum tracking | 1.5h | Tests |

## Stage 4 - Shot solver, outcome first (6 tasks)
| 4.1 | Success shots: ghost-ball aim per ball x pocket, lowest power that pots in time, validation by simulation | 2h | 2D debug: 20 random layouts solved |
| 4.2 | Failure shots: plain miss, jaw rattle, in-off, wrong ball first; step-1 snookered escape | 2h | 2D debug per type |
| 4.3 | Position play + 1-step look-ahead: after a red, black + 1 more colour pottable | 2h | Stats: % layouts with black on |
| 4.4 | Difficulty score and per-step target range (A); variety: red, pocket, special shots (E) | 2h | Side-by-side early vs late shots |
| 4.5 | Flex chain (longer time, other pocket, other red, wide search, fallback) + fallback log (C); Web Worker + pre-solve | 2h | Log + timing |
| 4.6 | Offline break-off library generator (2 kinds x 200 per level), saved to JSON | 2h | Browse 10 breaks |

## Stage 5 - Game loop, 6 reds (5 tasks)
| 5.1 | Round state machine (headless): bet, START, break, auto step 1, SHOOT/CASH OUT, end; balance; seeded outcomes | 2h | Tests |
| 5.2 | Connect to the UI: bet row, quick bets, START, ladder strip, CASH OUT amount, next label, results in strip | 2h | Play a round on the phone |
| 5.3 | Developer test panel (B): force success/fail, failure type, jump to step, level, messages, clearance/maximum, cameras, replay last shot | 2h | The panel |
| 5.4 | Replay by round code (D): code + in-game rules text in the menu; RE-RACK end; enter code in panel -> same round | 2h | Send a code, get the same round |
| 5.5 | Soak test (C): thousands of headless rounds; fails on stuck solver, ball off table/overlap, RTP out of range | 2h | Soak report |

## Stage 6 - 10 and 15 reds (2 tasks)
| 6.1 | 10 and 15 reds racks, break libraries, level picker in the top bar (remembered, only between rounds) | 2h | Play each level |
| 6.2 | Solver tuning for the crowded 15-red pack + soak for all levels | 2h | Soak report |

## Stage 7 - Colour choice (1 task)
| 7.1 | 2-3 colour buttons (black always), each pre-solved; replaces SHOOT on colour steps | 2h | Mockup C on the phone |

## Stage 8 - Messages, score, cameras (3 tasks)
| 8.1 | BREAK in the top bar, 10 messages with priority, frame-ball marks on colour buttons | 2h | Panel triggers each message |
| 8.2 | Pocket cameras: cut on ~40% of rattles AND the matching share of successful pots (test: cut never reveals result); clearance finale replay in slow motion | 2h | Panel triggers both |
| 8.3 | Clearance message on the empty cloth (tap to skip), MAXIMUM 75/107/147, FLUKE detection | 1.5h | Panel |

## Stage 9 - Sound (2 tasks)
| 9.1 | Find free sounds (commercial licence), docs/ASSETS.md, Howler, table sounds scaled by impact | 2h | Listen |
| 9.2 | UI sounds, mute button (remembered), 14 empty voice slots wired to messages | 1.5h | Listen |

## Stage 10 - Visual polish, crowd, announcer (4 tasks)
| 10.1 | Table look: cloth texture, wood, cushions, lights, ball shading | 2h | Phone screen |
| 10.2 | UI polish to match the mockups exactly, animations of strip/balance | 2h | Phone screen |
| 10.3 | Crowd reactions on big moments | 1.5h | Listen |
| 10.4 | Announcer voice files (owner supplies) + final balancing | 1.5h | Listen |

## Stage 11 - Later (planned, not built now)
History strip of last rounds, turbo mode (skip animations; easy thanks to recordings), landscape/desktop layout, DEMO label.

---

## Honest feedback - risks and what I would simplify

1. **Shot solver under the time limit (HIGH risk, but solvable).** One simulated shot should take ~0.5-1 ms, so 150 ms
   = ~150-300 candidates. Fix: solve the NEXT shot in a Web Worker while the player is still deciding. The player never waits.
2. **Keeping black always pottable (HIGH risk).** It is not a property of the colour shot; it must be guaranteed by the
   RED shot before it (the cue ball end position). So the red-shot solver uses a 1-step look-ahead: it only accepts a pot
   that leaves black + one more colour pottable. This multiplies solver cost; measured in task 4.3.
3. **"Pre-validated fallback shot" (cannot be universal).** In a random layout there is no shot that is guaranteed in
   advance. The real protection is the look-ahead (never leave a layout where the next success is impossible) plus a
   wide search. The soak test will show how often the fallback is needed; target 0 stuck in 100,000 shots.
4. **Measured RTP in the soak test (needs a change).** With x100 top prizes, a few thousand rounds give a very noisy RTP;
   the test would fail by chance. Proposal: (a) RTP checked exactly by formula + 2 million fast RNG-only rounds;
   (b) the physics soak checks that the real success rate per step matches p(step) and that the solver never got stuck.
5. **Replay by seed needs the player's choices.** A seed fixes the break and every outcome, but not when the player
   cashed out or which colours were picked. Proposal: a short round code like `48213-BPBK` (seed + colour letters).
6. **Shot length 1.0-1.5 s.** Real snooker balls roll for 2-4 s. We get 1.0-1.5 s with slightly higher cloth friction
   and the lowest power that works; `playbackTimeScale` is a backup knob.
7. **15-red pack.** After a real break the reds stay clustered, so pottable reds are rare. The break library will only
   keep breaks with at least 2 loose reds, and position play rewards cue positions that open reds.
8. **Break library is easy** (an offline script, a few minutes of computing). Low risk.
9. **Postpone:** FLUKE (hard to generate on purpose; rate 0 until stage 8), side spin (never in v1),
   near-miss drama (stage 8, not earlier).
10. **Money / publishing note (your decision, later):** with demo credits everything can run in the browser. For real
   money the RNG and the balance must move to a server, and a gambling licence plus a certified RNG are needed. The
   "outcome first" design already makes that move easy.

## Decisions (owner, 2026-11-24)
- Approved: record-then-play-back; black look-ahead; RTP split (formula + RNG-only run, physics soak checks
  per-step success rates); round code `seed-colours`; 15-red break filter; postponements (FLUKE, side spin).
- No universal fallback: last resort is RE-RACK (RULES.md D.4), with the menu sentence in RULES.md E.
1. Pocket-camera cut mid-shot: yes, but also cut on successful pots so the cut never reveals the result (RULES B.6).
2. Soak RTP split: yes.  3. Round code: yes.
4. Colour buttons: black + every other colour with a ready pot, max 3, higher values first.
5. Final colours: SHOOT button, label names the colour.
6. MAXIMUM IS ON: 3rd red (6 reds), 4th red (10 reds), 5th red (15 reds).
