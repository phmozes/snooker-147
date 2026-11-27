// Owner 2026-11-27 (pick B): the miss sound, once per failed shot, only when the failure is clear on screen.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { classifyRoll, pocketRollStart } from '../src/core/physics/testShots';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { missMoment, potHeardAt } from '../src/game/tableSounds';
import { positionsAt } from '../src/view/playback';

const table = buildTable(CONFIG.table);
const rs = CONFIG.table.ballRadius * CONFIG.view3d.ballScale;

/** A ball `id` rolled at a pocket from 1 m away (offset across the mouth), recorded as a shot. */
function roll(id: string, pocket: PocketId, offset: number, speed = 1.6) {
  const st = pocketRollStart(table, { pocket, angleDeg: 0, offset, speed, distance: 1.0 })!;
  const sim = createSim([{ id, kind: id === 'cue' ? 'cue' : 'red', pos: st.pos }], table);
  strike(sim, id, st.dir, speed, 0);
  return { rec: recordShot(sim), outcome: classifyRoll(sim, id) };
}

describe('the miss sound comes when the failure is clear', () => {
  it('jaw rattle: when the target ball has come to rest outside the pocket, after the rattle', () => {
    let found = 0;
    for (const id of ['topRight', 'middleLeft', 'bottomLeft'] as PocketId[]) {
      for (const off of [0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06]) {
        const { rec, outcome } = roll('red1', id, off);
        if (outcome !== 'rattleOut') continue;
        found++;
        const at = missMoment(rec, 'jawRattle', 'red1', rs);
        const jaw = rec.events.filter((e) => e.type === 'jaw' && e.a === 'red1').at(-1)!;
        expect(at).toBeGreaterThanOrEqual(jaw.t); // after the (last) rattle
        expect(at).toBeLessThanOrEqual(rec.duration);
        // from then on the ball never moves again, and just before it still moved
        const p = positionsAt(rec, at)[0]!, q = positionsAt(rec, rec.duration)[0]!;
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(1e-9);
        const e = positionsAt(rec, Math.max(0, at - 2 * rec.frameDt))[0]!;
        expect(Math.hypot(e.x - q.x, e.y - q.y)).toBeGreaterThan(0);
        break;
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('in-off: when the cue ball is seen dropping (the same moment as its pocket sound)', () => {
    const { rec } = roll('cue', 'topLeft', 0);
    const pot = rec.events.find((e) => e.type === 'pot' && e.a === 'cue')!;
    expect(pot).toBeTruthy();
    expect(missMoment(rec, 'inOff', 'red1', rs)).toBeCloseTo(potHeardAt(rec, pot.t, 'cue', rs), 9);
    expect(missMoment(rec, 'inOff', 'red1', rs)).toBeGreaterThan(pot.t);
  });
  it('plain miss, wrong ball first / foul, snookered: when every ball has stopped (also any fallback)', () => {
    const { rec } = roll('red1', 'topRight', 0.2, 0.8); // a ball that stops on the cloth
    for (const l of ['plainMiss', 'wrongBallFirst', 'snookered']) expect(missMoment(rec, l, 'red1', rs)).toBe(rec.duration);
    expect(missMoment(rec, 'jawRattle', 'red1', rs)).toBe(rec.duration); // no rattle in the recording
    expect(missMoment(rec, 'inOff', 'red1', rs)).toBe(rec.duration); // no cue ball pot in the recording
  });
  it('the file, the volume, and where the game plays it (never on the break-off, a cash out or a free replay)', () => {
    expect(existsSync('public/sounds/miss.mp3')).toBe(true);
    expect(CONFIG.sound.uiSounds.missVolume).toBe(0.7);
    const src = readFileSync('src/game/gamePage.ts', 'utf8');
    expect(src).toMatch(/if \(round\.free \|\| h\.outcome === 'success' \|\| h\.outcome === 'reRack'\) return undefined;/);
    expect(src.match(/miss: missFor\(/g)?.length).toBe(2); // the two SHOOT paths only (step 1 and later steps)
    expect(src).toMatch(/breakOff: true \}\)/); // the break-off call passes no miss
    expect(src.match(/playMiss\(\)/g)?.length).toBe(2); // the playback and the dev button
  });
});
