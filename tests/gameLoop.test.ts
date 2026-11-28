// Task 5.2: the game page's pure parts. (1) The texts: end line, hint, round codes. (2) The pre-solve path: the next
// shot is solved for BOTH outcomes before SHOOT (as the worker does), then the decided one is handed to the state
// machine; the round must come out exactly as if the shot had been solved at SHOOT time.
import { describe, expect, it } from 'vitest';
import { buildBreaks } from '../src/core/breakLibrary';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { cashOut, newRound, nextOutcome, nextTarget, shoot, start, type Round } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';
import { solvedProvider } from '../src/game/presolve';
import { endLine, FAILURE_TEXT, hintText, parseRoundCode } from '../src/game/roundView';

const table = buildTable();

describe('task 5.2: texts (RULES B.4, D.4)', () => {
  it('end lines', () => {
    expect(endLine({ type: 'cashOut', amount: 12.3, multiplier: 1.23 }, 10)).toBe('WON 12.30 · x1.23');
    expect(endLine({ type: 'reRack', amount: 1234.5, multiplier: 123.45 }, 10)).toBe('RE-RACK · WON 1,234.50 · x123.45');
    expect(endLine({ type: 'failure', label: 'inOff', step: 3 }, 10)).toBe('IN-OFF · LOST 10.00');
    expect(endLine({ type: 'clearance', amount: 250, multiplier: 25 }, 10)).toBe('CLEARED · WON 250.00 · x25.00');
  });
  it('failure labels: MISSED / IN-OFF / FOUL / SNOOKERED', () => {
    expect(FAILURE_TEXT).toEqual({ plainMiss: 'MISSED', jawRattle: 'MISSED', inOff: 'IN-OFF', wrongBallFirst: 'FOUL', snookered: 'SNOOKERED' });
  });
  it('round codes "<level>-<seed>" or a bare seed', () => {
    expect(parseRoundCode('reds6-12345')).toEqual({ levelId: 'reds6', seed: 12345, rng: 1, colours: null, cashOutAfter: null });
    expect(parseRoundCode('reds6-v2-12345')).toEqual({ levelId: 'reds6', seed: 12345, rng: 2, colours: null, cashOutAfter: null });
    expect(parseRoundCode('V2-12345-K-C1')).toEqual({ levelId: null, seed: 12345, rng: 2, colours: ['black'], cashOutAfter: 1 });
    // night 6: v3 is the marker of every new round (v2 generator + the baulk-line break-off library)
    expect(parseRoundCode('reds6-v3-12345')).toEqual({ levelId: 'reds6', seed: 12345, rng: 3, colours: null, cashOutAfter: null });
    expect(parseRoundCode('reds6-v4-12345')!.rng).toBe(4); expect(parseRoundCode('reds6-v5-12345')).toBeNull(); // night 8: v4
    expect(parseRoundCode('reds6-12345-BKPk-C7')).toEqual({ levelId: 'reds6', seed: 12345, rng: 1, colours: ['blue', 'black', 'pink', 'black'], cashOutAfter: 7 });
    expect(parseRoundCode('reds10-5-C3')).toEqual({ levelId: 'reds10', seed: 5, rng: 1, colours: null, cashOutAfter: 3 });
    expect(parseRoundCode('reds6-5-X')).toBeNull();
    expect(parseRoundCode('reds6-5-C0')).toBeNull();
    expect(parseRoundCode(' 987 ')).toEqual({ levelId: null, seed: 987, rng: 1, colours: null, cashOutAfter: null });
    expect(parseRoundCode('reds7-1')).toBeNull();
    expect(parseRoundCode('abc')).toBeNull();
    expect(parseRoundCode('99999999999')).toBeNull();
  });
  it('the hint names the ball due (black after a red) and the next multiplier', () => {
    const r = newRound(1);
    const red: Round = { ...r, phase: 'decide', step: 2, frame: { phase: 'red' } as Round['frame'] };
    expect(hintText(red)).toBe(`RED · NEXT x${r.ladder[2]!.multiplier.toFixed(2)}`);
    expect(hintText({ ...red, frame: { phase: 'colour' } as Round['frame'] })).toMatch(/^COLOUR · NEXT/); // picked colour not known yet
    expect(hintText({ ...red, frame: { phase: 'colour' } as Round['frame'] }, 'pink')).toMatch(/^PINK · NEXT/);
  });
});

describe('task 5.2: solving both outcomes before SHOOT gives the same round', () => {
  it('pre-solved rounds equal rounds solved at SHOOT time', () => {
    const library = {
      reds6: { redPottable: buildBreaks(6, 'redPottable', 3, table, 11).entries, snookered: buildBreaks(6, 'snookered', 2, table, 12).entries },
    };
    let checked = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const direct = createPhysicsProvider(table, library);
      let a = start(newRound(seed), direct, table);
      let b = a;
      while (a.phase === 'decide') {
        if (a.step >= 3) { a = cashOut(a); b = cashOut(b); break; }
        a = shoot(a, direct, table);
        // what the page does: solve both outcomes first, then hand over the decided one
        const { step, outcome, failure } = nextOutcome(b);
        const target = nextTarget(b);
        const ahead = createPhysicsProvider(table, library);
        const ctx = { roundCode: b.roundCode, step };
        const both = { success: ahead.shot(b.frame!, target, 'success', ctx), failure: ahead.shot(b.frame!, target, failure, ctx) };
        expect(both.success.tried).toBeGreaterThan(0);
        b = shoot(b, solvedProvider(ahead, outcome === 'success' ? both.success : both.failure, { target, outcome }), table);
        checked++;
      }
      expect(b.end).toEqual(a.end);
      expect(b.balance).toBe(a.balance);
      expect(b.history.map((h) => [h.step, h.outcome])).toEqual(a.history.map((h) => [h.step, h.outcome]));
      expect(b.frame?.balls).toEqual(a.frame?.balls);
    }
    expect(checked).toBeGreaterThan(0);
  }, 300_000);
});

describe('night 4, Part 3a: the game page plays a replay free', () => {
  it('START of a replay passes free, CASH OUT and the end line show no money, a REPLAY label shows', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/game/gamePage.ts', 'utf8');
    expect(src).toContain('round = startRound({ ...round, seed, rng, free: replay !== null }, provider, table);');
    expect(src).toContain("if (!replay && round.balance < round.bet) return;");
    expect(src).toContain("const cashText = round.free ? `${formatMult(ladder()[round.step - 1]!.multiplier)} · REPLAY` : money(amount);");
    expect(src).toContain("$('replayTag').classList.toggle('show', !!round.free && (round.phase === 'decide' || busy !== null));");
    expect(readFileSync('index.html', 'utf8')).toContain('<div id="replayTag">REPLAY</div>');
  });
});
