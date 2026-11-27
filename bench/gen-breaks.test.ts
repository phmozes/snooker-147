// Builds the break-off library files: npm run breaks  (about 5 minutes per level). Output (night 6): the v3 library,
// cue ball ON the baulk line (RULES B.1), in public/breaks-v3/<level>.json, tagged version 3.
// START=d rebuilds the old library instead (cue ball anywhere in the D; v1 / v2 rounds), to public/breaks/<level>.json.
// LEVELS=reds6,reds10 builds only those levels (one process per level runs them in parallel).
// Night 8: the v4 6-red library is built by bench/night8/gen-v4.sh (11 parallel chunks) + bench/night8/merge-v4.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { buildBreaks, type BreakStart } from '../src/core/breakLibrary';
import { buildTable } from '../src/core/table/geometry';

it('generate the break-off library', () => {
  const table = buildTable();
  const start: BreakStart = process.env.START === 'd' ? 'd' : 'baulkLine';
  const files = start === 'd' ? CONFIG.breakLibrary.files : CONFIG.breakLibrary.filesV3;
  const lines: string[] = [];
  for (const level of CONFIG.levels.filter((l) => !process.env.LEVELS || process.env.LEVELS.split(',').includes(l.id))) {
    const t0 = performance.now();
    const n = Number(process.env.N ?? CONFIG.breakLibrary.perLevelPerKind);
    const pot = buildBreaks(level.reds, 'redPottable', n, table, CONFIG.breakLibrary.seed + level.reds, undefined, undefined, start);
    const snk = buildBreaks(level.reds, 'snookered', n, table, CONFIG.breakLibrary.seed + 1000 + level.reds, undefined, undefined, start);
    const file = `${process.env.OUT_DIR ?? 'public'}/${files[level.id]}`;
    mkdirSync(dirname(file), { recursive: true });
    const tag = start === 'd' ? {} : { version: 3 };
    writeFileSync(file, JSON.stringify({ level: level.id, reds: level.reds, ...tag, redPottable: pot.entries, snookered: snk.entries }));
    lines.push(`${level.id}: redPottable ${pot.entries.length} (${pot.attempts} breaks tried), snookered ${snk.entries.length} (${snk.attempts} tried), ${((performance.now() - t0) / 1000).toFixed(0)} s -> ${file}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}, 3_600_000);
