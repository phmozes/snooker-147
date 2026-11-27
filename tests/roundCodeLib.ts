// Task 5.4 test helpers: play a round with random player choices, and record every trajectory of a round frame by
// frame (the break-off, step 1 and every later shot), through a provider that records what it hands out.
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { newFrame } from '../src/core/rules';
import { mulberry32 } from '../src/core/rng';
import { cashOut, newRound, setLevel, shoot, start, type LevelId, type Round, type ShotProvider } from '../src/core/round';
import type { TableGeometry } from '../src/core/table/geometry';
import type { Ball, Colour } from '../src/core/types';
import { CONFIG } from '../src/config/game.config';

const CHOICES: Colour[] = ['black', 'pink', 'blue'];
type Strike = { dir: { x: number; y: number }; speed: number; spin: number };

/** Records one shot frame by frame and returns a short fingerprint (frame count + hash of every position). */
export function fingerprint(balls: Ball[], s: Strike, table: TableGeometry): string {
  const sim = createSim(balls, table);
  strike(sim, 'cue', s.dir, s.speed, s.spin);
  const x = recordShot(sim);
  let h = 2166136261;
  for (const f of x.frames) for (const v of f) h = Math.imul(h ^ (Number.isNaN(v) ? 7 : Math.round(v * 1e7)), 16777619);
  return `${x.frames.length}:${(h >>> 0).toString(16)}`;
}

/** A provider that records the trajectory of every shot it hands out (in `tracks`). */
export function recording(base: ShotProvider, table: TableGeometry, level: LevelId): ShotProvider & { tracks: string[] } {
  const tracks: string[] = [];
  return {
    tracks,
    autoColour: base.autoColour?.bind(base),
    breakAndStep1(levelId, outcome, pick, frame, rng) {
      const x = base.breakAndStep1(levelId, outcome, pick, frame, rng);
      const b = x.breakShot as { cueStart: { x: number; y: number }; shot: Strike };
      const rack = newFrame(CONFIG.levels.find((l) => l.id === level)!.reds, table).balls
        .map((q) => (q.kind === 'cue' ? { ...q, pos: { ...b.cueStart } } : q));
      tracks.push(`break ${fingerprint(rack, b.shot, table)}`);
      tracks.push(`step1 ${outcome} ${fingerprint(x.afterBreak.balls, x.step1.shot as Strike, table)}`);
      return x;
    },
    shot(frame, target, outcome, ctx) {
      const p = base.shot(frame, target, outcome, ctx);
      tracks.push(`${ctx.step} ${target} ${outcome} ${p.reRack ? 'RE-RACK' : fingerprint(frame.balls, p.shot as Strike, table)}`);
      return p;
    },
  };
}

/** A round with random choices (a test RNG, never the round's own): cash out at a random step or never, and on one
 *  colour step in five a random colour from black / pink / blue instead of the automatic pick. */
export function playRandomRound(level: LevelId, seed: number, provider: ShotProvider, table: TableGeometry, salt: number) {
  const rnd = mulberry32((seed ^ Math.imul(salt + 1, 2654435761)) >>> 0);
  let r: Round = start(setLevel(newRound(seed), level), provider, table);
  const cashAt = rnd() < 0.5 ? 1 + Math.floor(rnd() * r.ladder.length) : Infinity;
  let notAuto = false;
  while (r.phase === 'decide') {
    if (r.step >= cashAt) { r = cashOut(r); break; }
    if (r.frame!.phase === 'colour' && rnd() < 0.2) {
      const c = CHOICES[Math.floor(rnd() * CHOICES.length)]!;
      const auto = provider.autoColour?.(r.frame!, { roundCode: r.roundCode, step: r.step + 1 });
      if (c !== auto) notAuto = true;
      r = shoot(r, provider, table, c);
    } else r = shoot(r, provider, table);
  }
  return { round: r, notAuto };
}
