// Night 8: record round fingerprints (same format as bench/night4/fp.test.ts) for a given list of codes, so that the
// proofs compare with the code as it was just before the v4 change (recorded in a checkout of that commit).
// FPSET=codes: IN = a .jsonl file of an earlier run (its codes are replayed) -> OUT.
// FPSET=v4: N new v4 rounds at 6 reds (seeds 7,000,000 + i*7919, random cash-outs / colours as bench/roundCode) -> OUT.
// Compare afterwards with: FP_MODE=compare IN=<OUT> npx vitest run bench/night4/fp.test.ts
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { breakFilesFor, createPhysicsProvider } from '../../src/core/physicsProvider';
import type { LevelId, Round, RngVersion } from '../../src/core/round';
import { parseRoundCode, replayRound, roundCodeOf } from '../../src/core/roundCode';
import { buildTable } from '../../src/core/table/geometry';
import { playRandomRound, recording } from '../../tests/roundCodeLib';

const table = buildTable();
const libs: Record<string, unknown> = {};
const lib = (level: LevelId, rng: RngVersion) => (libs[`${level}-${breakFilesFor(rng)[level]}`] ??= JSON.parse(readFileSync(`public/${breakFilesFor(rng)[level]}`, 'utf8')));
const provider = (level: LevelId, rng: RngVersion) => recording(createPhysicsProvider(table, { [level]: lib(level, rng) } as never), table, level);
const fpOf = (r: Round, tracks: string[]) => ({ tracks: tracks.join('|'), end: JSON.stringify(r.end), balance: r.balance, step: r.step,
  outcomes: r.history.map((h) => `${h.step}:${h.target}:${h.outcome}`).join(' ') });

it('record fingerprints', () => {
  const out = process.env.OUT!;
  writeFileSync(out, '');
  if (process.env.FPSET === 'v4') {
    for (let i = Number(process.env.FROM ?? 0); i < Number(process.env.FROM ?? 0) + Number(process.env.N ?? 100); i++) {
      const seed = 7_000_000 + i * 7919;
      const p = provider('reds6', 4);
      const a = playRandomRound('reds6', seed, p, table, i, 4);
      appendFileSync(out, JSON.stringify({ code: roundCodeOf(a.round), fp: fpOf(a.round, p.tracks), codeAfter: roundCodeOf(a.round) }) + '\n');
    }
    return;
  }
  const codes = readFileSync(process.env.IN!, 'utf8').trim().split('\n').map((l) => JSON.parse(l).code as string);
  for (const code of codes) {
    const c = parseRoundCode(code)!;
    const p = provider(c.levelId!, c.rng);
    const r = replayRound(c, p, table);
    appendFileSync(out, JSON.stringify({ code, fp: fpOf(r, p.tracks), codeAfter: roundCodeOf(r) }) + '\n');
  }
}, 24 * 3_600_000);
