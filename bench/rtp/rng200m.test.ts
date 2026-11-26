// Night 4, Part 2.3: RNG-only fairness check of generator v2 (HMAC-SHA256), 200,000,000 rounds per level, seeds
// 1..200,000,000, split into SHARDS contiguous seed blocks run in parallel. Uses the game's own stepSucceeds on v2 rounds
// (outcome = seed + step only), no physics. Each shard writes raw counts; bench/rtp/rng200m-sum.mjs adds them up and
// applies the pass rule fixed before the run (|z| < 4 for every cash-out step, every conditional step, every single step).
// Counted per level: reach[k] = rounds whose steps 1..k all succeeded (the money path), and for the independence test,
// over ALL rounds (every step drawn): ok[k] = step k succeeds, both[k] = steps k and k+1 both succeed.
// Run: SHARD=i SHARDS=12 npx vitest run bench/rtp/rng200m.test.ts
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { newRound, setLevel, stepSucceeds, type LevelId } from '../../src/core/round';

it('RNG-only counts for one shard', () => {
  const n = Number(process.env.N ?? 200_000_000);
  const shards = Number(process.env.SHARDS ?? 12);
  const shard = Number(process.env.SHARD ?? 0);
  const base0 = Number(process.env.SEED_BASE ?? 0); // seeds base0+1 .. base0+n
  const from = Math.floor((n * shard) / shards) + 1, to = Math.floor((n * (shard + 1)) / shards);
  const res: Record<string, unknown> = { n, shards, shard, base0, from, to, levels: {} };
  for (const l of CONFIG.levels) {
    const base = setLevel(newRound(1, undefined, 2), l.id as LevelId);
    if (base.rng !== 2) throw new Error('not a v2 round');
    const L = base.ladder.length;
    const reach = new Array<number>(L + 1).fill(0), ok = new Array<number>(L + 1).fill(0), both = new Array<number>(L + 1).fill(0);
    const s = new Array<boolean>(L + 2).fill(false);
    for (let i = from; i <= to; i++) {
      const r = { ...base, seed: base0 + i };
      let chain = true;
      for (let k = 1; k <= L; k++) {
        const v = stepSucceeds(r, k);
        s[k] = v;
        if (v) ok[k]++;
        if (k > 1 && v && s[k - 1]) both[k - 1]++;
        if (chain && v) reach[k]++; else chain = false;
      }
    }
    (res.levels as Record<string, unknown>)[l.id] = { L, p: base.ladder.map((x) => x.p), m: base.ladder.map((x) => x.multiplier), reach, ok, both };
  }
  writeFileSync(`${process.env.DIR ?? 'bench/results/rtp200m'}/shard-${shard}.json`, JSON.stringify(res));
}, 24 * 3_600_000);
