// Task 4.9: find rounds where the new red position (config solver.natural.redPlay) is clearly visible, for the owner to
// watch on the phone (?seed=<round code>). The same round is played with the red rules on and off; at the first colour
// step where they differ, report it when the new version leaves a comfortable red (cut <= 35, a near pocket, not on a
// side cushion) and the old one did not. Run: N=20 LEVELS=reds6,reds10 npx vitest run bench/redPosition-examples.test.ts
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId, type Round } from '../src/core/round';
import { cutAngle, playFacts } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';

it('red position examples', () => {
  const table = buildTable();
  const RP = CONFIG.solver.natural.redPlay;
  const n = Number(process.env.N ?? 20);
  const out: string[] = [];
  for (const level of (process.env.LEVELS ?? 'reds6,reds10').split(',') as LevelId[]) {
    const lib = JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const play = (seed: number, on: boolean) => {
      const keep = RP.maxCost;
      if (!on) (RP as { maxCost: number }).maxCost = 0;
      const provider = createPhysicsProvider(table, { [level]: lib });
      const states: Round[] = [];
      let r = start(setLevel(newRound(seed), level), provider, table);
      while (r.phase === 'decide') { states.push(r); r = shoot(r, provider, table); }
      states.push(r);
      (RP as { maxCost: number }).maxCost = keep;
      return states;
    };
    // the red shot played after a colour: how it looks from where the colour left the cue ball
    const redLook = (s: Round[], i: number) => {
      const before = s[i]!.frame!; const h = s[i + 1]!.history.at(-1)!;
      if (h.target !== 'red' || h.outcome !== 'success' || !h.shot) return null;
      const pf = playFacts(before.balls, h.shot as never, table);
      const pe = pf.events.find((e) => e.type === 'pot');
      if (!pe || pe.type !== 'pot') return null;
      const cue = before.balls.find((b) => b.kind === 'cue')!.pos; const red = before.balls.find((b) => b.id === pe.a)!.pos;
      const pk = table.pockets.find((q) => q.id === pe.pocket)!;
      const d = (q: typeof pk) => Math.hypot(q.mouthMid.x - red.x, q.mouthMid.y - red.y);
      const near = [...table.pockets].sort((a, b) => d(a) - d(b)).slice(0, 2).includes(pk);
      const cut = cutAngle(cue, red, pk.mouthMid, table.ballRadius);
      const side = table.halfWidth - Math.abs(cue.x) <= RP.sideCushionM;
      return { good: cut <= 35 && (near || red.y <= 0) && !side, text: `cut ${cut.toFixed(0)} ${pk.id}${near ? '' : ' (far)'}${side ? ' side cushion' : ''}` };
    };
    const from = Number(process.env.SEED_FROM ?? 0);
    for (let k = from + 1; k <= from + n; k++) {
      const seed = k * 7 + 3;
      const a = play(seed, true); const b = play(seed, false);
      for (let i = 0; i + 1 < Math.min(a.length, b.length); i++) {
        const ha = a[i + 1]!.history.at(-1)!; const hb = b[i + 1]!.history.at(-1)!;
        if (JSON.stringify(ha.shot) === JSON.stringify(hb.shot)) continue;
        // first different shot: a colour shot; compare the red after it
        if (ha.target !== 'red' && i + 2 < Math.min(a.length, b.length)) {
          const la = redLook(a, i + 1); const lb = redLook(b, i + 1);
          if (la && lb && la.good && !lb.good) out.push(`${a[0]!.roundCode} colour step ${ha.step} (${ha.target}), red step ${ha.step + 1}: new ${la.text} | old ${lb.text}`);
        }
        break;
      }
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}, 3_600_000);
