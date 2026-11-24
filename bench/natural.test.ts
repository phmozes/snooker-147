// Task 4.7 report: real rounds (break from the library, then SHOOT every time with the real solver), with every
// success shot labelled by its type. Run: N=30 LEVELS=reds6,reds15 npx vitest run bench/natural.test.ts
// Labels come from re-simulating the played shot (src/core/shotType.ts). Natural = plain pot or a planned pack cannon.
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { classifySuccess, cutAngle, isExhibition, NATURAL_TYPES, naturalCheck, playFacts, type ShotType } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';

it('natural shots in real rounds', () => {
  // measurement only: PATCH='{"solver":{"natural":{"longCost":3}}}' changes config numbers for this run
  const merge = (t: Record<string, unknown>, p: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) merge(t[k] as Record<string, unknown>, v as Record<string, unknown>); else t[k] = v;
    }
  };
  if (process.env.PATCH) merge(CONFIG as unknown as Record<string, unknown>, JSON.parse(process.env.PATCH));
  const table = buildTable();
  const lines: string[] = [];
  const n = Number(process.env.N ?? 30);
  const json: Record<string, unknown> = {};
  for (const level of (process.env.LEVELS ?? 'reds6,reds15').split(',') as LevelId[]) {
    const lib = JSON.parse(readFileSync(`${process.env.LIB_DIR ?? 'public'}/${CONFIG.breakLibrary.files[level]}`, 'utf8'));
    const provider = createPhysicsProvider(table, { [level]: lib });
    const types: Record<string, number> = {};
    const fails: Record<string, number> = {};
    const colours: Record<string, number> = {};
    const durs: number[] = []; const blackDurs: number[] = []; const ms: number[] = []; const speeds: number[] = [];
    let shots = 0; let success = 0; let reRacks = 0; let strict = 0;
    const whyNot: Record<string, number> = {};
    const byTarget: Record<string, number> = {};
    const redDurs: { d: number; last: boolean }[] = []; const colDurs: { d: number; last: boolean }[] = [];
    // shots from the last-resort steps before RE-RACK (exhibition, spray): excluded from the 3.5 s pace limit
    const lastResort = new Set<string>();
    const logLen = () => provider.log.length;
    let seen = 0;
    // positional measures (owner, night 2026-11-24): black shots from behind the black, reds into baulk-end corners, cuts
    let blackShots = 0; let blackBehind = 0; let redPots = 0; let redBaulkCorner = 0; let redBaulkCornerFromTop = 0; const cuts: number[] = [];
    for (let seed = 1; seed <= n; seed++) {
      let r = start(setLevel(newRound(seed * 7 + 3), level), provider, table);
      while (r.phase === 'decide') {
        const before = r.frame!;
        const t0 = performance.now();
        r = shoot(r, provider, table);
        ms.push(performance.now() - t0);
        for (; seen < logLen(); seen++) { const e = provider.log[seen]!; if (e.level === 'exhibition' || e.level === 'spray') lastResort.add(`${e.roundCode}:${e.step}`); }
        shots++;
        const h = r.history[r.history.length - 1]!;
        if (before.phase === 'colour') colours[h.target] = (colours[h.target] ?? 0) + 1;
        if (h.outcome === 'reRack') { reRacks++; success++; continue; }
        const s = h.shot as { dir: { x: number; y: number }; speed: number; spin: number; duration: number; fallback?: string | null; type?: string };
        if (h.outcome !== 'success') { const k = `${h.outcome}${s.fallback ? `->${s.fallback}` : ''}`; fails[k] = (fails[k] ?? 0) + 1; continue; }
        success++;
        const pf = playFacts(before.balls, s, table);
        const potted = pf.potted[0]!;
        const facts = { state: before.balls, target: h.target, potted, aimedPocket: null, events: pf.events, table };
        const t: ShotType = classifySuccess(facts);
        {
          const cueB = before.balls.find((b) => b.kind === 'cue')!.pos;
          const ball = before.balls.find((b) => b.id === potted)!;
          const pe = pf.events.find((e) => e.type === 'pot' && e.a === potted);
          const pk = pe && pe.type === 'pot' ? table.pockets.find((q) => q.id === pe.pocket)! : null;
          if (pk) cuts.push(cutAngle(cueB, ball.pos, pk.mouthMid, table.ballRadius));
          if (h.target === 'black') { blackShots++; if (cueB.y > ball.pos.y) blackBehind++; }
          if (h.target === 'red' && pk) { redPots++; if (pk.id === 'bottomLeft' || pk.id === 'bottomRight') { redBaulkCorner++; if (ball.pos.y > 0) redBaulkCornerFromTop++; } }
        }
        types[t] = (types[t] ?? 0) + 1;
        const lv = provider.log.find((e) => e.roundCode === r.roundCode && e.step === h.step)?.level ?? 'normal';
        if (!NATURAL_TYPES.includes(t)) { const k = `${h.target === 'red' ? 'red' : 'colour'}:${t}:${lv}`; byTarget[k] = (byTarget[k] ?? 0) + 1; }
        const why = naturalCheck(t, { ...facts, duration: pf.duration, cueTravel: pf.cueTravel, after: pf.after });
        if (why === null) strict++; else { const k = NATURAL_TYPES.includes(t) ? why.replace(/[\d.]+/g, '#') : 'not a natural pot type'; whyNot[k] = (whyNot[k] ?? 0) + 1; }
        durs.push(s.duration); speeds.push(s.speed);
        const last = lastResort.has(`${r.roundCode}:${h.step}`);
        (h.target === 'red' ? redDurs : colDurs).push({ d: s.duration, last });
        if (h.target === 'black') blackDurs.push(s.duration);
      }
    }
    const played = success - reRacks;
    const share = (pred: (t: string) => boolean) => Math.round((Object.entries(types).filter(([t]) => pred(t)).reduce((a, [, c]) => a + c, 0) / Math.max(1, played)) * 1000) / 10;
    const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? NaN; };
    const pct = (a: number[], q: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))] ?? NaN; };
    const within = (a: number[]) => Math.round((a.filter((d) => d <= 1.5).length / Math.max(1, a.length)) * 100);
    const pc = (a: number, b: number) => Math.round((a / Math.max(1, b)) * 1000) / 10;
    const position = { blackFromBehind: pc(blackBehind, blackShots), redsBaulkCorner: pc(redBaulkCorner, redPots),
      redsBaulkCornerFromBlackHalf: pc(redBaulkCornerFromTop, redPots), cutMedian: +med(cuts).toFixed(1), cutsOver50: pc(cuts.filter((c) => c > 50).length, cuts.length) };
    const row = {
      level, position, rounds: n, shots, success, reRacks, reRackPct: Math.round((reRacks / Math.max(1, success)) * 1000) / 10,
      natural: Math.round((strict / Math.max(1, played)) * 1000) / 10, naturalOld: share((t) => NATURAL_TYPES.includes(t as ShotType)),
      exhibition: share((t) => isExhibition(t as ShotType)), whyNot, byTarget,
      pace: Object.fromEntries((['red', 'colour'] as const).map((k) => { const a = k === 'red' ? redDurs : colDurs; const d = a.map((x) => x.d);
        return [k, { n: d.length, median: +med(d).toFixed(2), p90: +pct(d, 0.9).toFixed(2), maxNotLastResort: +Math.max(0, ...a.filter((x) => !x.last).map((x) => x.d)).toFixed(2),
          over35: a.filter((x) => !x.last && x.d > 3.5).length }]; })),
      types, fails, colours, median: med(durs), within15: within(durs), over22: durs.filter((d) => d > 2.2).length,
      flex: provider.log.reduce((m, e) => ({ ...m, [e.level]: (m[e.level] ?? 0) + 1 }), {} as Record<string, number>),
      examples: provider.log.filter((e) => e.level === 'exhibition' || e.level === 'spray' || e.level === 'reRack').slice(0, 12).map((e) => `${e.roundCode}:${e.step}${e.level === 'reRack' ? 'R' : ''}`).join(','),
      within25: pc(durs.filter((d) => d <= 2.5).length, durs.length), over35all: durs.filter((d) => d > 3.5).length,
      blackMedian: med(blackDurs), fullPower: speeds.filter((v) => v > 0.85 * CONFIG.physics.maxCueSpeed).length,
      solveMsMedian: Math.round(med(ms)), solveMsP90: Math.round(pct(ms, 0.9)), solveMsMax: Math.round(Math.max(...ms)),
    };
    json[level] = row;
    lines.push(JSON.stringify(row));
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(json, null, 1));
  process.stdout.write(lines.join('\n') + '\n');
}, 3_600_000);
