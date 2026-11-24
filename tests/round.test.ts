// Task 5.1: the round state machine, headless. A fast fake provider stands in for the break library and the solver
// (it only reports what the physics would: which ball was hit first and what dropped).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { cashOut, newRound, setBet, setLevel, shoot, start, stepSucceeds, type FailureLabel, type Round, type ShotProvider } from '../src/core/round';
import type { FrameState, ShotResult } from '../src/core/rules';
import { buildTable } from '../src/core/table/geometry';
import type { BallKind } from '../src/core/types';

const table = buildTable();

function fakeResult(frame: FrameState, target: BallKind, outcome: 'success' | FailureLabel): ShotResult {
  const ball = frame.balls.find((b) => b.kind === target)!;
  const other = frame.balls.find((b) => b.kind !== target && b.kind !== 'cue');
  const keep = (potted: string[]) => frame.balls.filter((b) => !potted.includes(b.id));
  switch (outcome) {
    case 'success': return { firstHit: ball.id, potted: [ball.id], after: keep([ball.id]) };
    case 'inOff': return { firstHit: ball.id, potted: ['cue'], after: keep(['cue']) };
    case 'wrongBallFirst': return { firstHit: other ? other.id : null, potted: [], after: keep([]) }; // last ball: nothing else to hit
    case 'snookered': return { firstHit: null, potted: [], after: keep([]) };
    default: return { firstHit: ball.id, potted: [], after: keep([]) };
  }
}
const fake = (opts: { reRack?: boolean } = {}): ShotProvider => ({
  breakAndStep1: (_level, outcome, _pick, frame) => ({ afterBreak: frame, step1: { result: fakeResult(frame, 'red', outcome) } }),
  shot: (frame, target, outcome) => ({ result: fakeResult(frame, target, outcome), reRack: outcome === 'success' && opts.reRack }),
});

/** Play a round: SHOOT until `cashAt` successful steps (then CASH OUT), or until it ends. */
function play(seed: number, cashAt: number | null, provider = fake(), colour?: 'pink' | 'blue'): Round {
  let r = start(newRound(seed), provider, table);
  while (r.phase === 'decide') r = cashAt !== null && r.step >= cashAt ? cashOut(r) : shoot(r, provider, table, colour);
  return r;
}

describe('Bet and START (RULES A.1)', () => {
  it('a new round starts with the starting balance, the default bet and the default level', () => {
    const r = newRound(1);
    expect([r.phase, r.balance, r.bet, r.levelId]).toEqual(['betting', CONFIG.money.startingBalance, CONFIG.money.defaultBet, CONFIG.defaultLevel]);
  });
  it('the bet stays between the minimum and the maximum', () => {
    expect(setBet(newRound(1), 0).bet).toBe(CONFIG.money.minBet);
    expect(setBet(newRound(1), 1000).bet).toBe(CONFIG.money.maxBet);
  });
  it('START takes the bet from the balance, and the bet and level are locked until the round ends', () => {
    const r = start(newRound(3), fake(), table);
    expect(r.balance).toBe(CONFIG.money.startingBalance - CONFIG.money.defaultBet);
    if (r.phase === 'decide') {
      expect(() => setBet(r, 50)).toThrow();
      expect(() => setLevel(r, 'reds15')).toThrow();
    }
  });
  it('START is refused when the balance is lower than the bet', () => {
    expect(() => start(setBet(newRound(1, 5), 10), fake(), table)).toThrow();
  });
});

describe('Step 1 and the round flow (RULES B.2, A.3, A.4)', () => {
  it('step 1 is played automatically: after START the round is at step 1, or over with MISSED or SNOOKERED', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = start(newRound(seed), fake(), table);
      if (r.phase === 'decide') expect(r.step).toBe(1);
      else expect(r.end).toMatchObject({ type: 'failure', step: 1 });
      if (r.end?.type === 'failure') expect(['plainMiss', 'snookered']).toContain(r.end.label);
    }
  });
  it('a step-1 failure is a plain miss about 80% of the time and snookered about 20% (config failures.step1)', () => {
    let miss = 0, snk = 0;
    for (let seed = 0; seed < 20000; seed++) {
      const r = start(newRound(seed), fake(), table);
      if (r.end?.type === 'failure') { if (r.end.label === 'plainMiss') miss++; else snk++; }
    }
    expect(miss / (miss + snk)).toBeGreaterThan(0.77);
    expect(miss / (miss + snk)).toBeLessThan(0.83);
  });
  it('CASH OUT pays bet x the current multiplier and ends the round', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r0 = start(newRound(seed), fake(), table);
      if (r0.phase !== 'decide') continue;
      const r = cashOut(r0);
      const m = r.ladder[0]!.multiplier;
      expect(r.end).toEqual({ type: 'cashOut', amount: Math.round(10 * m * 100) / 100, multiplier: m });
      expect(r.balance).toBeCloseTo(r0.balance + 10 * m, 6);
      return;
    }
    throw new Error('no seed reached step 1');
  });
  it('a failure ends the round and the bet is lost', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = play(seed, null);
      if (r.end?.type !== 'failure') continue;
      expect(r.balance).toBe(CONFIG.money.startingBalance - 10);
      return;
    }
    throw new Error('no failure found');
  });
  it('clearing the table pays the top multiplier (x25 for 6 reds), after exactly 18 successful steps', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const r = play(seed, null);
      if (r.end?.type !== 'clearance') continue;
      expect(r.step).toBe(18);
      expect(r.frame!.phase).toBe('cleared');
      expect(r.end).toEqual({ type: 'clearance', amount: 250, multiplier: 25 });
      return;
    }
    throw new Error('no clearance in 3000 seeds');
  });
  it('RE-RACK (RULES D.4): the pot counts, the round ends paid at the NEW multiplier', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r0 = start(newRound(seed), fake(), table);
      if (r0.phase !== 'decide' || !stepSucceeds(r0, 2)) continue;
      const r = shoot(r0, fake({ reRack: true }), table);
      const m = r.ladder[1]!.multiplier;
      expect(r.end).toEqual({ type: 'reRack', amount: Math.round(10 * m * 100) / 100, multiplier: m });
      expect(r.step).toBe(2);
      return;
    }
    throw new Error('no seed with steps 1 and 2 successful');
  });
});

describe('Outcome first (RULES A.5)', () => {
  it('the colour choice never changes the outcomes: same seed, pink or blue, same steps and the same end step', () => {
    for (let seed = 0; seed < 300; seed++) {
      const a = play(seed, null, fake(), 'pink');
      const b = play(seed, null, fake(), 'blue');
      expect(b.history.map((h) => h.outcome)).toEqual(a.history.map((h) => h.outcome));
      expect(b.step).toBe(a.step);
    }
  });
  it('the return of "cash out after step k" matches the ladder RTP (0.97) over 20,000 rounds', () => {
    for (const k of [1, 3, 6]) {
      let paid = 0;
      const n = 20000;
      for (let seed = 0; seed < n; seed++) {
        const r = play(seed, k);
        if (r.end?.type === 'cashOut' || r.end?.type === 'clearance') paid += r.end.amount;
      }
      expect(paid / (n * 10)).toBeGreaterThan(CONFIG.ladder.targetRtp - 0.03);
      expect(paid / (n * 10)).toBeLessThan(CONFIG.ladder.targetRtp + 0.03);
    }
  }, 60_000);
  it('later failures follow the config shares (plain miss 60%, jaw rattle 25%, in-off 10%, wrong ball first 5%)', () => {
    const count: Record<string, number> = {};
    let total = 0;
    for (let seed = 0; seed < 20000; seed++) {
      const r = play(seed, null);
      if (r.end?.type === 'failure' && r.end.step > 1) { count[r.end.label] = (count[r.end.label] ?? 0) + 1; total++; }
    }
    for (const [label, share] of Object.entries(CONFIG.failures.later)) {
      expect(Math.abs((count[label] ?? 0) / total - share)).toBeLessThan(0.02);
    }
  }, 60_000);
});
