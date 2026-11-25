// Owner 2026-11-25: the step-1 cost line must reach the file by the same path the phone uses. The page builds the
// body (stepCost + costBody, as onStart and onShoot do) and posts it to /__dev/cost; here the request goes into the
// real dev-server handler from vite.config.ts (Vite in middleware mode: no port is opened), which writes the line
// to a file of its own (PHONE_COST_FILE), never to bench/results/phone-cost.jsonl.
// Node modules are loaded by name at run time: tests are type-checked without Node types.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { buildBreaks } from '../src/core/breakLibrary';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, nextOutcome, nextTarget, setLevel, shoot, start } from '../src/core/round';
import { buildTable } from '../src/core/table/geometry';
import { solvedProvider, type SolveAnswer, type SolveKind, type SolveRequest } from '../src/game/presolve';
import { solveJob } from '../src/game/solveJob';
import { COST_LINE_VERSION, costBody, stepCost } from '../src/game/stepCost';

type Fs = { readFileSync(p: string, e: string): string; existsSync(p: string): boolean; rmSync(p: string, o?: { force: boolean }): void };
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
let fs: Fs;
let server: ViteDevServer;
const file = `${env.TEMP ?? env.TMPDIR ?? '.'}/phone-cost-test-${Date.now()}.jsonl`;

/** One POST into the dev server's /__dev/cost handler, with the body the phone's fetch sends. */
function post(body: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve) => {
    const handlers: Record<string, ((x?: unknown) => void)[]> = {};
    const req = { method: 'POST', url: '/__dev/cost', headers: { host: 'localhost', 'content-type': 'application/json', 'user-agent': 'test-agent' },
      on(ev: string, cb: (x?: unknown) => void) { (handlers[ev] ??= []).push(cb); return req; }, destroy() {} };
    const res = { statusCode: 200, setHeader() {}, end(text = '') { resolve({ status: res.statusCode, text: String(text) }); } };
    // the /__dev/cost handler that vite.config.ts registers (Vite's own layers before it need a real socket)
    const layer = (server.middlewares as unknown as { stack: { route: string; handle: (q: unknown, r: unknown, next: (err?: unknown) => void) => void }[] })
      .stack.find((l) => l.route === '/__dev/cost');
    if (!layer) { resolve({ status: 404, text: 'no /__dev/cost handler in vite.config.ts' }); return; }
    layer.handle({ ...req, url: '/' }, res, (err?: unknown) => resolve({ status: 404, text: `no handler ${String(err)}` }));
    setTimeout(() => { for (const cb of handlers.data ?? []) cb(body); for (const cb of handlers.end ?? []) cb(); }, 0);
  });
}

beforeAll(async () => {
  fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as Fs;
  env.PHONE_COST_FILE = file;
  server = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false, watch: null }, logLevel: 'silent' });
});
afterAll(async () => { await server?.close(); delete env.PHONE_COST_FILE; fs?.rmSync(file, { force: true }); });

describe('phone-cost lines go through the real dev-server handler, step 1 included', () => {
  it('a round posted step by step writes one line per step from step 1; step 1 keeps its null cost fields', async () => {
    const table = buildTable();
    const library = { reds6: { redPottable: buildBreaks(6, 'redPottable', 3, table, 11).entries, snookered: buildBreaks(6, 'snookered', 2, table, 12).entries } };
    let seed = 0; let played = 0;
    while (played < 3 && seed < 12) {
      seed++;
      fs.rmSync(file, { force: true });
      const base = createPhysicsProvider(table, library);
      let r = start(setLevel(newRound(seed * 7 + 3), 'reds6'), base, table);
      // onStart, after step 1 has played
      const first = await post(costBody(stepCost(r, 1, { target: 'red', outcome: r.history[0]!.outcome, forced: false, auto: false, ahead: false,
        answers: null, pressAfterMs: null, thinkingMs: null }), 'Mozilla/5.0 (Linux; Android 10; K)', '4.10'));
      expect(first).toEqual({ status: 200, text: 'ok' });
      // onShoot, every SHOOT (up to step 4)
      while (r.phase === 'decide' && r.step < 4) {
        const { step, outcome, failure } = nextOutcome(r);
        const req: SolveRequest = { id: 1, frame: r.frame!, target: nextTarget(r), failure, ctx: { roundCode: r.roundCode, step } };
        const got: Partial<Record<SolveKind, SolveAnswer>> = {};
        solveJob(table, req, ['success', 'failure'], () => 0, (a) => { got[a.kind] = a; });
        const a = got[outcome === 'success' ? 'success' : 'failure']!;
        const sent = await post(costBody(stepCost(r, step, { target: a.target, outcome, forced: false, auto: false, ahead: false,
          answers: { success: got.success, failure: got.failure }, pressAfterMs: 400, thinkingMs: 0 }), 'Mozilla/5.0 (Linux; Android 10; K)', '4.10'));
        expect(sent.status).toBe(200);
        r = shoot(r, solvedProvider(base, a.planned, { target: a.target, outcome }), table, r.frame!.phase === 'colour' ? (a.target as never) : undefined);
      }
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
      played = r.history.length;
      expect(lines.map((l) => l.step)).toEqual(Array.from({ length: played }, (_, i) => i + 1));
      expect(lines[0]).toMatchObject({ step: 1, line: COST_LINE_VERSION, code: r.roundCode, successMs: null, successTried: null,
        failureMs: null, failureTried: null, pressAfterMs: null, thinkingMs: null, presolve: 'P.2' });
      for (const l of lines) { expect(typeof l.u).toBe('number'); expect(typeof l.p).toBe('number'); }
    }
    expect(played).toBeGreaterThanOrEqual(3);
  }, 600_000);
});
