// Task 3.1: the rules state, one plain-English case per test. "[C.n]" = the section of docs/RULES.md it comes from.
// docs/RULES-CHECK.md is built from these names and their results (npm run rules-check).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, runUntilStill, strike } from '../src/core/physics/sim';
import { potRedShot } from '../src/core/physics/testShots';
import { applyShot, judgeShot, legalTargets, newFrame, respotPosition, type FrameState, type ShotResult } from '../src/core/rules';
import { buildTable } from '../src/core/table/geometry';
import { COLOURS, dist, type Ball, type Colour } from '../src/core/types';

const table = buildTable();
const r = table.ballRadius;

/** A shot result: the cue ball first touched `firstHit`, `potted` dropped, the other balls stayed where they were. */
function shot(state: FrameState, firstHit: string | null, potted: string[] = []): ShotResult {
  return { firstHit, potted, after: state.balls.filter((b) => !potted.includes(b.id)) };
}
/** Pot `id` cleanly with `target` as the target. */
const pot = (state: FrameState, target: Parameters<typeof applyShot>[1], id: string) =>
  applyShot(state, target, shot(state, id, [id]), table);
/** A state in the final phase: only the cue ball and the colours from `next` onward on the table. */
function finalState(next: Colour): FrameState {
  const i = CONFIG.finalColourOrder.indexOf(next);
  const balls: Ball[] = [{ id: 'cue', kind: 'cue', pos: { x: 0.3, y: -1.2 } },
    ...CONFIG.finalColourOrder.slice(i).map((c) => ({ id: c, kind: c, pos: { ...table.spots[c] } }))];
  return { phase: 'final', redsLeft: 0, nextColour: next, balls, lastFailure: null };
}
const has = (s: FrameState, id: string) => s.balls.some((b) => b.id === id);
const posOf = (s: FrameState, id: string) => s.balls.find((b) => b.id === id)!.pos;

describe('Reds and colours alternate', () => {
  it('[C.1] a new round starts with a red as the target, with every red and colour on the table', () => {
    const s = newFrame(6, table);
    expect(s.phase).toBe('red');
    expect(legalTargets(s)).toEqual(['red']);
    expect(s.balls.filter((b) => b.kind === 'red')).toHaveLength(6);
    for (const c of COLOURS) expect(has(s, c)).toBe(true);
  });
  it('[C.1] after a red is potted, the next target is a colour, and any of the six colours may be chosen', () => {
    const s = pot(newFrame(6, table), 'red', 'red1');
    expect(s.phase).toBe('colour');
    expect(s.redsLeft).toBe(5);
    expect(legalTargets(s)).toEqual(['yellow', 'green', 'brown', 'blue', 'pink', 'black']);
  });
  it('[C.1] after a colour is potted while reds remain, the next target is a red again', () => {
    let s = pot(newFrame(6, table), 'red', 'red1');
    s = pot(s, 'black', 'black');
    expect(s.phase).toBe('red');
    expect(legalTargets(s)).toEqual(['red']);
  });
  it('[C.1] a colour cannot be the target when a red is due, and a red cannot be the target when a colour is due', () => {
    const s = newFrame(6, table);
    expect(() => judgeShot(s, 'black', shot(s, 'black', ['black']))).toThrow();
    const c = pot(s, 'red', 'red1');
    expect(() => judgeShot(c, 'red', shot(c, 'red2', ['red2']))).toThrow();
  });
  it('[C.1] a whole 6-red round alternates red, colour, red, colour ... and then goes to the final colours', () => {
    let s = newFrame(6, table);
    const phases: string[] = [];
    for (let i = 1; i <= 6; i++) {
      s = pot(s, 'red', `red${i}`); phases.push(s.phase);
      s = pot(s, 'black', 'black'); phases.push(s.phase);
    }
    expect(phases).toEqual(['colour', 'red', 'colour', 'red', 'colour', 'red', 'colour', 'red', 'colour', 'red', 'colour', 'final']);
  });
});

describe('Colours are re-spotted', () => {
  it('[C.2] a colour potted while reds remain goes back to its own spot', () => {
    let s = pot(newFrame(6, table), 'red', 'red1');
    s = pot(s, 'pink', 'pink');
    expect(posOf(s, 'pink')).toEqual(table.spots.pink);
  });
  it('[C.2] the colour after the LAST red is also re-spotted (the final colours start with all six on the table)', () => {
    let s = newFrame(6, table);
    for (let i = 1; i <= 6; i++) { s = pot(s, 'red', `red${i}`); s = pot(s, 'blue', 'blue'); }
    expect(s.phase).toBe('final');
    for (const c of COLOURS) expect(has(s, c)).toBe(true);
    expect(posOf(s, 'blue')).toEqual(table.spots.blue);
  });
  it('[C.2] if its own spot is covered, the colour goes to the highest free spot (black, pink, blue, brown, green, yellow)', () => {
    const balls: Ball[] = [{ id: 'red1', kind: 'red', pos: { ...table.spots.pink } }]; // a red sits on the pink spot
    const p = respotPosition('pink', balls, table);
    expect(p).toEqual(table.spots.black); // black spot is free (black is not on the table in this case)
    balls.push({ id: 'black', kind: 'black', pos: { ...table.spots.black } });
    expect(respotPosition('pink', balls, table)).toEqual(table.spots.blue); // black spot taken: next highest
  });
  it('[C.2] a spot counts as covered when a ball there would touch another ball, not only when a ball sits on it', () => {
    const balls: Ball[] = [{ id: 'red1', kind: 'red', pos: { x: table.spots.blue.x + 2 * r, y: table.spots.blue.y } }];
    expect(respotPosition('blue', balls, table)).not.toEqual(table.spots.blue);
  });
  it('[C.2] if every spot is covered, the colour goes to the nearest free point straight above its own spot (toward the top cushion)', () => {
    const balls: Ball[] = COLOURS.map((c, i) => ({ id: `red${i + 1}`, kind: 'red' as const, pos: { ...table.spots[c] } }));
    const p = respotPosition('blue', balls, table);
    expect(p.x).toBe(table.spots.blue.x);
    expect(p.y).toBeGreaterThan(table.spots.blue.y);
    expect(dist(p, table.spots.blue)).toBeLessThan(2 * r + 0.002); // the nearest free point, right next to the red
  });
  it('[C.2] yellow and green (spots not on the centre line) go straight up the table from their own spot', () => {
    const balls: Ball[] = COLOURS.map((c, i) => ({ id: `red${i + 1}`, kind: 'red' as const, pos: { ...table.spots[c] } }));
    for (const c of ['yellow', 'green'] as const) {
      const p = respotPosition(c, balls, table);
      expect(p.x).toBe(table.spots[c].x);
      expect(p.y).toBeGreaterThan(table.spots[c].y);
    }
  });
  it('[C.2] if there is no room above, the colour goes to the nearest free point below its own spot', () => {
    const balls: Ball[] = COLOURS.map((c, i) => ({ id: `x${i}`, kind: 'red' as const, pos: { ...table.spots[c] } }));
    for (let y = table.spots.black.y; y < table.halfLength; y += 2 * r) balls.push({ id: `y${y}`, kind: 'red', pos: { x: 0, y } });
    const p = respotPosition('black', balls, table);
    expect(p.x).toBe(0);
    expect(p.y).toBeLessThan(table.spots.black.y);
  });
  it('[C.2] a re-spotted colour never overlaps another ball', () => {
    const balls: Ball[] = COLOURS.map((c, i) => ({ id: `red${i + 1}`, kind: 'red' as const, pos: { ...table.spots[c] } }));
    for (const c of COLOURS) {
      const p = respotPosition(c, balls, table);
      for (const b of balls) expect(dist(b.pos, p)).toBeGreaterThanOrEqual(2 * r);
    }
  });
});

describe('Final colours in order', () => {
  it('[C.3] after the last red and its colour, the target is yellow', () => {
    let s = newFrame(6, table);
    for (let i = 1; i <= 6; i++) { s = pot(s, 'red', `red${i}`); s = pot(s, 'black', 'black'); }
    expect(legalTargets(s)).toEqual(['yellow']);
  });
  it('[C.3] the final colours must be potted in the order yellow, green, brown, blue, pink, black', () => {
    let s = finalState('yellow');
    const order: string[] = [];
    while (s.phase === 'final') { const c = s.nextColour!; order.push(c); s = pot(s, c, c); }
    expect(order).toEqual(['yellow', 'green', 'brown', 'blue', 'pink', 'black']);
  });
  it('[C.3] a final colour stays down after it is potted (it is not re-spotted)', () => {
    const s = pot(finalState('yellow'), 'yellow', 'yellow');
    expect(has(s, 'yellow')).toBe(false);
    expect(legalTargets(s)).toEqual(['green']);
  });
  it('[C.3] in the final colours only the next colour is a legal target', () => {
    const s = finalState('brown');
    expect(legalTargets(s)).toEqual(['brown']);
    expect(() => judgeShot(s, 'pink', shot(s, 'pink', ['pink']))).toThrow();
  });
  it('[C.3] potting the black last clears the table and wins the round', () => {
    const s = pot(finalState('black'), 'black', 'black');
    expect(s.phase).toBe('cleared');
    expect(s.balls.map((b) => b.id)).toEqual(['cue']);
  });
});

describe('Exactly the target ball is potted', () => {
  it('[C.4] hitting a red first and potting exactly that red is a success', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'red3', ['red3']))).toEqual({ result: 'success', potted: 'red3' });
  });
  it('[C.4] potting two reds in one shot is NOT a success (real snooker allows it, we do not): the solver must not play it', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'red1', ['red1', 'red2'])).result).toBe('invalid');
  });
  it('[C.4] potting the target and another ball is NOT a success: the solver must not play it', () => {
    const s = pot(newFrame(6, table), 'red', 'red1');
    expect(judgeShot(s, 'blue', shot(s, 'blue', ['blue', 'pink'])).result).toBe('invalid');
  });
  it('[C.4] potting the target while the cue ball also drops is NOT a success (it is an in-off with a pot: not playable)', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'red1', ['red1', 'cue'])).result).toBe('invalid');
  });
  it('[C.4] in the colour phase, potting a different colour from the one chosen is not a success', () => {
    const s = pot(newFrame(6, table), 'red', 'red1');
    expect(judgeShot(s, 'blue', shot(s, 'blue', ['pink'])).result).toBe('invalid');
  });
  it('[C.4] hitting one red that knocks a different red in counts as a success (any red is the target in the red phase)', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'red1', ['red4']))).toEqual({ result: 'success', potted: 'red4' });
  });
  it('[C.4] a real simulated shot ("Pot a red" from the replay page) is judged a success', () => {
    const setup = potRedShot(table);
    const sim = createSim(setup.balls, table);
    strike(sim, 'cue', setup.dir, setup.speed, setup.spin);
    runUntilStill(sim);
    const first = sim.events.find((e) => e.type === 'ball')!;
    const firstHit = first.type === 'ball' ? (first.a === 'cue' ? first.b : first.a) : null;
    const state: FrameState = { phase: 'red', redsLeft: 1, nextColour: null, balls: setup.balls, lastFailure: null };
    const result: ShotResult = { firstHit, potted: sim.balls.filter((b) => b.potted).map((b) => b.id),
      after: sim.balls.filter((b) => !b.potted).map((b) => ({ id: b.id, kind: b.kind, pos: b.pos })) };
    expect(judgeShot(state, 'red', result)).toEqual({ result: 'success', potted: 'red1' });
  });
});

describe('Fouls and failures end the round', () => {
  it('[C.5] the cue ball going into a pocket (and nothing else) is an IN-OFF failure', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'red1', ['cue']))).toEqual({ result: 'failure', type: 'inOff' });
  });
  it('[C.5] hitting a wrong ball first (and potting nothing) is a FOUL failure', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'pink'))).toEqual({ result: 'failure', type: 'wrongBallFirst' });
  });
  it('[C.5] in the colour phase, hitting a colour other than the chosen one first is a FOUL failure', () => {
    const s = pot(newFrame(6, table), 'red', 'red1');
    expect(judgeShot(s, 'black', shot(s, 'blue'))).toEqual({ result: 'failure', type: 'wrongBallFirst' });
  });
  it('[C.5] missing every ball is a failure (shown as SNOOKERED when escaping a snooker)', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, null))).toEqual({ result: 'failure', type: 'missedAll' });
  });
  it('[C.5] hitting the right ball but potting nothing is a failure (MISSED)', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'red1'))).toEqual({ result: 'failure', type: 'noPot' });
  });
  it('[C.5] a failed shot never pots an object ball: wrong ball first plus a pot is not playable', () => {
    const s = newFrame(6, table);
    expect(judgeShot(s, 'red', shot(s, 'pink', ['red1'])).result).toBe('invalid');
  });
  it('[C.5] every failure ends the round, and the round remembers which failure it was', () => {
    const s = applyShot(newFrame(6, table), 'red', shot(newFrame(6, table), 'red1', ['cue']), table);
    expect(s.phase).toBe('lost');
    expect(s.lastFailure).toBe('inOff');
    expect(legalTargets(s)).toEqual([]);
  });
  it('[C.5] a shot the solver must never play is refused instead of being applied', () => {
    const s = newFrame(6, table);
    expect(() => applyShot(s, 'red', shot(s, 'red1', ['red1', 'red2']), table)).toThrow();
  });
});
