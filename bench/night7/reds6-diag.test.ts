// Night 7 diagnosis (owner): why 6 reds plays worse with the v3 break-off. Nothing in the game changes here.
// PART=lib    : old vs v3 break library (how open the pack is, pottable reds, cue ball end, reds glued to the pink /
//               a cushion), joined with the 1,000-round soaks (v3: night6/soak, old: soak-n4pos = v2 with 4.11p, same
//               seeds and outcomes) by break entry, grouped by start side and break speed.
// PART=rerack : replay the RE-RACK rounds and print the table before the failing shot.
// Run: PART=lib npx vitest run bench/night7/reds6-diag.test.ts   (OUT=file writes the text too)
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { pottableReds } from '../../src/core/breakLibrary';
import { createPhysicsProvider } from '../../src/core/physicsProvider';
import { newRound, setLevel, shoot, start, startRound, stepSucceeds, streamValue, type Round, type RngVersion } from '../../src/core/round';
import { allRedsLocked, clusteredReds } from '../../src/core/shotType';
import { buildTable } from '../../src/core/table/geometry';
import type { Ball } from '../../src/core/types';

const table = buildTable();
const R = table.ballRadius;
const LEVEL = 'reds6' as const;
const out: string[] = [];
const say = (s: string) => out.push(s);
const lib = (v: 'old' | 'v3') => JSON.parse(readFileSync(`public/${v === 'v3' ? CONFIG.breakLibrary.filesV3[LEVEL] : CONFIG.breakLibrary.files[LEVEL]}`, 'utf8'));
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)]! : NaN; };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const f2 = (x: number) => x.toFixed(2);
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;
const gap = (a: Ball, b: Ball) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) - 2 * R;
const cushionGap = (b: Ball) => Math.min(table.halfWidth - Math.abs(b.pos.x), table.halfLength - Math.abs(b.pos.y)) - R;

interface Entry { cueStart: { x: number; y: number }; breakShot: { speed: number; spin: number; dir: { x: number; y: number } }; after: Ball[] }
function facts(e: Entry) {
  const after = e.after;
  const reds = after.filter((b) => b.kind === 'red');
  const pink = after.find((b) => b.kind === 'pink')!;
  const black = after.find((b) => b.kind === 'black')!;
  const cue = after.find((b) => b.kind === 'cue')!;
  return {
    side: e.cueStart.x < 0 ? 'green' : 'yellow',
    speed: e.breakShot.speed,
    packed: clusteredReds(after, R).size,
    pottable: pottableReds({ balls: after } as never, table),
    redOnPink: reds.filter((r) => gap(r, pink) < 0.003).length, // a red touching (3 mm) the pink
    // reds no pocket can take (path or ghost-ball spot blocked; the other reds count as blockers): only a cannon frees them
    locked: reds.filter((r) => allRedsLocked(after.map((b) => (b.kind === 'red' && b.id !== r.id ? { ...b, kind: 'black' as const } : b)), table)).length,
    redOnBlack: reds.filter((r) => gap(r, black) < 0.003).length,
    redOnCushion: reds.filter((r) => cushionGap(r) < 0.003).length,
    redsTopEnd: reds.filter((r) => r.pos.y > table.spots.pink.y).length, // reds above the pink spot (black end)
    cueY: cue.pos.y,
    pinkMoved: Math.hypot(pink.pos.x - table.spots.pink.x, pink.pos.y - table.spots.pink.y),
    blackMoved: Math.hypot(black.pos.x - table.spots.black.x, black.pos.y - table.spots.black.y),
  };
}
type Facts = ReturnType<typeof facts>;

function describeLib(name: string, list: Entry[]) {
  const F = list.map(facts);
  say(`${name}: ${F.length} breaks | packed reds after break med ${med(F.map((f) => f.packed))} mean ${f2(mean(F.map((f) => f.packed)))} of 6` +
    ` | pottable reds at step 1 med ${med(F.map((f) => f.pottable))} mean ${f2(mean(F.map((f) => f.pottable)))}` +
    ` | red touching pink ${pct(F.filter((f) => f.redOnPink).length, F.length)}, black ${pct(F.filter((f) => f.redOnBlack).length, F.length)}, cushion ${pct(F.filter((f) => f.redOnCushion).length, F.length)}` +
    ` | locked reds (no pocket) mean ${f2(mean(F.map((f) => f.locked)))}, breaks with one ${pct(F.filter((f) => f.locked).length, F.length)}` +
    ` | reds above the pink mean ${f2(mean(F.map((f) => f.redsTopEnd)))}` +
    ` | cue ball end y med ${f2(med(F.map((f) => f.cueY)))} (top half ${pct(F.filter((f) => f.cueY > 0).length, F.length)})` +
    ` | pink moved med ${f2(med(F.map((f) => f.pinkMoved)))} m, black ${f2(med(F.map((f) => f.blackMoved)))} m` +
    ` | start side green ${F.filter((f) => f.side === 'green').length} / yellow ${F.filter((f) => f.side === 'yellow').length}` +
    ` | speed ${f2(Math.min(...F.map((f) => f.speed)))}-${f2(Math.max(...F.map((f) => f.speed)))}`);
  return F;
}

/** Per soak round: which list and entry the break came from (same draw as startRound, no solving). */
function entryOf(seed: number, rng: RngVersion, n: { redPottable: number; snookered: number }) {
  const r0 = setLevel(newRound(seed, undefined, rng), LEVEL);
  const r = { ...r0, phase: 'decide' as const, step: 0 } as Round;
  const ok = stepSucceeds(r, 1);
  const outcome = ok ? 'success' : streamValue(seed, 'break', 1, rng) < CONFIG.failures.step1.plainMiss ? 'plainMiss' : 'snookered';
  const kind = outcome === 'snookered' ? 'snookered' : 'redPottable';
  return { kind, i: Math.floor(streamValue(seed, 'variety', 0, rng) * n[kind]) } as const;
}

interface RoundLog { long: number; reRack: boolean; shots: number; natural23: number; n23: number; fb: number }
function soakRounds(dir: string): Map<string, RoundLog> {
  const m = new Map<string, RoundLog>();
  for (let s = 0; s < 4; s++) {
    for (const line of readFileSync(`bench/results/${dir}/reds6-${s}-shots.jsonl`, 'utf8').split('\n').filter(Boolean)) {
      const l = JSON.parse(line);
      const seed = Number(/(\d+)$/.exec(l.code)![1]);
      const k = String(seed);
      const g = m.get(k) ?? { long: 0, reRack: false, shots: 0, natural23: 0, n23: 0, fb: 0 };
      g.shots++;
      if (l.outcome === 'reRack') g.reRack = true;
      if (l.outcome === 'success' && l.d > 3.5 && l.flex !== 'exhibition' && l.flex !== 'rescue') g.long++;
      if (l.outcome === 'success' && l.flex) g.fb++;
      if (l.outcome === 'success' && (l.step === 2 || l.step === 3)) { g.n23++; if (!l.flex) g.natural23++; }
      m.set(k, g);
    }
  }
  return m;
}

function joined(name: string, dir: string, rng: RngVersion, L: { redPottable: Entry[]; snookered: Entry[] }, F: Facts[]) {
  const rounds = soakRounds(dir);
  const rows: { f: Facts; g: RoundLog }[] = [];
  for (const [seedS, g] of rounds) {
    const e = entryOf(Number(seedS), rng, { redPottable: L.redPottable.length, snookered: L.snookered.length });
    if (e.kind !== 'redPottable') continue;
    rows.push({ f: F[e.i]!, g });
  }
  const sum = (sel: typeof rows) => {
    const n23 = sel.reduce((a, r) => a + r.g.n23, 0);
    const shots = sel.reduce((a, r) => a + r.g.shots, 0);
    return `${sel.length} rounds, ${shots} shots: long ${sel.reduce((a, r) => a + r.g.long, 0)} (${f2((1000 * sel.reduce((a, r) => a + r.g.long, 0)) / Math.max(1, shots))} per 1,000 shots)` +
      `, RE-RACK ${sel.filter((r) => r.g.reRack).length}, success with a fallback ${pct(sel.reduce((a, r) => a + r.g.fb, 0), sel.reduce((a, r) => a + r.g.shots, 0))}` +
      `, steps 2-3 natural ${pct(sel.reduce((a, r) => a + r.g.natural23, 0), n23)}`;
  };
  say(`\n${name} (soak ${dir}, rounds whose break came from the redPottable list):`);
  say(`  all            ${sum(rows)}`);
  say(`  green side     ${sum(rows.filter((r) => r.f.side === 'green'))}`);
  say(`  yellow side    ${sum(rows.filter((r) => r.f.side === 'yellow'))}`);
  const sp = rows.map((r) => r.f.speed).sort((a, b) => a - b);
  const t1 = sp[Math.floor(sp.length / 3)]!, t2 = sp[Math.floor((2 * sp.length) / 3)]!;
  say(`  speed < ${f2(t1)}    ${sum(rows.filter((r) => r.f.speed < t1))}`);
  say(`  speed mid      ${sum(rows.filter((r) => r.f.speed >= t1 && r.f.speed < t2))}`);
  say(`  speed >= ${f2(t2)}   ${sum(rows.filter((r) => r.f.speed >= t2))}`);
  say(`  red on pink    ${sum(rows.filter((r) => r.f.redOnPink > 0))}`);
  say(`  a locked red   ${sum(rows.filter((r) => r.f.locked > 0))}`);
  say(`  no locked red  ${sum(rows.filter((r) => r.f.locked === 0))}`);
  say(`  no red on pink ${sum(rows.filter((r) => r.f.redOnPink === 0))}`);
  say(`  packed >= 3    ${sum(rows.filter((r) => r.f.packed >= 3))}`);
  say(`  packed < 3     ${sum(rows.filter((r) => r.f.packed < 3))}`);
  say(`  RE-RACK rounds: ${rows.filter((r) => r.g.reRack).map((r) => JSON.stringify({ side: r.f.side, speed: f2(r.f.speed), packed: r.f.packed, redOnPink: r.f.redOnPink, pottable: r.f.pottable })).join(' ')}`);
}

it('reds6 diagnosis', () => {
  const part = process.env.PART ?? 'lib';
  if (part === 'lib') {
    const old = lib('old'), v3 = lib('v3');
    say('== Break libraries, 6 reds (redPottable: the breaks used when step 1 succeeds) ==');
    const Fo = describeLib('old', old.redPottable);
    const Fv = describeLib('v3 ', v3.redPottable);
    describeLib('old snookered', old.snookered);
    describeLib('v3  snookered', v3.snookered);
    for (const [nm, F] of [['old', Fo], ['v3', Fv]] as const) {
      const sp = F.map((f) => f.speed).sort((a, b) => a - b);
      const t1 = sp[Math.floor(sp.length / 3)]!, t2 = sp[Math.floor((2 * sp.length) / 3)]!;
      const g = (sel: Facts[]) => `${sel.length} breaks: red on pink ${pct(sel.filter((f) => f.redOnPink).length, sel.length)}, a locked red ${pct(sel.filter((f) => f.locked).length, sel.length)}`;
      say(`${nm} by side / speed: green ${g(F.filter((f) => f.side === 'green'))} | yellow ${g(F.filter((f) => f.side === 'yellow'))}` +
        ` | slow ${g(F.filter((f) => f.speed < t1))} | mid ${g(F.filter((f) => f.speed >= t1 && f.speed < t2))} | fast ${g(F.filter((f) => f.speed >= t2))}`);
    }
    joined('old library', 'soak-n4pos', 2, old, Fo);
    joined('v3 library', 'night6/soak', 3, v3, Fv);
  }
  if (part === 'rerack') {
    const codes = (process.env.CODES ?? 'v3-5000520,v3-5000094,v3-5000282,v3-5000510,v3-5000347,v2-5000766,v2-5000188,v2-5000865').split(',');
    for (const c of codes) {
      const [v, s] = c.split('-');
      const rng = Number(v!.slice(1)) as RngVersion;
      const L = lib(rng === 3 ? 'v3' : 'old');
      const provider = createPhysicsProvider(table, { [LEVEL]: L });
      let picked = -1;
      const pick = provider.breakAndStep1;
      provider.breakAndStep1 = (lv, o, p, fr, rv) => { picked = Math.floor(p * L.redPottable.length); return pick(lv, o, p, fr, rv); };
      let r = start(setLevel(newRound(Number(s), undefined, rng), LEVEL), provider, table);
      const afterBreak = L.redPottable[picked].after as Ball[];
      const fb = facts(L.redPottable[picked]);
      const trail: string[] = [];
      while (r.phase === 'decide' && r.step < 10) {
        r = shoot(r, provider, table);
        const h = r.history[r.history.length - 1]!;
        trail.push(`${h.step}:${h.target}`);
      }
      const before = r.frame!.balls;
      const reds = before.filter((b) => b.kind === 'red');
      const cue = before.find((b) => b.kind === 'cue')!;
      const r2 = shoot(r, provider, table);
      const h = r2.history[r2.history.length - 1]!;
      say(`\n${LEVEL}-${c}: break entry ${picked} (${fb.side} side, speed ${f2(fb.speed)}, packed ${fb.packed}, red on pink ${fb.redOnPink}, pottable ${fb.pottable}); steps ${trail.join(' ')}; step ${h.step} ${h.target}: ${h.outcome}`);
      for (const red of reds) {
        const near = before.filter((b) => b.id !== red.id).map((b) => ({ id: b.id, g: gap(red, b) })).sort((a, b) => a.g - b.g)[0]!;
        const was = afterBreak.find((b) => b.id === red.id)!;
        const moved = Math.hypot(was.pos.x - red.pos.x, was.pos.y - red.pos.y);
        say(`  last red ${red.id} at (${f2(red.pos.x)}, ${f2(red.pos.y)}); nearest ${near.id} gap ${(near.g * 1000).toFixed(1)} mm; cushion gap ${(cushionGap(red) * 1000).toFixed(0)} mm;` +
          ` moved since the break ${(moved * 100).toFixed(1)} cm (break: (${f2(was.pos.x)}, ${f2(was.pos.y)})); locked (no pocket open): ${allRedsLocked(before, table) ? 'YES' : 'no'}`);
      }
      say(`  cue ball (${f2(cue.pos.x)}, ${f2(cue.pos.y)}); colours off spot: ${before.filter((b) => b.kind !== 'red' && b.kind !== 'cue').map((b) => {
        const sp = table.spots[b.kind as keyof typeof table.spots];
        const d = Math.hypot(b.pos.x - sp.x, b.pos.y - sp.y);
        return d > 0.01 ? `${b.id} ${(d * 100).toFixed(0)} cm` : '';
      }).filter(Boolean).join(', ') || 'none'}`);
      say(`  all: ${before.map((b) => `${b.id}(${b.pos.x.toFixed(3)},${b.pos.y.toFixed(3)})`).join(' ')}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
  if (process.env.OUT) writeFileSync(process.env.OUT, out.join('\n') + '\n');
}, 3_600_000);
