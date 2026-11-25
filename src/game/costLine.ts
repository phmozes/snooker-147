// Task P.1 (dev only): one phone cost line, rebuilt from plain numbers and short texts before the dev server
// (vite.config.ts) appends it to bench/results/phone-cost.jsonl. No Node imports, so tests can load it.

/** Only short plain values (letters, digits, - . : and spaces). */
const clean = (v: unknown, max = 40) => String(v ?? '').replace(/[^\w.:\- ]/g, '').slice(0, max);
/** The outcome draw (u from the seed, p of the step): a number from 0 to 1, else null. */
const frac = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? +v.toFixed(6) : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
export function costLine(m: Record<string, unknown>, uaHeader: string, time: string) {
  const code = String(m.code);
  if (!/^reds\d+-\d+$/.test(code)) throw new Error('bad round code');
  return JSON.stringify({ time, code, step: num(m.step), target: clean(m.target, 10), outcome: clean(m.outcome, 16),
    forced: m.forced === true, auto: m.auto === true, ahead: m.ahead === true, presolve: clean(m.presolve, 8),
    successMs: num(m.successMs), successTried: num(m.successTried), failureMs: num(m.failureMs), failureTried: num(m.failureTried),
    u: frac(m.u), p: frac(m.p), pressAfterMs: num(m.pressAfterMs), thinkingMs: num(m.thinkingMs), solver: clean(m.solver, 8),
    ua: String(m.ua ?? uaHeader).replace(/[^\w.:;,()/\- ]/g, '').slice(0, 200) });
}
