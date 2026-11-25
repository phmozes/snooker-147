// Option 3c calculator (owner 2026-11-25). Run: npx vitest run bench/rtp/option3c.test.ts
// Writes bench/results/option3c.txt (the p table that went into the config, and the RTP per step).
// Multipliers unchanged. Step by step from step 1: p(k) = option 3 value (cash-out RTP exactly 97%) if it is strictly
// lower than p(k-1); otherwise p(k) = p(k-1) - 0.0001 (RTP at that step slightly below 97%, never above).
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { linearMultipliers } from '../../src/core/ladder';

it('option 3c table', () => {
  const T = CONFIG.ladder.targetRtp;
  const out: string[] = [];
  for (const l of CONFIG.levels) {
    const mult = linearMultipliers(l.id);
    const p: number[] = [];
    let reach = 1;
    const rtps: string[] = [];
    for (let k = 0; k < mult.length; k++) {
      let pk = T / mult[k]! / reach; // option 3: reach after this step = T / multiplier
      if (k > 0 && !(pk < p[k - 1]!)) pk = p[k - 1]! - 0.0001;
      p.push(pk);
      reach *= pk;
      rtps.push(`${k + 1}:${(reach * mult[k]! * 100).toFixed(3)}`);
    }
    out.push(`${l.id} p: [${p.join(', ')}]`);
    out.push(`${l.id} rtp below 97.000: ${rtps.filter((r) => !r.endsWith(':97.000')).join(' ') || 'none'}`);
    out.push(`${l.id} table: ${p.map((x, i) => `${i + 1}:x${mult[i]} ${(x * 100).toFixed(2)}`).join(' | ')}`);
  }
  writeFileSync('bench/results/option3c.txt', out.join('\n') + '\n');
});
