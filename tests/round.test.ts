// Task 5.1: the round state machine, headless. A fast fake provider stands in for the break library and the solver
// (it only reports what the physics would: which ball was hit first and what dropped).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { breakFilesFor, breakLibraryOf, libraryTagFor } from '../src/core/physicsProvider';
import { awaitingStep1, baseCode, newRngFor, RNG_VERSION_NEW, streamValue, cashOut, FORCED_OUTCOMES, newRound, setBet, setLevel, shoot, shootForced, start, startRound, stepSucceeds, type FailureLabel, type Round, type ShotProvider } from '../src/core/round';
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
function play(seed: number, cashAt: number | null, provider = fake(), colour?: 'pink' | 'blue', bet?: number): Round {
  let r = start(bet === undefined ? newRound(seed) : setBet(newRound(seed), bet), provider, table);
  while (r.phase === 'decide') r = cashAt !== null && r.step >= cashAt ? cashOut(r) : shoot(r, provider, table, colour);
  return r;
}

describe('Payouts are round(bet x multiplier of the step), never built from rounded parts', () => {
  const dp = 10 ** CONFIG.money.currencyDecimals;
  const exact = (bet: number, m: number) => Math.round(bet * m * dp) / dp;
  it('CASH OUT at every step of every level, for every bet from the minimum to the maximum', () => {
    for (const level of CONFIG.levels) {
      const base = setLevel(newRound(1), level.id);
      for (let bet = CONFIG.money.minBet; bet <= CONFIG.money.maxBet; bet += CONFIG.money.betStep) {
        for (const step of base.ladder) {
          const r: Round = { ...base, phase: 'decide', bet, step: step.step, balance: 0 };
          const end = cashOut(r).end as { type: 'cashOut'; amount: number; multiplier: number };
          expect(end).toEqual({ type: 'cashOut', amount: exact(bet, step.multiplier), multiplier: step.multiplier });
          expect(cashOut(r).balance).toBe(end.amount); // the balance gets exactly the amount
        }
      }
    }
  });
  it('RE-RACK pays round(bet x the NEW step multiplier); clearance pays round(bet x top multiplier)', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const bet of [1, 7, 33, 99]) {
        const r = play(seed, null, fake({ reRack: true }), undefined, bet);
        if (r.end?.type === 'reRack') expect(r.end.amount).toBe(exact(bet, r.ladder[r.step - 1]!.multiplier));
      }
    }
    let cleared = 0;
    for (let seed = 0; seed < 20000 && cleared < 3; seed++) {
      const r = play(seed, null, fake(), undefined, 37);
      if (r.end?.type !== 'clearance') continue;
      cleared++;
      expect(r.end.amount).toBe(exact(37, r.ladder[r.ladder.length - 1]!.multiplier));
    }
  });
});

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
  it('RULES B.3: the automatic colour (black, else pink, else blue) never changes the outcomes or the money', () => {
    // a provider whose layout "has no natural black": it picks pink on every colour step
    const pinky: ShotProvider = { ...fake(), autoColour: () => 'pink' };
    let colourSteps = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const cashAt of [null, 3]) {
        const a = play(seed, cashAt, fake());
        const b = play(seed, cashAt, pinky);
        expect(b.history.map((h) => [h.step, h.outcome])).toEqual(a.history.map((h) => [h.step, h.outcome]));
        expect([b.end, b.balance]).toEqual([a.end, a.balance]);
        for (let i = 0; i < a.history.length; i++) {
          const colourStep = a.history[i]!.step % 2 === 0 && a.history[i]!.step <= 2 * CONFIG.levels[0]!.reds; // reds remain
          if (colourStep) { colourSteps++; expect([a.history[i]!.target, b.history[i]!.target]).toEqual(['black', 'pink']); }
        }
      }
    }
    expect(colourSteps).toBeGreaterThan(100);
  });
  it('without an automatic pick (no autoColour), the game picks black', () => {
    const r = play(5, 2, fake());
    for (const h of r.history) if (h.step % 2 === 0) expect(h.target).toBe('black');
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

describe('developer test panel: forced outcomes (task 5.3)', () => {
  // a seed whose step 1 succeeds, so the round is in 'decide'
  const seed = Array.from({ length: 200 }, (_, i) => i + 1).find((x) => stepSucceeds(newRound(x), 1))!;
  it('each forced outcome plays as asked and marks the round and the shot', () => {
    for (const f of FORCED_OUTCOMES) {
      const r0 = start(newRound(seed), fake(), table);
      const r = shootForced(r0, fake(), table, f);
      const h = r.history[r.history.length - 1]!;
      expect(r.forced).toBe(true);
      expect(h.forced).toBe(true);
      if (f === 'success') { expect(h.outcome).toBe('success'); expect(r.step).toBe(2); }
      else if (f === 'reRack') { expect(r.end?.type).toBe('reRack'); expect(r.end && 'multiplier' in r.end && r.end.multiplier).toBe(r.ladder[1]!.multiplier); }
      else { expect(r.end).toEqual({ type: 'failure', label: f, step: 2 }); }
    }
  });
  it('forcing success to the end gives a clearance; a new START clears the mark; shoot() never marks', () => {
    let r = start(newRound(seed), fake(), table);
    while (r.phase === 'decide') r = shootForced(r, fake(), table, 'success');
    expect(r.end?.type).toBe('clearance');
    const next = start(r, fake(), table);
    expect(next.forced).toBe(false);
    const played = next.phase === 'decide' ? shoot(next, fake(), table) : next;
    expect(played.forced).toBe(false);
    expect(played.history.some((h) => h.forced)).toBe(false);
  });
});

describe('night 4, Part 3a: a replay is free (no bet, no pay; the balance is the same before and after)', () => {
  const playFree = (seed: number, cashAt: number | null, free: boolean, provider = fake(), balance = 990) => {
    let r = start({ ...newRound(seed, balance), free }, provider, table);
    const afterStart = r.balance;
    while (r.phase === 'decide') r = cashAt !== null && r.step >= cashAt ? cashOut(r) : shoot(r, provider, table);
    return { r, afterStart };
  };
  it('every end type: balance unchanged on a replay; the same round played for real pays as before', () => {
    const ends = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) for (const [cashAt, prov] of [[null, fake()], [2, fake()], [null, fake({ reRack: true })]] as const) {
      const free = playFree(seed, cashAt, true, prov), real = playFree(seed, cashAt, false, prov);
      expect(free.afterStart).toBe(990); // START took no bet
      expect(free.r.balance).toBe(990); // and nothing was paid
      expect(real.afterStart).toBe(980); // the real round: bet 10 taken
      expect(free.r.end).toEqual(real.r.end); // same outcome and end (the end still says what the real round paid)
      expect(free.r.history.map((h) => h.outcome)).toEqual(real.r.history.map((h) => h.outcome));
      ends.add(free.r.end!.type);
    }
    expect([...ends].sort()).toEqual(['cashOut', 'clearance', 'failure', 'reRack'].filter((e) => ends.has(e)).sort());
    expect(ends.size).toBeGreaterThanOrEqual(3);
  });
  it('a replay may start with a balance below the bet', () => {
    expect(() => start({ ...newRound(5, 3), free: true }, fake(), table)).not.toThrow();
    expect(() => start({ ...newRound(5, 3), free: false }, fake(), table)).toThrow();
  });
});

describe('RULES B.2 (owner 2026-11-27): step 1 waits for SHOOT, outcomes unchanged', () => {
  it('START takes the bet and stops at step 0; no CASH OUT; the first SHOOT gives exactly the old start()', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const rng of [1, 2, 3] as const) {
        const r0 = newRound(seed, undefined, rng);
        const waiting = startRound(r0, fake(), table);
        expect(waiting.phase).toBe('decide');
        expect(waiting.step).toBe(0);
        expect(waiting.history).toEqual([]);
        expect(waiting.balance).toBe(r0.balance - r0.bet); // the bet is taken at START
        expect(awaitingStep1(waiting)).toBe(true);
        expect(() => cashOut(waiting)).toThrow();
        const pressed = shoot(waiting, fake(), table);
        expect(pressed).toEqual(start(r0, fake(), table)); // same outcome, same shot, same balance, same code
        expect(awaitingStep1(pressed)).toBe(false);
        expect(pressed.history[0]!.outcome === 'success').toBe(stepSucceeds(pressed, 1));
      }
    }
  });
});

describe('night 6: round version 3 = the v2 generator + the new break-off library', () => {
  it('v3 draws every stream value exactly as v2 (no change to the generator); only the code marker differs', () => {
    for (let seed = 1; seed <= 500; seed++) for (const stream of ['outcome', 'failureType', 'break', 'variety'])
      for (let k = 0; k <= 20; k++) expect(streamValue(seed, stream, k, 3)).toBe(streamValue(seed, stream, k, 2));
    expect(RNG_VERSION_NEW).toBe(3);
    expect(baseCode('reds6', 42, 1)).toBe('reds6-42');
    expect(baseCode('reds6', 42, 2)).toBe('reds6-v2-42');
    expect(baseCode('reds6', 42, 3)).toBe('reds6-v3-42');
    expect(breakLibraryOf(1)).toBe('old');
    expect(breakLibraryOf(2)).toBe('old');
    expect(breakLibraryOf(3)).toBe('v3');
  });
  it('night 8: new 6-red rounds are v4 (v3 generator + the v4 break library), 10 / 15 reds stay v3', () => {
    expect(newRngFor('reds6')).toBe(4);
    expect(newRngFor('reds10')).toBe(3);
    expect(newRngFor('reds15')).toBe(3);
    for (let seed = 1; seed <= 200; seed++) for (const stream of ['outcome', 'failureType', 'break', 'variety'])
      for (let k = 0; k <= 20; k++) expect(streamValue(seed, stream, k, 4)).toBe(streamValue(seed, stream, k, 3));
    expect(baseCode('reds6', 42, 4)).toBe('reds6-v4-42');
    expect(breakLibraryOf(4)).toBe('v4');
    expect(breakFilesFor(4).reds6).toBe('breaks-v4/reds6.json');
    expect(breakFilesFor(4).reds10).toBe(breakFilesFor(3).reds10);
    expect(breakFilesFor(3).reds6).toBe('breaks-v3/reds6.json');
    expect(libraryTagFor(4, 'reds6')).toBe(4);
    expect(libraryTagFor(4, 'reds10')).toBe(3);
    expect(libraryTagFor(3, 'reds6')).toBe(3);
  });
});
