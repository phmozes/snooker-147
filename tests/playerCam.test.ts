// 2026-11-28 (owner, RULES B.7): the player's view cameras (src/view/playerCam.ts). Fairness: the pick uses its own
// stream and never the outcome; the rates over 100,000 shots per level are on target and equal for success and failure;
// the follow reads only the aimed pocket, the target ball's place before the shot, the cue ball and the cue direction.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { ladderForLevel } from '../src/core/ladder';
import { newRngFor, playerCamDraw, streamValue, type RngVersion } from '../src/core/round';
import { parseRoundCode } from '../src/core/roundCode';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { fitCamera } from '../src/view/camera';
import { cutChance } from '../src/view/pocketCam';
import { aimOf, FOLLOW_INPUT_KEYS, followInputOf, followPose, glideBack, glideSeconds, glideSkipped, holdPose, pickPlayerCam, planPlayerCam, playerCamPose,
  shotCamera, type Pose, type ShotCamera } from '../src/view/playerCam';

const table = buildTable();
const PC = CONFIG.pocketCut;
const CAMS: ShotCamera[] = ['POCKET', 'TODAY', 'V1', 'V2', 'V3'];

describe('player camera pick: own stream, never the outcome', () => {
  it('the stream is not a game stream nor a pocket-camera stream, and differs from the outcome stream', () => {
    expect(CONFIG.rng.streams as readonly string[]).not.toContain(CONFIG.playerCam.stream);
    expect([PC.stream, PC.cutStream]).not.toContain(CONFIG.playerCam.stream);
    let differ = 0;
    for (let s = 1; s <= 500; s++) if (playerCamDraw(s * 104729, 4, 3) !== streamValue(s * 104729, 'outcome', 4, 3)) differ++;
    expect(differ).toBe(500);
  });
  it('the pick takes only (seed, step, rng): no outcome argument exists', () => {
    expect(pickPlayerCam.length).toBe(3);
  });
  it('the same seed and step give the same camera for every outcome (success vs every forced failure)', () => {
    const outcomes = ['success', 'plainMiss', 'jawRattle', 'inOff', 'wrongBallFirst'];
    for (const lv of CONFIG.levels) {
      const rng = newRngFor(lv.id);
      for (let s = 0; s < 400; s++) {
        const seed = 9_000_000 + s * 7919;
        for (let k = 2; k <= lv.steps; k++) {
          const pick = pickPlayerCam(seed, k, rng);
          // a shot that is not cut shows the pick, whatever the outcome
          for (const o of outcomes) expect(shotCamera(lv.id, k, o, seed, rng, false)).toBe(pick);
          // a cut shot: the pick does not move either (the cut is shown instead)
          for (const o of outcomes) { const c = shotCamera(lv.id, k, o, seed, rng, true); expect(c === 'POCKET' || c === pick).toBe(true); }
        }
      }
    }
  });
  it('step 1 is always TODAY', () => {
    for (let s = 0; s < 200; s++) expect(pickPlayerCam(s, 1, 3)).toBe('TODAY');
  });
  it('the game page draws the pick before it reads the outcome (onShoot)', () => {
    const src = readFileSync('src/game/gamePage.ts', 'utf8');
    const body = src.slice(src.indexOf('async function onShoot()'));
    const pick = body.indexOf('pickPlayerCam('), outcome = body.indexOf('nextOutcome(round)');
    expect(pick).toBeGreaterThan(0);
    expect(pick).toBeLessThan(outcome);
    expect(body.slice(0, body.indexOf('\n}\n'))).not.toMatch(/pickPlayerCam\([^)]*outcome/);
  });
  it('a round code replayed gives the same cameras every time', () => {
    for (const code of ['reds6-v4-5000008', 'reds10-v3-5400012', 'reds15-v3-3191475780', 'reds15-v3-77-C3']) {
      const a = parseRoundCode(code)!, b = parseRoundCode(code)!;
      const lv = CONFIG.levels.find((l) => l.id === a.levelId)!;
      const run = (c: typeof a) => Array.from({ length: lv.steps }, (_, i) => pickPlayerCam(c.seed, i + 1, c.rng));
      expect(run(b)).toEqual(run(a));
    }
  });
});

describe('camera rates over 100,000 simulated shots per level (pocket cut first, then the pick)', () => {
  // Real rounds by the outcome stream (step 1 too; a failure ends the round). Cuttable: every success; a failure with
  // the chance that the calibration assumes (rate / failure chance of its step group, bench/results/night8/pocketcut),
  // drawn from a test-only stream. The pocket cut is today's rule (pocketCam.ts), unchanged.
  for (const lv of CONFIG.levels) {
    it(`${lv.id}`, () => {
      const rng = newRngFor(lv.id) as RngVersion;
      const ladder = ladderForLevel(lv.id);
      const n: Record<'success' | 'failure', Record<string, number>> = { success: {}, failure: {} };
      const tot = { success: 0, failure: 0 };
      let shots = 0, nonLast = 0;
      for (let seed = 20_000_000; shots < 100_000; seed++) {
        if (streamValue(seed, 'outcome', 1, rng) >= ladder[0]!.p) continue; // step 1 failed: no SHOOT shot from step 2
        for (let k = 2; k <= lv.steps && shots < 100_000; k++) {
          const ok = streamValue(seed, 'outcome', k, rng) < ladder[k - 1]!.p;
          const o = ok ? 'success' : 'plainMiss', side = ok ? 'success' : 'failure';
          const fc = cutChance(lv.id, k, 'plainMiss', rng);
          const cuttable = ok || (fc > 0 && streamValue(seed, 'testCuttable', k, rng) < Math.min(1, PC.rate / fc));
          const cam = shotCamera(lv.id, k, o, seed, rng, cuttable);
          n[side][cam] = (n[side][cam] ?? 0) + 1;
          tot[side]++; shots++;
          if (k < lv.steps) nonLast++;
          if (!ok) break;
        }
      }
      const all = (c: string) => (n.success[c] ?? 0) + (n.failure[c] ?? 0);
      const target: Record<string, number> = { POCKET: PC.rate * (nonLast / shots) };
      for (const c of ['TODAY', 'V1', 'V2', 'V3'] as const) target[c] = (1 - target.POCKET!) * CONFIG.playerCam.shares[c];
      const lines = CAMS.map((c) => {
        const r = all(c) / shots, rs = (n.success[c] ?? 0) / tot.success, rf = (n.failure[c] ?? 0) / tot.failure;
        return { c, count: all(c), rate: r, target: target[c]!, success: n.success[c] ?? 0, rs, failure: n.failure[c] ?? 0, rf };
      });
      console.log(`${lv.id}: ${shots} shots (${tot.success} success, ${tot.failure} failure)\n` + lines.map((l) =>
        `  ${l.c.padEnd(6)} ${String(l.count).padStart(6)} = ${(100 * l.rate).toFixed(2)}% (target ${(100 * l.target).toFixed(2)}%) · given success ${l.success} = ${(100 * l.rs).toFixed(2)}% · given failure ${l.failure} = ${(100 * l.rf).toFixed(2)}% · diff ${(100 * Math.abs(l.rs - l.rf)).toFixed(2)}%`).join('\n'));
      for (const l of lines) {
        expect(Math.abs(l.rate - l.target), `${lv.id} ${l.c} rate`).toBeLessThan(0.01);
        expect(Math.abs(l.rs - l.rf), `${lv.id} ${l.c} success vs failure`).toBeLessThan(0.01);
        if (l.c !== 'POCKET' && CONFIG.playerCam.shares[l.c as 'V3'] === 0) expect(l.count, `${lv.id} ${l.c} weight 0: never drawn`).toBe(0);
      }
    });
  }
});

// a layout: cue ball, the aimed red, a blocker
const balls = [
  { id: 'cue', kind: 'cue', pos: { x: 0.1, y: -0.9 } },
  { id: 'red1', kind: 'red', pos: { x: 0.35, y: 0.6 } },
  { id: 'red2', kind: 'red', pos: { x: -0.4, y: 0.2 } },
  { id: 'black', kind: 'black', pos: { x: 0, y: 1.4605 } },
];

describe('the follow reads only the aimed pocket, the ball before the shot, the cue ball and the cue direction', () => {
  it('its input has exactly those four fields', () => {
    const f = followInputOf({ aim: { ball: 'red1', pocket: 'topRight' }, dir: { x: 0.25, y: 1.5 } }, balls, table);
    expect(Object.keys(f).sort()).toEqual([...FOLLOW_INPUT_KEYS]);
    expect(f).toEqual({ pocket: 'topRight', ball: { x: 0.35, y: 0.6 }, cue: { x: 0.1, y: -0.9 }, dir: { x: 0.25 / Math.hypot(0.25, 1.5), y: 1.5 / Math.hypot(0.25, 1.5) } });
  });
  it('roll data (where the ball went, the real pocket, the length, where the cue ball stopped) changes nothing', () => {
    const planned = { aim: { ball: 'red1', pocket: 'topRight' as PocketId }, dir: { x: 0.25, y: 1.5 } };
    const a = followInputOf(planned, balls, table);
    // a fluke: the stored target / pocket are where the ball really went; recording-like fields added
    const fluke = { ...planned, target: 'red2', pocket: 'middleLeft', duration: 9.9, cueEnd: { x: 1, y: 1 }, events: [{ type: 'pot' }], potted: ['red2'] };
    expect(followInputOf(fluke, balls, table)).toEqual(a);
    const fluke2 = { ...fluke, pocket: 'bottomLeft', target: 'black' };
    expect(followInputOf(fluke2, balls, table)).toEqual(a);
  });
  it('the follow source never imports the physics or reads a recording', () => {
    const src = readFileSync('src/view/playerCam.ts', 'utf8');
    expect(src).not.toMatch(/from '\.\.\/core\/physics/);
    expect(src).not.toMatch(/\b(frames|events|potted|Recording|cueEnd|duration)\b/);
  });
  it('a shot without a solver aim (soft foul, gentle tap) still gets a real aimed pocket from the layout only', () => {
    // soft foul: straight at red2 (not the target); its line goes on to the top-left area
    const soft = aimOf({ dir: { x: -0.5, y: 1.1 } }, balls, table);
    expect(soft.ball).toBe('red2');
    expect(table.pockets.map((p) => p.id)).toContain(soft.pocket);
    expect(soft.pocket).toBe('topLeft');
    // gentle tap that hits nothing: the cue ball's own line (towards the bottom right)
    const tap = aimOf({ dir: { x: 0.7, y: -0.7 } }, balls, table);
    expect(tap.ball).toBeNull();
    expect(tap.pocket).toBe('bottomRight');
    expect(followInputOf({ dir: { x: 0.7, y: -0.7 } }, balls, table).ball).toEqual({ x: 0.1, y: -0.9 });
  });
});

describe('camera path (hold, follow, rise, glide back): the H1-H3 rules', () => {
  const heights = { railZ: 0.045 };
  const rs = table.ballRadius * CONFIG.view3d.ballScale;
  const f = fitCamera(table, CONFIG.camera.main, 390 / 844);
  const main: Pose = { pos: f.position, at: f.lookAt, fov: f.fov };
  const elev = (P: Pose) => Math.atan2(P.pos[2] - P.at[2], Math.hypot(P.pos[0] - P.at[0], P.pos[1] - P.at[1])) * 180 / Math.PI;
  const mainEl = elev(main);
  it('every frame of 300 random shots: never steeper than the main camera, never below the hold / 12 cm, over the rail outside the cloth', () => {
    let u = 12345;
    const rnd = () => ((u = (Math.imul(u, 1103515245) + 12345) >>> 0) / 2 ** 32);
    for (let i = 0; i < 300; i++) {
      const cue = { x: (rnd() * 2 - 1) * (table.halfWidth - 0.05), y: (rnd() * 2 - 1) * (table.halfLength - 0.05) };
      const ob = { x: (rnd() * 2 - 1) * (table.halfWidth - 0.05), y: (rnd() * 2 - 1) * (table.halfLength - 0.05) };
      const pocket = table.pockets[Math.floor(rnd() * 6)]!.id;
      const dir = { x: ob.x - cue.x, y: ob.y - cue.y }, dl = Math.hypot(dir.x, dir.y);
      const input = { pocket, ball: ob, cue, dir: { x: dir.x / dl, y: dir.y / dl } };
      for (const cam of ['V1', 'V2', 'V3'] as const) {
        const plan = planPlayerCam(cam, input, rnd() * 0.35, table, heights, rs);
        let last: Pose = plan.hold;
        for (let t = -0.25; t <= 3; t += 1 / 60) {
          const P = playerCamPose(plan, t, main, table, heights).pose;
          last = P;
          expect(elev(P)).toBeLessThanOrEqual(mainEl + 0.01);
          expect(P.pos[2]).toBeGreaterThanOrEqual(Math.min(plan.hold.pos[2], CONFIG.playerCam.fixes.minHeight) - 1e-9);
          const out = Math.abs(P.pos[0]) > table.halfWidth || Math.abs(P.pos[1]) > table.halfLength;
          if (out && cam !== 'V3' && t > CONFIG.playerCam.follow.startAfterHit) expect(P.pos[2]).toBeGreaterThanOrEqual(heights.railZ + CONFIG.playerCam.fixes.overRail - 1e-9);
        }
        for (let t = 0; t <= 0.45; t += 1 / 60) expect(elev(glideBack(last, main, t).pose)).toBeLessThanOrEqual(mainEl + 0.01);
        const end = glideBack(last, main, CONFIG.playerCam.glideBackSeconds);
        expect(end.done).toBe(true);
        end.pose.pos.forEach((v, j) => expect(v).toBeCloseTo(main.pos[j]!, 6));
      }
    }
  });
  it('V1 / V2 end looking at the AIMED pocket mouth, 30 degrees above the cloth, at most 1.5 m away', () => {
    const input = followInputOf({ aim: { ball: 'red1', pocket: 'topRight' }, dir: { x: 0.25, y: 1.5 } }, balls, table);
    const mouth = table.pockets.find((p) => p.id === 'topRight')!.mouthMid;
    for (const cam of ['V1', 'V2'] as const) {
      const hold = holdPose(cam, input.cue, input.dir, 0.1, table, heights, rs);
      const P = followPose(hold, input, table);
      expect(P.at).toEqual([mouth.x, mouth.y, 0]);
      expect(elev(P)).toBeCloseTo(CONFIG.playerCam.follow.liftDeg, 6);
      expect(Math.hypot(P.pos[0] - mouth.x, P.pos[1] - mouth.y, P.pos[2])).toBeLessThanOrEqual(CONFIG.playerCam.follow.maxDist + 1e-9);
      // the follow starts 0.1 s after the hit: the hold until then
      const plan = planPlayerCam(cam, input, 0.1, table, heights, rs);
      playerCamPose(plan, 0.05, main, table, heights).pose.pos.forEach((v, j) => expect(v).toBeCloseTo(plan.hold.pos[j]!, 9));
      const k1 = playerCamPose(plan, CONFIG.playerCam.follow.startAfterHit + CONFIG.playerCam.follow.moveSeconds, main, table, heights).pose;
      k1.pos.forEach((v, j) => expect(v).toBeCloseTo(plan.follow!.pos[j]!, 6));
    }
  });
  it('a MIDDLE aimed pocket: the end is 50 degrees up, 1.8 m from the mouth, over the cloth, looking just onto the cloth (300 random shots)', () => {
    const M = CONFIG.playerCam.follow.middle;
    let u = 777;
    const rnd = () => ((u = (Math.imul(u, 1103515245) + 12345) >>> 0) / 2 ** 32);
    for (let i = 0; i < 300; i++) {
      const pk = table.pockets.filter((p) => p.kind === 'middle')[i % 2]!;
      const cue = { x: (rnd() * 2 - 1) * (table.halfWidth - 0.05), y: (rnd() * 2 - 1) * (table.halfLength - 0.05) };
      const ob = { x: (rnd() * 2 - 1) * (table.halfWidth - 0.05), y: (rnd() * 2 - 1) * (table.halfLength - 0.05) };
      const dir = { x: ob.x - cue.x, y: ob.y - cue.y }, dl = Math.hypot(dir.x, dir.y);
      const input = { pocket: pk.id, ball: ob, cue, dir: { x: dir.x / dl, y: dir.y / dl } };
      for (const cam of ['V1', 'V2'] as const) {
        const plan = planPlayerCam(cam, input, 0.1, table, heights, rs);
        const P = plan.follow!, m = pk.mouthMid;
        expect(Math.hypot(P.pos[0] - m.x, P.pos[1] - m.y, P.pos[2])).toBeCloseTo(M.dist, 6);
        expect(Math.atan2(P.pos[2], Math.hypot(P.pos[0] - m.x, P.pos[1] - m.y)) * 180 / Math.PI).toBeCloseTo(M.liftDeg, 6);
        expect(Math.abs(P.pos[0])).toBeLessThan(table.halfWidth); // over the cloth, not over the rail
        expect(Math.hypot(P.at[0] - m.x, P.at[1] - m.y)).toBeCloseTo(M.atInward, 6);
        expect(Math.abs(P.at[0])).toBeLessThan(Math.abs(m.x));
        expect(P.fov).toBeLessThanOrEqual(plan.hold.fov);
        // the whole move: never steeper than the main camera
        for (let t = 0; t <= 1.2; t += 1 / 30) expect(elev(playerCamPose(plan, t, main, table, heights).pose)).toBeLessThanOrEqual(mainEl + 0.01);
      }
    }
  });
  it('a corner aimed pocket keeps the old end (the middle rule does not touch it)', () => {
    const input = { pocket: 'bottomLeft' as PocketId, ball: { x: -0.3, y: -1.2 }, cue: { x: 0.2, y: -0.4 }, dir: { x: -0.5, y: -0.8 } };
    const P = planPlayerCam('V2', input, 0.1, table, heights, rs).follow!;
    const m = table.pockets.find((p) => p.id === 'bottomLeft')!.mouthMid;
    expect(P.at).toEqual([m.x, m.y, 0]);
    expect(elev(P)).toBeCloseTo(CONFIG.playerCam.follow.liftDeg, 6);
  });
  it('3.5 s rule: no glide when the shot is already over longShotSeconds when the balls stop', () => {
    const L = CONFIG.playerCam.longShotSeconds;
    expect(glideSkipped(L + 0.001)).toBe(true);
    expect(glideSkipped(L)).toBe(false);
    expect(glideSeconds('V2', 2, L + 0.2)).toBe(0);
    expect(glideSeconds('V1', 2, L - 0.2)).toBe(CONFIG.playerCam.glideBackSeconds);
    // a glide only on a shot of at most L s: never past L + glide = 3.5 s
    expect(L + CONFIG.playerCam.glideBackSeconds).toBeLessThanOrEqual(3.5 + 1e-9);
    expect(readFileSync('src/game/gamePage.ts', 'utf8')).toContain('glideSkipped(tau)');
  });
  it('H1: the hold rises over a raised cue', () => {
    const low = holdPose('V1', { x: 0, y: 0 }, { x: 0, y: 1 }, 0, table, heights, rs);
    const high = holdPose('V1', { x: 0, y: 0 }, { x: 0, y: 1 }, 0.35, table, heights, rs);
    expect(high.pos[2]).toBeGreaterThan(low.pos[2]);
    expect(high.pos[2]).toBeGreaterThanOrEqual(rs + CONFIG.playerCam.views.V1.back * Math.tan(0.35) + CONFIG.playerCam.fixes.overCue - 1e-9);
  });
});
