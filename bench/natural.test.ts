// Task 4.7 report: real rounds (break from the library, then SHOOT every time with the real solver), with every
// success shot labelled by its type. Run: N=30 LEVELS=reds6,reds15 npx vitest run bench/natural.test.ts
// Labels come from re-simulating the played shot (src/core/shotType.ts). Natural = plain pot or a planned pack cannon.
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { createPhysicsProvider } from '../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, type LevelId } from '../src/core/round';
import { classifySuccess, isExhibition, NATURAL_TYPES, type ShotType } from '../src/core/shotType';
import { buildTable } from '../src/core/table/geometry';

it('natural shots in real rounds', () => {
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
    let shots = 0; let success = 0; let reRacks = 0;
    for (let seed = 1; seed <= n; seed++) {
      let r = start(setLevel(newRound(seed * 7 + 3), level), provider, table);
      while (r.phase === 'decide') {
        const before = r.frame!;
        const t0 = performance.now();
        r = shoot(r, provider, table);
        ms.push(performance.now() - t0);
        shots++;
        const h = r.history[r.history.length - 1]!;
        if (before.phase === 'colour') colours[h.target] = (colours[h.target] ?? 0) + 1;
        if (h.outcome === 'reRack') { reRacks++; success++; continue; }
        const s = h.shot as { dir: { x: number; y: number }; speed: number; spin: number; duration: number; fallback?: string | null; type?: string };
        if (h.outcome !== 'success') { const k = `${h.outcome}${s.fallback ? `->${s.fallback}` : ''}`; fails[k] = (fails[k] ?? 0) + 1; continue; }
        success++;
        const sim = createSim(before.balls, table);
        strike(sim, 'cue', s.dir, s.speed, s.spin);
        runUntilStill(sim);
        const potted = sim.balls.find((b) => b.potted)!.id;
        const t: ShotType = classifySuccess({ state: before.balls, target: h.target, potted, aimedPocket: null, events: sim.events, table });
        types[t] = (types[t] ?? 0) + 1;
        durs.push(s.duration); speeds.push(s.speed);
        if (h.target === 'black') blackDurs.push(s.duration);
      }
    }
    const played = success - reRacks;
    const share = (pred: (t: string) => boolean) => Math.round((Object.entries(types).filter(([t]) => pred(t)).reduce((a, [, c]) => a + c, 0) / Math.max(1, played)) * 1000) / 10;
    const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] ?? NaN; };
    const pct = (a: number[], q: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))] ?? NaN; };
    const within = (a: number[]) => Math.round((a.filter((d) => d <= 1.5).length / Math.max(1, a.length)) * 100);
    const row = {
      level, rounds: n, shots, success, reRacks, reRackPct: Math.round((reRacks / Math.max(1, success)) * 1000) / 10,
      natural: share((t) => NATURAL_TYPES.includes(t as ShotType)), exhibition: share((t) => isExhibition(t as ShotType)),
      types, fails, colours, median: med(durs), within15: within(durs), over22: durs.filter((d) => d > 2.2).length,
      flex: provider.log.reduce((m, e) => ({ ...m, [e.level]: (m[e.level] ?? 0) + 1 }), {} as Record<string, number>),
      examples: provider.log.filter((e) => e.level === 'exhibition' || e.level === 'spray' || e.level === 'reRack').slice(0, 12).map((e) => `${e.roundCode}:${e.step}${e.level === 'reRack' ? 'R' : ''}`).join(','),
      blackMedian: med(blackDurs), fullPower: speeds.filter((v) => v > 0.85 * CONFIG.physics.maxCueSpeed).length,
      solveMsMedian: Math.round(med(ms)), solveMsP90: Math.round(pct(ms, 0.9)), solveMsMax: Math.round(Math.max(...ms)),
    };
    json[level] = row;
    lines.push(JSON.stringify(row));
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(json, null, 1));
  process.stdout.write(lines.join('\n') + '\n');
}, 3_600_000);
