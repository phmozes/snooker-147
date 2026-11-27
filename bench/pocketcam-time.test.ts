// Small task 2 (2026-11-27): how much time the pocket-camera slow motion adds to a shot, measured on real game shots
// (the replay-check round codes, every shot after step 1). Visual only: nothing here changes a shot.
// npx vitest run bench/pocketcam-time.test.ts   (writes bench/results/pocketcam/time.txt)
import { writeFileSync } from 'node:fs';
import reds6Raw from '../public/breaks/reds6.json?raw';
import reds6V3Raw from '../public/breaks-v3/reds6.json?raw';
import { describe, it } from 'vitest';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { parseRoundCode, replayRound } from '../src/core/roundCode';
import type { ShotProvider } from '../src/core/round';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { addedSeconds, pickView, planCut } from '../src/view/pocketCam';

const table = buildTable();
const libs = { 2: JSON.parse(reds6Raw), 3: JSON.parse(reds6V3Raw) };
const CODES = ['reds6-v3-4242', 'reds6-v3-1001', 'reds6-v3-77-C3', 'reds6-v3-31337-BK', 'reds6-v3-2024', 'reds6-v3-9',
  'reds6-v3-5', 'reds6-v3-17', 'reds6-v3-123', 'reds6-v3-8080', 'reds6-v3-555', 'reds6-v3-31'];
type Row = { outcome: string; added: number | null; view: string; len: number };

describe('pocket camera: added time per cut', () => {
  it('measures the slow motion on real shots', () => {
    const rows: Row[] = [];
    for (const c of CODES) {
      const code = parseRoundCode(c)!;
      const base = createPhysicsProvider(table, { reds6: libs[code.rng as 2 | 3] });
      const p: ShotProvider = {
        autoColour: base.autoColour?.bind(base), breakAndStep1: base.breakAndStep1.bind(base),
        shot(frame, target, outcome, ctx) {
          const x = base.shot(frame, target, outcome, ctx);
          const s = x.shot as { target?: string; pocket?: PocketId; dir: { x: number; y: number }; speed: number; spin: number } | undefined;
          if (!x.reRack && s) {
            const sim = createSim(frame.balls, table);
            strike(sim, 'cue', s.dir, s.speed, s.spin);
            const rec = recordShot(sim);
            const view = pickView(code.seed, ctx.step, code.rng);
            const cut = s.target && s.pocket ? planCut(rec, table, s.target, s.pocket, view) : null;
            rows.push({ outcome, added: cut ? addedSeconds(cut) : null, view, len: rec.duration });
          }
          return x;
        },
      };
      replayRound(code, p, table);
    }
    const lines: string[] = [];
    const stat = (name: string, rs: Row[]) => {
      const a = rs.filter((r) => r.added !== null).map((r) => r.added!);
      const mean = a.reduce((x, y) => x + y, 0) / (a.length || 1);
      lines.push(`${name}: ${rs.length} shots, ${a.length} with a cut possible, added s: mean ${mean.toFixed(2)}, ` +
        `min ${Math.min(...a).toFixed(2)}, max ${Math.max(...a).toFixed(2)}; shot length mean ${(rs.reduce((x, r) => x + r.len, 0) / (rs.length || 1)).toFixed(2)} s`);
    };
    stat('all', rows);
    stat('success', rows.filter((r) => r.outcome === 'success'));
    for (const o of [...new Set(rows.map((r) => r.outcome))].filter((o) => o !== 'success')) stat(o, rows.filter((r) => r.outcome === o));
    const p1b = rows.filter((r) => r.view === 'P1b').length;
    lines.push(`view pick on these shots: P1b ${p1b}, P2 ${rows.length - p1b}`);
    writeFileSync('bench/results/pocketcam/time.txt', lines.join('\n') + '\n');
    console.log(lines.join('\n'));
  }, 600000);
});
