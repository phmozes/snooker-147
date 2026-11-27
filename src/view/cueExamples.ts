// The three example positions of the approved cue mockup (docs/cue-options.html): one layout of balls, three shots.
// Shared by the mockup page and the game's dev hook (window.__dev.cueExample), so both draw the cue for exactly the same
// balls and the same shot line. Visual check only: nothing here is used by the round, the rules or the solver.
import type { Ball, Vec2 } from '../core/types';
import type { TableGeometry } from '../core/table/geometry';
import { newFrame } from '../core/rules';

const REDS: [number, number][] = [[-0.30, 0.55], [-0.62, -0.75], [0.55, 1.25], [0.147, 0.579], [0.085, 0.455], [-0.15, 1.25],
  [0.22, 1.05], [0.45, 0.35], [-0.20, 1.00], [-0.50, 0.10]];

/** The balls other than the cue ball (reds first, then the colours on their spots), and the three shots.
 *  rs = drawn ball radius (the mockup draws balls 1.4x). */
export function cueExamples(table: TableGeometry, rs: number) {
  const reds = REDS.map(([x, y]) => ({ kind: 'red' as const, pos: { x, y } }));
  const colours = newFrame(15, table).balls.filter((b) => b.kind !== 'red' && b.kind !== 'cue').map((b) => ({ kind: b.kind, pos: { ...b.pos } }));
  const others = [...reds, ...colours];
  const shots = [
    { label: 'Middle', cue: { x: 0.42, y: -0.35 }, obj: 0, pocket: 'topLeft', missTurn: 4.5 },
    { label: 'Near cushion', cue: { x: -0.35, y: -table.halfLength + rs + 0.045 }, obj: 1, pocket: 'middleLeft', missTurn: -7 },
    { label: 'Balls behind', cue: { x: 0.25, y: 0.75 }, obj: 2, pocket: 'topRight', missTurn: -4.5 },
  ];
  return { others, shots };
}

/** Example `i` as game balls plus its unit shot direction (cue ball towards the ghost ball of the pot, as the mockup). */
export function cueExampleShot(table: TableGeometry, rs: number, i: number): { balls: Ball[]; dir: Vec2 } {
  const { others, shots } = cueExamples(table, rs), shot = shots[i]!;
  const O = others[shot.obj]!.pos, P = table.pockets.find((p) => p.id === shot.pocket)!.captureCentre, C = shot.cue;
  const ul = Math.hypot(P.x - O.x, P.y - O.y), u = { x: (P.x - O.x) / ul, y: (P.y - O.y) / ul };
  const G = { x: O.x - u.x * 2 * rs, y: O.y - u.y * 2 * rs }, dl = Math.hypot(G.x - C.x, G.y - C.y);
  let n = 0;
  const balls: Ball[] = [{ id: 'cue', kind: 'cue', pos: { ...C } },
    ...others.map((b) => ({ id: b.kind === 'red' ? `red${++n}` : b.kind, kind: b.kind, pos: { ...b.pos } }))];
  return { balls, dir: { x: (G.x - C.x) / dl, y: (G.y - C.y) / dl } };
}
