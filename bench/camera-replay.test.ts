// 2026-11-27 camera 57°: proof that the camera never changes a round. Replays v2 and v3 round codes and writes every
// outcome plus a fingerprint of every ball path (frame by frame) to OUT. Run before and after a visual change, then
// compare the two files (they must be identical).
// OUT=bench/results/camera57/replay-before.txt npx vitest run bench/camera-replay.test.ts
import { writeFileSync } from 'node:fs';
import reds6Raw from '../public/breaks/reds6.json?raw';
import reds6V3Raw from '../public/breaks-v3/reds6.json?raw';
import { describe, it } from 'vitest';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { parseRoundCode, replayRound } from '../src/core/roundCode';
import { buildTable } from '../src/core/table/geometry';
import { recording } from '../tests/roundCodeLib';

const table = buildTable();
const libs = { 2: JSON.parse(reds6Raw), 3: JSON.parse(reds6V3Raw) };
const CODES = ['reds6-v2-4242', 'reds6-v2-1001', 'reds6-v2-77-C3', 'reds6-v2-31337-BK',
  'reds6-v3-4242', 'reds6-v3-1001', 'reds6-v3-77-C3', 'reds6-v3-31337-BK', 'reds6-v3-2024', 'reds6-v3-9'];

describe('camera does not change rounds', () => {
  it('replays v2 and v3 codes and writes outcomes + ball path fingerprints', () => {
    const lines: string[] = [];
    for (const c of CODES) {
      const code = parseRoundCode(c)!;
      const p = recording(createPhysicsProvider(table, { reds6: libs[code.rng as 2 | 3] }), table, 'reds6');
      const r = replayRound(code, p, table);
      lines.push(`${c} | ${r.roundCode} | ${r.history.map((h) => h.outcome).join(',')} | end ${JSON.stringify(r.end)}`);
      for (const t of p.tracks) lines.push(`  ${t}`);
    }
    writeFileSync(process.env.OUT ?? 'bench/results/camera57/replay.txt', lines.join('\n') + '\n');
  }, 600000);
});
