// RNG-only RTP, decisive run (owner 2026-11-26): 50,000,000 rounds per level on seeds 5,000,000,001 and up, split into
// SHARDS contiguous seed blocks run in parallel. Uses the game's own stepSucceeds (outcome = seed + step only), no physics.
// Each shard writes raw counts; bench/rtp/rng50m-sum.mjs adds them up and applies the pass rule (|z| < 3, every step).
// Counted per level: reach[k] = rounds whose steps 1..k all succeeded (the money path), and for the independence test,
// over ALL rounds (every step drawn): ok[k] = step k succeeds, both[k] = steps k and k+1 both succeed.
// Run: SHARD=i SHARDS=12 npx vitest run bench/rtp/rng50m.test.ts
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { newRound, setLevel, stepSucceeds, type LevelId } from '../../src/core/round';

it('RNG-only counts for one shard', () => {
  const n = Number(process.env.N ?? 50_000_000);
  const shards = Number(process.env.SHARDS ?? 12);
  const shard = Number(process.env.SHARD ?? 0);
  const base0 = Number(process.env.SEED_BASE ?? 5_000_000_000); // seeds base0+1 .. base0+n
  const from = Math.floor((n * shard) / shards) + 1, to = Math.floor((n * (shard + 1)) / shards);
  const res: Record<string, unknown> = { n, shards, shard, base0, from, to, levels: {} };
  for (const l of CONFIG.levels) {
    const base = setLevel(newRound(1), l.id as LevelId);
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
  writeFileSync(`bench/results/rtp50m/shard-${shard}.json`, JSON.stringify(res));
}, 12 * 3_600_000);
