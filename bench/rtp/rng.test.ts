// Night 3, task 2: RNG-only RTP. N rounds per level (default 2 million) use the game's own outcome draw
// (stepSucceeds: u from the seed vs p of the step), no physics. For each fixed cash-out step k the measured return is
// compared with the formula RTP(k) = multiplier(k) x p(1) x ... x p(k). Tolerance: 4 standard errors.
// Run: N=2000000 npx vitest run bench/rtp/rng.test.ts -> bench/results/rtp-rng.txt
import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { newRound, setLevel, stepSucceeds, type LevelId } from '../../src/core/round';

it('RNG-only RTP matches the formula', () => {
  const n = Number(process.env.N ?? 2_000_000);
  const out: string[] = [`RNG-only RTP, ${n} rounds per level, seeds 1..${n} (outcome = seed + step only)`];
  let bad = 0;
  for (const l of CONFIG.levels) {
    const base = setLevel(newRound(1), l.id as LevelId);
    const L = base.ladder.length;
    const reach = new Array<number>(L + 1).fill(0); // reach[k]: rounds whose steps 1..k all succeeded
    for (let s = 1; s <= n; s++) {
      const r = { ...base, seed: s };
      let k = 0;
      while (k < L && stepSucceeds(r, k + 1)) k++;
      for (let j = 1; j <= k; j++) reach[j]!++;
    }
    let prod = 1;
    const cells: string[] = [];
    let worst = 0;
    for (let k = 1; k <= L; k++) {
      const m = base.ladder[k - 1]!.multiplier;
      prod *= base.ladder[k - 1]!.p;
      const formula = m * prod;
      const measured = (m * reach[k]!) / n;
      const se = m * Math.sqrt((prod * (1 - prod)) / n);
      const z = (measured - formula) / se;
      worst = Math.max(worst, Math.abs(z));
      if (Math.abs(z) > 4) bad++;
      cells.push(`${k}:${(measured * 100).toFixed(2)}/${(formula * 100).toFixed(2)}`);
    }
    out.push(`${l.id}: worst |z| ${worst.toFixed(2)} (limit 4) | step:measured%/formula% ${cells.join(' ')}`);
  }
  writeFileSync(process.env.OUT ?? 'bench/results/rtp-rng.txt', out.join('\n') + '\n');
  expect(bad).toBe(0);
}, 6 * 3_600_000);
