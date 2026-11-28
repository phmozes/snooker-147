// 2026-11-28 (owner, RULES B.7): pace of the player's view cameras on real game shots. Natural rounds (no cash-out,
// automatic colours) are played with the real solver; every SHOOT shot from step 2 is recorded and its on-screen time is
// summed three ways (the same shot, the same cut rule):
//   plain = cue stroke + the recording;  today = plain + the pocket-cut slow motion (the game before this task);
//   new   = today + the R2 glide back of V1 / V2 (and of V3 when the balls stop before its rise ends).
// Thinking time is not counted (the same in all three). Writes nothing outside OUT.
// LEVEL=reds6 SHOTS=300 OUT=bench/results/2026-11-28/cams npx vitest run bench/cam-pace.test.ts
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { breakFilesFor, createPhysicsProvider } from '../src/core/physicsProvider';
import { newRngFor, newRound, setLevel, shoot, start, type LevelId, type Round, type ShotProvider } from '../src/core/round';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { VARIANTS } from '../src/view/cue';
import { addedSeconds, autoCutDraw, pickView, planCut } from '../src/view/pocketCam';
import { glideSeconds, pickPlayerCam } from '../src/view/playerCam';

const table = buildTable();
const LEVEL = (process.env.LEVEL ?? 'reds6') as LevelId;
const SHOTS = +(process.env.SHOTS ?? 300);
const OUT = process.env.OUT ?? 'bench/results/2026-11-28/cams2';
const LEAD = (VARIANTS.C1 as unknown as { added: number }).added; // the cue's stroke before the hit (0.25 s)

it(`camera pace ${LEVEL}`, () => {
  mkdirSync(OUT, { recursive: true });
  const rng = newRngFor(LEVEL);
  const lib = JSON.parse(readFileSync(`public/${breakFilesFor(rng)[LEVEL]}`, 'utf8'));
  const base = createPhysicsProvider(table, { [LEVEL]: lib } as never);
  const file = `${OUT}/pace-${LEVEL}.jsonl`;
  writeFileSync(file, '');
  let seed = 0, n = 0;
  const steps = CONFIG.levels.find((l) => l.id === LEVEL)!.steps;
  const p: ShotProvider = {
    autoColour: base.autoColour?.bind(base), breakAndStep1: base.breakAndStep1.bind(base),
    shot(frame, target, outcome, ctx) {
      const x = base.shot(frame, target, outcome, ctx);
      const s = x.shot as { target?: string; pocket?: PocketId; dir: { x: number; y: number }; speed: number; spin: number; fallback?: string | null; whyNot?: string | null } | undefined;
      if (!x.reRack && s && n < SHOTS) {
        const sim = createSim(frame.balls, table);
        strike(sim, 'cue', s.dir, s.speed, s.spin);
        const rec = recordShot(sim);
        const cut0 = s.target && s.pocket ? planCut(rec, table, s.target, s.pocket, pickView(seed, ctx.step, rng)) : null;
        const cut = cut0 && autoCutDraw(LEVEL, ctx.step, outcome, seed, rng) ? cut0 : null;
        const pick = pickPlayerCam(seed, ctx.step, rng);
        const cam = cut ? 'POCKET' : pick;
        const plain = LEAD + rec.duration, today = plain + (cut ? addedSeconds(cut) : 0);
        const glide = cut ? 0 : glideSeconds(cam, rec.duration, plain); // plain = the shot's time when the balls stop
        n++;
        appendFileSync(file, `${JSON.stringify({ seed, step: ctx.step, last: ctx.step >= steps, outcome, cam, d: +rec.duration.toFixed(3),
          plain: +plain.toFixed(3), today: +today.toFixed(3), now: +(today + glide).toFixed(3), fallback: s.fallback ?? null, whyNot: s.whyNot ?? null })}\n`);
      }
      return x;
    },
  };
  for (seed = 31_000_000; n < SHOTS; seed += 7) {
    let r: Round = start(setLevel(newRound(seed, undefined, rng), LEVEL), p, table);
    while (r.phase === 'decide' && n < SHOTS) r = shoot(r, p, table);
  }
}, 4 * 3600_000);
