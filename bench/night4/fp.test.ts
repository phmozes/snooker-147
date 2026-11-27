// Night 4: fingerprints of whole rounds (every trajectory frame by frame, the end, the balance), to prove that a change
// leaves shots and outcomes identical. FP_MODE=record writes one JSON line per round to OUT; FP_MODE=compare replays every
// code in IN from the code alone and checks the fingerprint is the same.
// Sets (SET): marks = the owner's marks in docs/WEIRD-SHOTS.md; roundcode = the 100 rounds per level of
// bench/roundCode.test.ts (seeds 7,000,000 + i*7919, random cash-outs / colours); natural = seeds FROM..FROM+N-1, no
// cash-out, automatic colours. LEVEL limits to one level (to run levels in parallel).
// Run: FP_MODE=record SET=natural LEVEL=reds6 N=200 OUT=... npx vitest run bench/night4/fp.test.ts
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { createPhysicsProvider } from '../../src/core/physicsProvider';
import { type LevelId, type Round } from '../../src/core/round';
import { parseRoundCode, replayRound, roundCodeOf } from '../../src/core/roundCode';
import { buildTable } from '../../src/core/table/geometry';
import { playRandomRound, recording } from '../../tests/roundCodeLib';

const table = buildTable();
const libs: Record<string, unknown> = {};
const lib = (level: LevelId) => (libs[level] ??= JSON.parse(readFileSync(`public/${CONFIG.breakLibrary.files[level]}`, 'utf8')));
const provider = (level: LevelId) => recording(createPhysicsProvider(table, { [level]: lib(level) } as never), table, level);
const fpOf = (r: Round, tracks: string[]) => ({ tracks: tracks.join('|'), end: JSON.stringify(r.end), balance: r.balance, step: r.step,
  outcomes: r.history.map((h) => `${h.step}:${h.target}:${h.outcome}`).join(' ') });

function replay(code: string) {
  const c = parseRoundCode(code)!;
  const level = c.levelId!;
  const p = provider(level);
  const r = replayRound(c, p, table);
  return { code, fp: fpOf(r, p.tracks), codeAfter: roundCodeOf(r) };
}

it('round fingerprints', () => {
  const mode = process.env.FP_MODE ?? 'record';
  const levels = (process.env.LEVEL ?? 'reds6,reds10,reds15').split(',') as LevelId[];
  if (mode === 'record') {
    const set = process.env.SET ?? 'natural';
    const out = process.env.OUT!;
    writeFileSync(out, '');
    const n = Number(process.env.N ?? 200), from = Number(process.env.FROM ?? 1);
    if (set === 'marks') {
      const codes = [...new Set(readFileSync('docs/WEIRD-SHOTS.md', 'utf8').match(/reds\d+-\d+(?:-[YGNBPK]+)?(?:-C\d+)?/g) ?? [])];
      for (const code of codes) if (levels.includes(parseRoundCode(code)!.levelId!)) appendFileSync(out, JSON.stringify(replay(code)) + '\n');
    }
    for (const level of levels) {
      for (let i = 0; i < n && set !== 'marks'; i++) {
        if (set === 'roundcode') {
          const seed = 7_000_000 + i * 7919;
          const p = provider(level);
          const a = playRandomRound(level, seed, p, table, i);
          appendFileSync(out, JSON.stringify({ code: roundCodeOf(a.round), fp: fpOf(a.round, p.tracks), codeAfter: roundCodeOf(a.round) }) + '\n');
        } else appendFileSync(out, JSON.stringify(replay(`${level}-${from + i}`)) + '\n');
      }
    }
  } else {
    const lines = readFileSync(process.env.IN!, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    let same = 0, failMoved = 0, diff: string[] = [];
    // 2026-11-27 CMP=outcomes: everything must match except the trajectory of failure shots (the failure-shot choice
    // changed on purpose); their label (step, target, outcome) must still match. NMAX: only the first NMAX per level.
    const outcomesOnly = process.env.CMP === 'outcomes';
    const strip = (fp: { tracks: string }) => ({ ...fp, tracks: fp.tracks.split('|')
      .map((t) => (/ (success|RE-RACK)/.test(t) || t.startsWith('break') || t.startsWith('step1') ? t : t.replace(/ [0-9a-f:]+$/, ' (failure shot)'))).join('|') });
    const nmax = Number(process.env.NMAX ?? Infinity);
    const per: Record<string, number> = {};
    for (const l of lines) {
      const lv = parseRoundCode(l.code)!.levelId!;
      if (!levels.includes(lv) || (per[lv] = (per[lv] ?? 0) + 1) > nmax) continue;
      const b = replay(l.code);
      const A = outcomesOnly ? strip(b.fp) : b.fp, B = outcomesOnly ? strip(l.fp) : l.fp;
      if (JSON.stringify(A) === JSON.stringify(B) && b.codeAfter === l.codeAfter) same++; else diff.push(l.code);
      if (outcomesOnly && b.fp.tracks !== l.fp.tracks) failMoved++;
    }
    const msg = `${process.env.IN} [${levels}]: ${same} identical${outcomesOnly ? ` (outcomes + success shots; failure shot moved in ${failMoved})` : ''}, ${diff.length} different ${diff.slice(0, 20).join(' ')}`;
    console.log(msg);
    if (process.env.OUT) appendFileSync(process.env.OUT, msg + '\n');
    expect(diff).toEqual([]);
  }
}, 24 * 3_600_000);
