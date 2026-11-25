// Task P.1: the presolver (src/game/presolve.ts) with fake workers, so the order and timing of answers is controlled.
import { describe, expect, it } from 'vitest';
import { buildBreaks } from '../src/core/breakLibrary';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextOutcome, nextTarget, outcomeDraw, setLevel, shoot, start, successEnd, type Round } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';
import { solveJob } from '../src/game/solveJob';
import type { PlannedShot } from '../src/core/round';
import type { FrameState } from '../src/core/rules';
import { createPresolver, solvedProvider, type SolveAnswer, type SolveKind, type SolveRequest, type SolverWorker } from '../src/game/presolve';

/** Fake workers: every request they get is kept, the test sends the answers when it wants. */
function fakes() {
  const made: (SolverWorker & { reqs: SolveRequest[]; dead: boolean })[] = [];
  const make = (): SolverWorker => {
    const w = { reqs: [] as SolveRequest[], dead: false, onmessage: null as SolverWorker['onmessage'],
      postMessage(r: SolveRequest) { this.reqs.push(r); }, terminate() { this.dead = true; } };
    made.push(w);
    return w;
  };
  const answer = (kind: SolveKind) => {
    for (const w of made) {
      const r = w.reqs[w.reqs.length - 1];
      if (w.dead || !r || (r.only ?? kind) !== kind) continue;
      const a: SolveAnswer = { id: r.id, kind, target: 'red', planned: { result: { firstHit: null, potted: [], after: [] }, tried: kind === 'success' ? 1 : 2 } as PlannedShot, ms: 1, log: [] };
      w.onmessage?.({ data: a } as MessageEvent<SolveAnswer>);
      return;
    }
  };
  return { made, make, answer };
}
const frame = { phase: 'red', balls: [] } as unknown as FrameState;
const ctx = { roundCode: 'reds6-1', step: 2 };
const tick = () => new Promise<void>((res) => setTimeout(res, 0));

describe('task P.1: the wait after SHOOT never depends on the decided outcome', () => {
  for (const decided of ['success', 'failure'] as const) {
    for (const first of ['success', 'failure'] as const) {
      it(`decided ${decided}, ${first} answer comes first: SHOOT waits for both`, async () => {
        const f = fakes();
        const p = createPresolver(() => {}, () => {}, f.make);
        p.request(frame, 'red', 'plainMiss', ctx);
        let got: unknown = null;
        void p.get(decided, ctx).then((s) => { got = s; });
        await tick();
        expect(got).toBeNull();
        expect(p.ready()).toBe(false);
        f.answer(first);
        await tick();
        expect(got).toBeNull(); // one answer is never enough, even when it is the decided one
        expect(p.ready()).toBe(false);
        f.answer(first === 'success' ? 'failure' : 'success');
        await tick();
        expect(p.ready()).toBe(true);
        expect((got as { planned: PlannedShot }).planned.tried).toBe(decided === 'success' ? 1 : 2);
      });
    }
  }

  it('success and failure SHOOTs are released at the same moment', async () => {
    const released: Record<string, number> = {};
    for (const decided of ['success', 'failure'] as const) {
      const f = fakes();
      const p = createPresolver(() => {}, () => {}, f.make);
      p.request(frame, 'red', 'plainMiss', ctx);
      let n = 0;
      let done = false;
      void p.get(decided, ctx).then(() => { done = true; });
      for (const k of ['success', 'failure'] as const) { await tick(); if (!done) n++; f.answer(k); }
      await tick();
      expect(done).toBe(true);
      released[decided] = n;
    }
    expect(released.success).toBe(released.failure);
  });
});

describe('task P.1: two workers, one per outcome', () => {
  it('each worker solves one outcome and stays alive between shots', async () => {
    const f = fakes();
    const p = createPresolver(() => {}, () => {}, f.make);
    for (let step = 2; step <= 4; step++) {
      const c = { roundCode: 'reds6-1', step };
      p.request(frame, 'red', 'plainMiss', c);
      f.answer('success'); f.answer('failure');
      await p.get('success', c);
    }
    expect(f.made.length).toBe(2);
    expect(f.made.map((w) => w.reqs.map((r) => r.only))).toEqual([['success', 'success', 'success'], ['failure', 'failure', 'failure']]);
  });

  it('a dropped request restarts only the worker still busy with it', () => {
    const f = fakes();
    const p = createPresolver(() => {}, () => {}, f.make);
    p.request(frame, 'red', 'plainMiss', ctx);
    f.answer('success');
    p.cancel();
    expect(f.made.map((w) => w.dead)).toEqual([false, true]);
    p.request(frame, 'red', 'plainMiss', ctx);
    expect(f.made.length).toBe(3); // a new failure worker; the success worker is reused
    expect(f.made[0]!.reqs.length).toBe(2);
  });

  it('two workers find exactly the shots one worker finds (same seeds, colour steps included)', () => {
    const table = buildTable();
    const library = { reds6: { redPottable: buildBreaks(6, 'redPottable', 3, table, 11).entries, snookered: buildBreaks(6, 'snookered', 2, table, 12).entries } };
    const now = () => 0; // the solver records its time inside the shot; a fixed clock makes the shots comparable
    let steps = 0; let colourSteps = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const base = createPhysicsProvider(table, library);
      let r = start(setLevel(newRound(seed * 7 + 3), 'reds6'), base, table);
      while (r.phase === 'decide' && r.step < 6) {
        const { step, outcome, failure } = nextOutcome(r);
        const req: SolveRequest = { id: 1, frame: r.frame!, target: nextTarget(r), failure, ctx: { roundCode: r.roundCode, step } };
        const run = (kinds: SolveKind[]) => { const got: Partial<Record<SolveKind, SolveAnswer>> = {}; solveJob(table, req, kinds, now, (a) => { got[a.kind] = a; }); return got; };
        const one = run(['success', 'failure']);
        const two = { ...run(['success']), ...run(['failure']) };
        for (const k of ['success', 'failure'] as const) {
          expect(two[k]!.target).toBe(one[k]!.target);
          expect(two[k]!.planned).toEqual(one[k]!.planned);
          expect(two[k]!.log).toEqual(one[k]!.log);
        }
        steps++;
        if (r.frame!.phase === 'colour') colourSteps++;
        const a = one[outcome === 'success' ? 'success' : 'failure']!;
        r = shoot(r, solvedProvider(base, a.planned, { target: a.target, outcome }), table, r.frame!.phase === 'colour' ? (a.target as never) : undefined);
      }
    }
    expect(steps).toBeGreaterThan(5);
    expect(colourSteps).toBeGreaterThan(0);
  }, 600_000);
});

describe('task P.1: phone cost lines (dev only)', () => {
  it('the PC keeps only plain numbers and short texts', async () => {
    const { costLine } = await import('../src/game/costLine');
    const j = JSON.parse(costLine({ code: 'reds15-12', step: 4, target: 'black', outcome: 'success', successMs: 812.6, successTried: 900,
      failureMs: 'x', failureTried: 40, pressAfterMs: 1500, thinkingMs: 0, u: 0.97341234567, p: 'x', ua: 'Mozilla/5.0 (Linux; Android 14) <script>', solver: '4.10' }, '', 't'));
    expect(j).toMatchObject({ code: 'reds15-12', step: 4, target: 'black', successMs: 813, failureMs: null, thinkingMs: 0, u: 0.973412, p: null });
    expect(j.ua).not.toContain('<');
    expect(() => costLine({ code: '../x' }, '', 't')).toThrow();
  });
  it('the game sends them only in the dev build', async () => {
    const src = (await import('../src/game/gamePage.ts?raw')).default;
    const fn = src.slice(src.indexOf('function sendCost('), src.indexOf('// PC link (2026-11-25)'));
    expect(fn).toContain('if (!import.meta.env.DEV) return;');
  });
});

describe('task P.2: the step after next is solved ahead, from the success end', () => {
  it('both answers -> onBoth -> ahead; a matching request keeps it, the wait still needs both answers', async () => {
    const f = fakes();
    const calls: number[] = [];
    const p = createPresolver(() => {}, () => {}, f.make, (req) => calls.push(req.ctx.step));
    const c2 = { roundCode: 'reds6-1', step: 2 }; const c3 = { roundCode: 'reds6-1', step: 3 };
    p.request(frame, 'red', 'plainMiss', c2);
    f.answer('success');
    expect(calls).toEqual([]); // one answer is not enough
    f.answer('failure');
    expect(calls).toEqual([2]);
    p.ahead(frame, 'black', 'inOff', c3);
    expect(f.made.map((w) => w.reqs.length)).toEqual([2, 2]); // both workers got step 3 at once
    f.answer('success'); // step 3 success answer, while step 2 is still the shot to play
    expect(p.ready()).toBe(true);
    p.request(frame, 'black', 'inOff', c3); // step 2 succeeded: the same request -> kept, nothing new is posted
    expect(f.made.map((w) => w.reqs.length)).toEqual([2, 2]);
    expect(p.answers().ahead).toBe(true);
    expect(p.ready()).toBe(false);
    let got = false;
    void p.get('success', c3).then(() => { got = true; });
    await tick();
    expect(got).toBe(false); // the success answer of step 3 exists, but SHOOT still waits for its failure answer
    f.answer('failure');
    await tick();
    expect(got).toBe(true);
    expect(calls).toEqual([2, 3]);
  });

  it('a different request (or a cash out) drops the step ahead and restarts only busy workers', () => {
    const f = fakes();
    const p = createPresolver(() => {}, () => {}, f.make, () => {});
    p.request(frame, 'red', 'plainMiss', ctx);
    f.answer('success'); f.answer('failure');
    p.ahead(frame, 'black', 'inOff', { roundCode: 'reds6-1', step: 3 });
    f.answer('success');
    p.cancel();
    expect(f.made.map((w) => w.dead)).toEqual([false, true]);
    p.request(frame, 'red', 'plainMiss', { roundCode: 'reds6-2', step: 2 });
    expect(f.made.length).toBe(3);
    expect(p.answers().ahead).toBe(false);
  });

  it('the step solved ahead is the very request the real success leads to, and gives the same shots', () => {
    const table = buildTable();
    const library = { reds6: { redPottable: buildBreaks(6, 'redPottable', 3, table, 11).entries, snookered: buildBreaks(6, 'snookered', 2, table, 12).entries } };
    const now = () => 0;
    const solve = (req: SolveRequest) => { const got: Partial<Record<SolveKind, SolveAnswer>> = {}; solveJob(table, req, ['success', 'failure'], now, (a) => { got[a.kind] = a; }); return got; };
    const reqOf = (r: Round): SolveRequest => { const { step, failure } = nextOutcome(r); return { id: 1, frame: r.frame!, target: nextTarget(r), failure, ctx: { roundCode: r.roundCode, step } }; };
    let compared = 0; let colour = 0; let solvedSame = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const base = createPhysicsProvider(table, library);
      let r = start(setLevel(newRound(seed * 7 + 3), 'reds6'), base, table);
      let ahead: SolveRequest | null = null;
      while (r.phase === 'decide' && r.step < 7) {
        const req = reqOf(r);
        if (ahead) { expect(ahead).toEqual(req); compared++; if (req.frame.phase === 'colour') colour++; }
        const both = solve(req);
        const s = both.success!;
        const after = successEnd(r, s.target, s.planned, table);
        const nextAhead = after.phase === 'decide' ? reqOf(after) : null;
        if (nextAhead && solvedSame < 3) { // the ahead solve equals the solve the real round makes later (when it succeeds)
          const a = solve(nextAhead); const b = solve(nextAhead);
          expect(a.success!.planned).toEqual(b.success!.planned); solvedSame++;
        }
        const { outcome } = nextOutcome(r);
        const a = both[outcome === 'success' ? 'success' : 'failure']!;
        r = shoot(r, solvedProvider(base, a.planned, { target: a.target, outcome }), table, r.frame!.phase === 'colour' ? (a.target as never) : undefined);
        ahead = outcome === 'success' ? nextAhead : null;
      }
    }
    expect(compared).toBeGreaterThan(5);
    expect(colour).toBeGreaterThan(0);
  }, 600_000);
});

describe('owner 2026-11-25: the developer line "outcome from seed" uses the values round.ts decides with', () => {
  it('u < p exactly when the decided outcome is a success', () => {
    let hits = 0; let misses = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = { ...setLevel(newRound(seed), 'reds15'), step: 3 } as Round;
      const d = outcomeDraw(r, 4);
      const ok = nextOutcome(r).outcome === 'success';
      expect(d.u < d.p).toBe(ok);
      if (ok) hits++; else misses++;
    }
    expect(hits > 0 && misses > 0).toBe(true);
  });
});
