// Run with: npm run bench   (not part of npm test: it takes a while and prints a report)
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { paceLayouts, paceStudy, speedBenchmark, withFriction } from '../src/core/physics/bench';
import { buildTable } from '../src/core/table/geometry';

it('speed benchmark and pace study', () => {
  const table = buildTable();
  const now = () => performance.now();
  const lines: string[] = ['', 'SPEED (random full-rack shots, until every ball stops)', 'friction  reds  ms/shot  game s/shot  steps/shot'];
  speedBenchmark(table, CONFIG.physics, now, 15, 20); // warm-up
  for (const f of CONFIG.dev.bench.paceFrictions) {
    for (const reds of [6, 15]) {
      const r = speedBenchmark(table, withFriction(f), now, reds);
      lines.push(`${f.toFixed(3).padEnd(9)} ${String(reds).padEnd(5)} ${r.msPerShot.toFixed(3).padEnd(8)} ${r.simSecondsPerShot.toFixed(2).padEnd(12)} ${r.stepsPerShot.toFixed(0)}`);
    }
  }
  lines.push('', `PACE (quickest potting shot per layout, ${CONFIG.dev.bench.paceLayouts} layouts, cut <= ${CONFIG.dev.bench.paceMaxCutDeg} deg)`,
    'friction  potted  median settle  median pot  settle <= 1.5 s  at 1.3x playback  computer time');
  const layouts = paceLayouts(table);
  for (const f of CONFIG.dev.bench.paceFrictions) {
    const p = paceStudy(table, withFriction(f), now, layouts);
    lines.push(`${f.toFixed(3).padEnd(9)} ${`${p.potted}/${p.layouts}`.padEnd(7)} ${`${p.medianSettle.toFixed(2)} s`.padEnd(14)} ${`${p.medianPot.toFixed(2)} s`.padEnd(11)} ${`${Math.round(p.withinMax * 100)}%`.padEnd(16)} ${`${(p.medianSettle / 1.3).toFixed(2)} s`.padEnd(17)} ${(p.msTotal / 1000).toFixed(1)} s`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}, 600_000);
