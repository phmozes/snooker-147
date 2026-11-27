// Night 8: one chunk of the v4 6-red break-off library (redPottable, v4 rules). FROM / TO = attempt indices [FROM, TO);
// OUT = the chunk file (every accepted entry with its attempt index). bench/night8/merge-v4.mjs merges the chunks in
// index order and keeps the first 200: the same list one process trying 0, 1, 2 ... would build.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { buildBreaks } from '../../src/core/breakLibrary';
import { buildTable } from '../../src/core/table/geometry';

it('v4 library chunk', () => {
  const table = buildTable();
  const from = Number(process.env.FROM ?? 0), to = Number(process.env.TO ?? 1000);
  const rejected: Record<string, number> = {};
  const t0 = performance.now();
  const r = buildBreaks(6, 'redPottable', 200, table, CONFIG.breakLibrary.seed + 6, undefined, undefined, 'baulkLine',
    { rules: CONFIG.breakLibrary.v4Rules, from, to, rejected });
  writeFileSync(process.env.OUT ?? `bench/results/night8/v4chunk-${from}.json`, JSON.stringify({ from, to, rejected,
    seconds: (performance.now() - t0) / 1000, indices: r.indices, entries: r.entries }));
}, 36_000_000);
