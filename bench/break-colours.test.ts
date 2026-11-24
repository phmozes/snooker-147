// How far the opponent's break-off moves the baulk colours and the blue, per library file (task 4.7 follow-up).
// Run: npx vitest run bench/break-colours.test.ts
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { coloursMovedByBreak, type BreakEntry } from '../src/core/breakLibrary';
import { buildTable } from '../src/core/table/geometry';

it('break colours', () => {
  const table = buildTable();
  const out: string[] = [];
  for (const level of CONFIG.levels) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level.id]}`, 'utf8')) as Record<string, BreakEntry[]>;
    for (const kind of ['redPottable', 'snookered']) {
      const moved = lib[kind]!.map((e) => coloursMovedByBreak(e.after, table));
      const over = moved.filter((m) => m > CONFIG.breakLibrary.maxColourMove).length;
      out.push(`${level.id} ${kind}: ${over} of ${moved.length} move yellow/green/brown/blue more than ${CONFIG.breakLibrary.maxColourMove * 100} cm (largest ${(Math.max(...moved) * 100).toFixed(0)} cm)`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
});
