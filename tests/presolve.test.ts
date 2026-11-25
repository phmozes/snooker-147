// Task P.1: the presolver (src/game/presolve.ts) with fake workers, so the order and timing of answers is controlled.
import { describe, expect, it } from 'vitest';
import type { PlannedShot } from '../src/core/round';
import type { FrameState } from '../src/core/rules';
import { createPresolver, type SolveAnswer, type SolveKind, type SolveRequest, type SolverWorker } from '../src/game/presolve';

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
      if (w.dead) continue;
      const r = w.reqs[w.reqs.length - 1]!;
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
