// Task P.1: the presolver (src/game/presolve.ts) with fake workers, so the order and timing of answers is controlled.
import { describe, expect, it } from 'vitest';
import { buildBreaks } from '../src/core/breakLibrary';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextOutcome, nextTarget, setLevel, shoot, start } from '../src/core/round';
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
    const { costLine } = await import('../vite.config');
    const j = JSON.parse(costLine({ code: 'reds15-12', step: 4, target: 'black', outcome: 'success', successMs: 812.6, successTried: 900,
      failureMs: 'x', failureTried: 40, pressAfterMs: 1500, thinkingMs: 0, ua: 'Mozilla/5.0 (Linux; Android 14) <script>', solver: '4.10' }, '', 't'));
    expect(j).toMatchObject({ code: 'reds15-12', step: 4, target: 'black', successMs: 813, failureMs: null, thinkingMs: 0 });
    expect(j.ua).not.toContain('<');
    expect(() => costLine({ code: '../x' }, '', 't')).toThrow();
  });
  it('the game sends them only in the dev build', async () => {
    const src = (await import('node:fs')).readFileSync('src/game/gamePage.ts', 'utf8');
    const fn = src.slice(src.indexOf('function sendCost('), src.indexOf('// PC link (2026-11-25)'));
    expect(fn).toContain('if (!import.meta.env.DEV) return;');
  });
});
