// Builds the break-off library files: npm run breaks  (about 5 minutes). Output: public/breaks/<level>.json
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { buildBreaks } from '../src/core/breakLibrary';
import { buildTable } from '../src/core/table/geometry';

it('generate the break-off library', () => {
  const table = buildTable();
  const lines: string[] = [];
  for (const level of CONFIG.levels.filter((l) => !process.env.LEVELS || process.env.LEVELS.split(',').includes(l.id))) {
    const t0 = performance.now();
    const n = Number(process.env.N ?? CONFIG.breakLibrary.perLevelPerKind);
    const pot = buildBreaks(level.reds, 'redPottable', n, table, CONFIG.breakLibrary.seed + level.reds);
    const snk = buildBreaks(level.reds, 'snookered', n, table, CONFIG.breakLibrary.seed + 1000 + level.reds);
    const file = `${process.env.OUT_DIR ?? 'public'}/${CONFIG.breakLibrary.files[level.id]}`;
    writeFileSync(file, JSON.stringify({ level: level.id, reds: level.reds, redPottable: pot.entries, snookered: snk.entries }));
    lines.push(`${level.id}: redPottable ${pot.entries.length} (${pot.attempts} breaks tried), snookered ${snk.entries.length} (${snk.attempts} tried), ${((performance.now() - t0) / 1000).toFixed(0)} s -> ${file}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}, 3_600_000);
