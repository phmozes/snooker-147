// @ts-nocheck -- moved as it was from the approved mockup (docs/pocket-options.html, night 4); typed at the edges only.
// The approved table look (owner 2026-11-26): look A (classic club) with the wood from docs/pocket-options.html and the
// T1 pockets (shapes, colours, shading, net). ONE piece of code for the mockup pages and the game: both import
// createLook(table) from here. Drawn in code only (canvas textures, no image files). Visual only: it reads the table
// geometry (pockets, jaws) and never changes it; the self-checks below throw if a drawn jaw leaves the physics jaw.
// World axes are the physics axes: x across, y along (+y = top cushion), z up; metres.
import * as THREE from 'three';
import { CONFIG } from '../config/game.config';

/** Look A colours (docs/look-options.html). */
export const A = { bg: '#0b0907', cloth: '#1c6a37', oldCushion: '#1a6133', wood: '#4a2412' };

export function createLook(table) {
const hw = table.halfWidth, hl = table.halfLength, R = table.ballRadius, S = CONFIG.view3d.ballScale; // balls drawn at 1.4x
const V = CONFIG.view3d, TC = CONFIG.table;
// Drawn heights (m). Rail top highest, cushion top a little lower, bed at 0, hole below the bed.
const H = { cushion: 0.040, rail: 0.050, pit: 0.10, railBottom: -0.10 };
// S1 (round 5, after the owner's sketch): the whole physics drop circle is drawn as a round black hole, with a net in
// its back half; the rail wood stops at each side of the pocket; a light tan leather arc bridges the gap round the
// outside of the hole; each cushion narrows to a point where its nose (the physics jaw) meets the rail line.
//   `width` of the leather arc outside the hole edge, `lip` = how far it hangs over the hole edge, `over` = how far
//   (angle, rad) the arc runs on over each rail end, `netTop` / `netBottom` = height of the net at the rim / middle.
// R2 (round 4): the rail top overhangs the back of the hole: the cushions end at depth `db`, the visible black closes
//   behind them (`bulge` deep, as wide as the mouth), and a dark leather cap reaches forward over the cushion ends
//   (`tB` = how far back along the jaw, angle in rad; cap `back` = width behind the hole, `over` = overlap onto the wood).
// T1 (round 6, after the owner's two photos of a real table): black at the front of the pocket, a bright net behind it,
//   and peach-tan leather at the back with a lighter inner lip (`lip2` = half its width).
//   Corner: a round hole; the green runs on beside the throat as a thin strip up to the hole, and the rail ends are
//   rounded to follow it. The leather is a band just inside the outer line of the table, from rail end to rail end:
//   `band` wide round the bend, growing (power `taper`) towards its ends, where it reaches in to the hole and starts
//   at the point where the green strip meets the rail end; the hole is open up to it and the net hangs almost straight down from its inner edge.
//   Middle: a straight opening as wide as the physics mouth. The green of each cushion runs on into the pocket as a
//   thin strip along the side of the hole (following the physics jaw) up to the leather. Behind the net a leather plate
//   fills the gap between the rail ends and stays inside the outer edge of the wood. plate: `front` = depth where its
//   side arms start, `depth` = how far the net reaches behind that, `side` = width of the arms, `inset` = how far its
//   outer edge stays inside the wood edge, `round` = how much that edge is rounded, `strip` = width of the green strips.
//   The net hangs almost straight down from the rim along the back AND both sides of the hole: `netFront` = depth
//   where it starts on the sides, `netLean` = how far it leans inwards on its way down.
//   `netFade` = depth over which the net fades in: it shows only in the back half of each hole, the front is pure black.
const DRAW = {
  t1: { band: 0.020, taper: 2, inset: 0.014, netFade: 0.035, curl: 0.006, netTop: 0.046, netBottom: -0.095, lip2: 0.0035,
    plate: { front: 0.040, depth: 0.050, side: 0.016, inset: 0.004, round: 0.008, netFront: -0.03, strip: 0.012, netLean: 0.03 } },
  s1: { width: 0.026, lip: 0.001, over: { corner: 0.08, middle: 0.45 }, netTop: 0.046, netBottom: -0.06 },
  r2: { corner: { db: 0.034, bulge: 0.071, tB: 0.10 }, middle: { db: 0, bulge: 0.030, tB: 0.70 } },
  cap: { back: 0.030, over: 0.006 },
};
// `fall` / `fallWidth` = darkness and width of the shadow on the bed at the front of each hole; `jaw` = how much darker the
// cushion faces get where they look into a pocket (T1).
// T1 leather: `bump` = how strongly the lamp picks out its rounded top; its soft shadow on the wood: `width` (m) and `dark` (0..1)
const SHADE = { bump: 2.5, width: 0.026, dark: 0.72, fall: 0.75, fallWidth: 0.026, jaw: 0.9 };
const CORNER_ROUND = 0.12; // outer corners of the rail are rounded (radius, m)
// cushion width, nose to rail (drawing only; slimmer than before): chosen so that the back corner of a cushion end
// lies exactly on the edge of the slate cut
const CW = (() => { const p = table.pockets.find((q) => q.kind === 'middle'), dc = p.fallFront + p.captureRadius;
  return Math.sqrt(p.captureRadius ** 2 - dc ** 2) - (TC.middle.mouth + TC.mouthExtra) / 2; })();
if (!(CW > 0.025 && CW < 0.05)) throw new Error('cushion width ' + CW);

const BALL = { cue: '#f6f3e8', red: '#c8161d', yellow: '#f4c430', green: '#14804a', brown: '#7a4a24', blue: '#1f5fcf', pink: '#f58fb0', black: '#0d0d0d' };
// ---------- pocket shapes, in the pocket's own frame: d = depth along the throat (0 = narrowest point, + = into the
// pocket), l = sideways (+ = jaw on one side; the other side is the mirror image) ----------
const byId = Object.fromEntries(table.pockets.map((p) => [p.id, p]));
function pocketShapes(p) {
  const pc = p.kind === 'corner' ? TC.corner : TC.middle, D = DRAW.r2[p.kind];
  const r = pc.jawRadius, m2 = (pc.mouth + TC.mouthExtra) / 2, w = CW;
  const sweep = p.kind === 'corner' ? Math.PI / 4 : Math.PI / 2;
  const u = p.inward, v = { x: -u.y, y: u.x }, O = p.mouthMid;
  const W = ([d, l]) => ({ x: O.x + d * u.x + l * v.x, y: O.y + d * u.y + l * v.y });
  const hwid = (d) => (d >= 0 ? m2 : m2 + r - Math.sqrt(Math.max(0, r * r - d * d)));
  const ff = p.fallFront, Rc = p.captureRadius, dc = ff + Rc;
  const chw = (d) => Math.sqrt(Math.max(0, Rc * Rc - (d - dc) ** 2));
  let lo = ff, hi = dc; // depth where the hole edge meets the nose
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (hwid(m) > chw(m)) lo = m; else hi = m; }
  const dS = (lo + hi) / 2, N = 24, M = 64;
  const arc = (t0, t1, rad) => Array.from({ length: N + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / N; return [-rad * Math.sin(t), m2 + r - rad * Math.cos(t)]; });
  const mir = (pts) => pts.map(([d, l]) => [d, -l]);
  const rev = (pts) => [...pts].reverse();
  const noseFrom = (a, b) => (a < 0 ? [...arc(Math.asin(-a / r), 0, r), ...(b > 0 ? [[b, m2]] : [])] : [[a, m2], [b, m2]]);
  // bed edge: nose from the tangent point to where the hole starts, the front of the hole, the other nose
  const sideA = dS < 0 ? arc(sweep, Math.asin(-dS / r), r) : [...arc(sweep, 0, r), [dS, m2]];
  const phiS = Math.atan2(hwid(dS), dS - dc);
  const front = Array.from({ length: 2 * N + 1 }, (_, i) => { const f = phiS + (2 * Math.PI - 2 * phiS) * i / (2 * N); return [dc + Rc * Math.cos(f), Rc * Math.sin(f)]; });
  const bed = [...sideA, ...front.slice(1, -1), ...rev(mir(sideA))];
  // db = depth where the cushions end; back = the visible back edge of the hole, from the + side round to the - side
  const db = D.db, c0 = [db, 0];
  const ell = (sd, sl) => Array.from({ length: M + 1 }, (_, i) => { const a = Math.PI / 2 - Math.PI * i / M; return [db + sd * Math.cos(a), sl * Math.sin(a)]; });
  const back = ell(D.bulge, m2);
  if (db < dS || db < 0) throw new Error(`pocket ${p.id}: db ${db} must be >= ${dS.toFixed(3)} and >= 0`);
  // the hole as seen from above: front of the slate cut, the noses up to the cushion ends, then the back
  const sideIn = noseFrom(dS, db);
  const pit = [...front, ...mir(sideIn).slice(1), [db, -m2], ...rev(back), [db, m2], ...rev(sideIn).slice(0, -1)];
  const frontCount = front.length, b0 = frontCount + sideIn.length;
  // back of the hole: its dark lining runs up to the rail top and covers the wooden cut face
  const backFlags = pit.map((_, i) => i >= b0 && i < b0 + back.length);
  // cushion end (one side): nose from the tangent point to db, back edge offset by the cushion width
  const bandFront = [...arc(sweep, 0, r), ...(db > 0 ? [[db, m2]] : [])];
  const bandBack = [...(db > 0 ? [[db, m2 + w]] : []), ...arc(0, sweep, r - w)];
  const band = [...bandFront, ...bandBack];
  // rail edge around the pocket: back of the cushion, back of the hole, other side
  const railSide = [...arc(sweep, 0, r - w), ...(db > 0 ? [[db, m2 + w]] : [])];
  const rail = [...railSide, ...back, ...rev(mir(railSide))];
  // leather cap on the rail top behind the hole
  let cap;
  {
    // its front edge starts at the very end of the nose (T), leaves it at a shallow angle and crosses the cushion top
    // to the wood (B): what is left of the green is a wedge that narrows to nothing at the hole
    const jr = r - w - DRAW.cap.over, T = [db, m2], B = [-jr * Math.sin(D.tB), m2 + r - jr * Math.cos(D.tB)];
    const C = [(db + B[0]) / 2, m2 + 0.004];
    const edge = Array.from({ length: 17 }, (_, i) => { const t = i / 16, a = (1 - t) ** 2, b = 2 * t * (1 - t), c = t * t; return [a * T[0] + b * C[0] + c * B[0], a * T[1] + b * C[1] + c * B[1]]; });
    for (const [d, l] of edge) if (l < hwid(d) - 1e-9) throw new Error(`pocket ${p.id}: the leather cap covers the physics mouth`);
    let outer = [...edge, ...ell(D.bulge + DRAW.cap.back, m2 + w + 2 * DRAW.cap.over), ...rev(mir(edge))];
    for (let n = 0; n < 12; n++) outer = outer.map((q, i) => { // round off its outer corners
      if (i < 12 || i > outer.length - 13) return q;
      const a = outer[i - 1], b = outer[i + 1]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
    cap = [...outer, ...rev(back).slice(1, -1)];
  }
  // nothing may reach the outer edge of the wood
  const X = hw + V.rim, Y = hl + V.rim, rr = CORNER_ROUND;
  const sdOuter = (q) => { const qx = Math.abs(q.x) - (X - rr), qy = Math.abs(q.y) - (Y - rr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
  for (const q of cap) if (sdOuter(W(q)) > -0.008) throw new Error(`pocket ${p.id}: drawing reaches the outer rail edge`);
  // self-check: the drawn jaw noses lie exactly on the physics jaw circles
  for (const [d, l] of arc(sweep, 0, r)) for (const s of [1, -1]) {
    const q = W([d, s * l]);
    const err = Math.min(...table.jaws.filter((j) => j.pocket === p.id).map((j) => Math.abs(Math.hypot(q.x - j.centre.x, q.y - j.centre.y) - r)));
    if (err > 1e-9) throw new Error(`pocket ${p.id}: drawn jaw is ${err} m off the physics jaw`);
  }
  // demo balls (physics positions; drawn 1.4x)
  const tY = sweep * 0.55, ny = [-Math.sin(tY), -Math.cos(tY)], nose = [-r * Math.sin(tY), m2 + r - r * Math.cos(tY)];
  const demo = [
    { kind: 'red', pos: W([ff + 0.010, -0.014]), z: R * S - 0.014 },
    { kind: 'yellow', pos: W([nose[0] + R * ny[0], nose[1] + R * ny[1]]), z: R * S },
    { kind: 'blue', pos: W([ff - 0.20, -0.07]), z: R * S },
  ];
  const toW = (pts) => pts.map(W);
  const k = 1 - 0.0006 / Rc, inset = (pts) => pts.map(([d, l], i) => (backFlags[i] ? [c0[0] + (d - c0[0]) * k, l * k] : [d, l]));
  const noses = [bandFront, mir(bandFront)].map(toW), bands = [band, mir(band)].map(toW);
  // how far into the pocket a point is: 0 on the open bed, 1 from the front edge of the hole inwards (for shading the jaws)
  const into = (x, y) => { const d = (x - O.x) * u.x + (y - O.y) * u.y, t = Math.min(1, Math.max(0, (d - (dS - 0.06)) / 0.06)); return t * t * (3 - 2 * t); };
  return { p, W, bed: toW(bed), pit: toW(pit), pitWall: toW(inset(pit)), backFlags, frontCount, bands, noses, rail: toW(rail),
    cap: toW(cap), into, demo, geo: { r, m2, w, sweep, W, hwid, dS, dc, Rc, sideA, noseFrom } };
}
function makeShapes() {
  const list = table.pockets.map((p) => pocketShapes(p));
  // walk round the table (anticlockwise) so the pocket paths join up along the straight cushions
  list.sort((a, b) => Math.atan2(a.p.mouthMid.y, a.p.mouthMid.x) - Math.atan2(b.p.mouthMid.y, b.p.mouthMid.x));
  list.forEach((s, i) => {
    const next = list[(i + 1) % list.length].p.mouthMid, b = s.bed;
    const dEnd = Math.hypot(b[b.length - 1].x - next.x, b[b.length - 1].y - next.y), dStart = Math.hypot(b[0].x - next.x, b[0].y - next.y);
    if (dStart < dEnd) { s.bed.reverse(); s.rail.reverse(); }
  });
  return list;
}
const shapes = makeShapes(); // bed outline, demo balls and close-up cameras are the same for every option
// ---------- S1 / T1 pocket (same frame: d = depth, l = sideways). `nextMid` = mouth of the next pocket round the table ----------
function s1Pocket(s, nextMid, style) {
  const { r, m2, w, sweep, W, hwid, dS, dc, Rc, sideA, noseFrom } = s.geo, D = DRAW[style], slot = style === 't1' && s.p.kind === 'middle';
  const circ = (rad, f) => [dc + rad * Math.cos(f), rad * Math.sin(f)];
  // the rail line (back of the cushion) runs straight on towards the pocket; P = where the nose (jaw) crosses it.
  // The cushion top is the sliver between the nose and that line, so it narrows to nothing at P.
  const Bt = [-(r - w) * Math.sin(sweep), m2 + r - (r - w) * Math.cos(sweep)], dir = [Math.cos(sweep), -Math.sin(sweep)];
  const sideOf = (q) => dir[0] * (q[1] - Bt[1]) - dir[1] * (q[0] - Bt[0]);
  let i = 1; while (i < sideA.length && sideOf(sideA[i]) * sideOf(sideA[0]) > 0) i++;
  if (i >= sideA.length) throw new Error(`pocket ${s.p.id}: the jaw never reaches the rail line`);
  const a = sideA[i - 1], b = sideA[i], t = sideOf(a) / (sideOf(a) - sideOf(b)), P = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  const nose = [...sideA.slice(0, i), P];
  // rail end: from P along the rest of the nose to the hole (E), a short way round the hole (not for the straight
  // middle opening of T1), then a straight cut, square to the rail, out to the outer edge of the wood
  const E = sideA[sideA.length - 1], a0 = Math.atan2(E[1], E[0] - dc), a1 = slot ? a0 : Math.PI - sweep;
  if (a0 < a1) throw new Error(`pocket ${s.p.id}: rail cut lies in front of the hole`);
  // T1 middle: the rail end is rounded. Its edge runs round with the jaw (same centre), closing in on the nose from the
  // full cushion width to the width of the green strip, so the brown has the shape of the green.
  const t1 = style === 't1', gS = t1 ? D.plate.strip : 0;
  // (the closing-in is eased, so the edge leaves the rail line straight, without a bump)
  const eA = Math.min(1.8, 0.9 * (r - w) * sweep * sweep / 2 / (w - gS || 1)), ease = (x) => x * x * (eA + (4 - 2 * eA) * x + (eA - 3) * x * x);
  const spiralM = () => Array.from({ length: 25 }, (_, k) => { const tt = sweep * (1 - k / 24), rad = r - (w + (gS - w) * ease(k / 24)); return [-rad * Math.sin(tt), m2 + r - rad * Math.cos(tt)]; });
  // T1 corner: the rail edge simply runs straight on along the rail line and then turns, in one small round bend,
  // into the line of the green strip (no bump)
  const spiralC = () => { const rho = 0.04, sx = (Bt[1] - (m2 + gS)) / Math.sin(sweep), X0 = [Bt[0] + sx * dir[0], Bt[1] + sx * dir[1]], tl = rho * Math.tan(sweep / 2), T2 = [X0[0] + tl, X0[1]];
    return [Bt, ...Array.from({ length: 13 }, (_, k) => { const an = -Math.PI / 2 - sweep * (1 - k / 12); return [T2[0] + rho * Math.cos(an), T2[1] + rho + rho * Math.sin(an)]; })]; };
  const spiral = slot ? spiralM() : t1 ? spiralC() : null;
  // T1 corner: the green strip runs on beside the throat until its outer edge meets the round hole (at depth dX)
  const dX = dc - Math.sqrt(Rc * Rc - (m2 + gS) ** 2), aX = Math.atan2(m2 + gS, dX - dc);
  if (t1 && !slot && aX < a1) throw new Error(`pocket ${s.p.id}: green strip ends behind the rail cut`);
  const arcPts = slot ? [[0, m2 + gS]] : Array.from({ length: 9 }, (_, k) => circ(Rc, (t1 ? aX : a0) + (a1 - (t1 ? aX : a0)) * k / 8));
  const cutPt = arcPts[arcPts.length - 1], n = [Math.sin(sweep), Math.cos(sweep)];
  const tOut = V.rim - ((cutPt[0] - sideA[0][0]) * n[0] + (cutPt[1] - sideA[0][1]) * n[1]);
  const outPt = [cutPt[0] + n[0] * tOut, cutPt[1] + n[1] * tOut];
  const wood = slot ? [...spiral.slice(1), outPt] : t1 ? [...spiral.slice(1), ...arcPts, outPt] : [P, ...sideA.slice(i), ...arcPts.slice(1), outPt];
  // T1 middle: the nose runs on along the physics jaw into the pocket (deep = that part, from the hole edge E to the
  // leather), and the cushion top becomes a thin green strip between it and the rail end
  const deep = slot ? noseFrom(dS, D.plate.front + 0.004) : null;
  const noseAll = slot ? [...sideA, ...deep.slice(1)] : t1 ? sideA : nose;
  const bandPts = slot ? [...noseAll, [D.plate.front + 0.004, m2 + gS], ...[...spiral].reverse()] : t1 ? [...sideA, [dX, m2 + gS], ...[...spiral].reverse()] : [...nose, Bt];
  const mk = (fl) => ({ tangent: W(fl(sideA[0])), tanBack: W(fl(Bt)), nose: noseAll.map(fl).map(W), band: bandPts.map(fl).map(W), wood: wood.map(fl).map(W) });
  const plus = mk((q) => q), minus = mk(([d, l]) => [d, -l]);
  const dist = (q) => Math.hypot(q.x - nextMid.x, q.y - nextMid.y);
  const [next, prev] = dist(plus.tangent) < dist(minus.tangent) ? [plus, minus] : [minus, plus];
  // a strip of width 2t along a line (for the light inner lip of the leather)
  const band = (line, tt) => { const off = (sg) => line.map((q, k) => { const p0 = line[Math.max(0, k - 1)], p1 = line[Math.min(line.length - 1, k + 1)], nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0], nl = Math.hypot(nx, ny) || 1; return [q[0] + sg * tt * nx / nl, q[1] + sg * tt * ny / nl]; }); return [...off(1), ...off(-1).reverse()]; };
  const Nf = 24, Nb = 72, net = { pos: [], uv: [], idx: [], col: [] };
  const grid = (NA, NR, at) => { // at(ia / NA, ir / NR) -> [d, l, z, u, v, alpha (optional)]
    for (let ia = 0; ia <= NA; ia++) for (let ir = 0; ir <= NR; ir++) {
      const [d, l, z, uu, vv, al] = at(ia / NA, ir / NR), wq = W([d, l]); net.pos.push(wq.x, wq.y, z); net.uv.push(uu, vv);
      if (al !== undefined) net.col.push(1, 1, 1, al);
      if (ia && ir) { const A0 = (ia - 1) * (NR + 1) + ir - 1, B0 = ia * (NR + 1) + ir - 1; net.idx.push(A0, B0, A0 + 1, A0 + 1, B0, B0 + 1); }
    }
  };
  // front of the hole (on the bed) = front of the physics drop circle: the wall starts at the cloth
  const frontPts = Array.from({ length: Nf + 1 }, (_, k) => circ(Rc, a0 + (2 * Math.PI - 2 * a0) * k / Nf));
  let rest, restFlags, leather, lip = null, bevel = 0.006;
  if (slot) {
    // T1 middle: behind the front of the drop circle the hole is a straight opening as wide as the mouth, ending
    // under the leather plate. Along the green strips its wall starts at the cloth; behind them at the rail top.
    const pl = D.plate, dOut = cutPt[0] + tOut, dEdge = dOut - pl.inset - pl.round, Ls = m2 + pl.side, kI = 0.99, dG = deep[deep.length - 1][0];
    const mirL = (pts) => pts.map(([d, l]) => [d, -l]);
    const boxPts = [[dG, -m2 * kI], [dEdge - 0.004, -m2 * kI], [dEdge - 0.004, m2 * kI], [dG, m2 * kI]];
    rest = [...mirL(deep).slice(1), ...boxPts, ...[...deep].reverse().slice(0, -1)];
    restFlags = [...deep.slice(1).map(() => false), ...boxPts.map(() => true), ...deep.slice(1).map(() => false)];
    // leather plate: concave inner edge round the net, two short arms over the green strips and the rail ends, and a
    // gently rounded outer edge that stays inside the outer edge of the wood
    const inner = Array.from({ length: 41 }, (_, k) => { const an = Math.PI / 2 - Math.PI * k / 40; return [pl.front + pl.depth * Math.cos(an), m2 * Math.sin(an)]; });
    const capM = Array.from({ length: 9 }, (_, k) => { const be = Math.PI * (k + 1) / 10; return [pl.front - pl.side / 2 * Math.sin(be), -m2 - pl.side / 2 + pl.side / 2 * Math.cos(be)]; });
    const outerB = Array.from({ length: 41 }, (_, k) => { const an = -Math.PI / 2 + Math.PI * k / 40; return [dEdge + pl.round * Math.cos(an), Ls * Math.sin(an)]; });
    const capP = Array.from({ length: 9 }, (_, k) => { const be = Math.PI * (k + 1) / 10; return [pl.front - pl.side / 2 * Math.sin(be), m2 + pl.side / 2 + pl.side / 2 * Math.cos(be)]; });
    leather = [...inner, ...capM, ...outerB, ...capP]; lip = band(inner.slice(3, -3), D.lip2); bevel = 0.004;
    for (const q of leather) if (q[0] > dOut) throw new Error(`pocket ${s.p.id}: the leather plate sticks out of the table`);
    // net: a bag hanging almost straight down from the rim: along both sides of the hole (from the top of the green
    // strips) and round the back (from the inner edge of the leather). It leans inwards only a little on its way down,
    // and the texture lets the threads sink into the dark.
    const dMid = (dS + pl.front + pl.depth) / 2, fadeM = (d) => Math.max(0, Math.min(1, (d - dMid) / D.netFade)) ** 1.5; // only the back half of the hole
    const kN = 0.975, sideP = Array.from({ length: 7 }, (_, k) => [pl.netFront + (pl.front - pl.netFront) * k / 6, m2 * kN]);
    const rim = [...sideP.map((q) => ({ q, inw: [0, -1], top: H.cushion - 0.002, al: fadeM(q[0]) })),
      ...inner.slice(1, -1).map(([d, l]) => { const q = [pl.front + (d - pl.front) * kN, l * kN], nl = Math.hypot(q[0] - pl.front, q[1]); return { q, inw: [-(q[0] - pl.front) / nl, -q[1] / nl], top: D.netTop, al: fadeM(q[0]) }; }),
      ...sideP.reverse().map((q) => ({ q: [q[0], -q[1]], inw: [0, 1], top: H.cushion - 0.002, al: fadeM(q[0]) }))];
    let run = 0; rim.forEach((e, k) => { if (k) run += Math.hypot(e.q[0] - rim[k - 1].q[0], e.q[1] - rim[k - 1].q[1]); e.run = run; });
    grid(rim.length - 1, 8, (fa, fr) => { const e = rim[Math.round(fa * (rim.length - 1))];
      return [e.q[0] + e.inw[0] * pl.netLean * fr, e.q[1] + e.inw[1] * pl.netLean * fr, e.top - (e.top - D.netBottom) * fr, 1 - 0.5 * fr, e.run / (2 * Rc), e.al]; });
  } else {
    if (t1) {
      // T1 corner: the leather is a band along the outer line of the table: it starts at the outer corner of one rail
      // end, runs straight on, turns the table corner in one round bend and runs straight to the other rail end.
      // path(q) = that line moved inwards by q, from the + side to the - side.
      const dC = outPt[0] + outPt[1], dA = dC - CORNER_ROUND * Math.SQRT2;
      // It lies `inset` inside the outer line of the table, and its straight parts curl in very slightly (`curl`)
      // towards their ends.
      // `grow`: the inner edge moves further in towards each end (thin round the bend, thick at the ends), so that at
      // the rail end the band reaches right in to the hole.
      const endW = tOut - D.inset;
      const path = (q0, grow) => { const qAt = (tt) => q0 + D.inset + (grow ? (endW - D.band) * tt ** D.taper : 0), rc = CORNER_ROUND - qAt(0);
        const straight = Array.from({ length: 16 }, (_, k) => { const tt = 1 - k / 16, c = D.curl * tt * tt, q = qAt(tt), r1 = CORNER_ROUND - q, S0 = [dA + r1 * Math.SQRT1_2, r1 * Math.SQRT1_2], J = [cutPt[0] + n[0] * (tOut - q), cutPt[1] + n[1] * (tOut - q)];
          return [J[0] + (S0[0] - J[0]) * (1 - tt) - n[0] * c, J[1] + (S0[1] - J[1]) * (1 - tt) - n[1] * c]; });
        const bend = Array.from({ length: 25 }, (_, k) => { const an = Math.PI / 4 - Math.PI / 2 * k / 24; return [dA + rc * Math.cos(an), rc * Math.sin(an)]; });
        return [...straight, ...bend, ...straight.map(([d, l]) => [d, -l]).reverse()]; };
      // its four end corners are rounded off a little
      const soft = (A, B, C, rr2 = 0.007) => { const ua = Math.hypot(B[0] - A[0], B[1] - A[1]), uc = Math.hypot(C[0] - A[0], C[1] - A[1]), a = [(B[0] - A[0]) / ua * rr2, (B[1] - A[1]) / ua * rr2], c = [(C[0] - A[0]) / uc * rr2, (C[1] - A[1]) / uc * rr2];
        return [[A[0] + a[0], A[1] + a[1]], [A[0] + 0.3 * (a[0] + c[0]), A[1] + 0.3 * (a[1] + c[1])], [A[0] + c[0], A[1] + c[1]]]; };
      // The inner edge then runs on round the hole to the point where the green strip meets the rail end: the leather
      // starts exactly there.
      const G = circ(Rc, aX), po = path(0), pi = [G, ...path(D.band, true).slice(1, -1), [G[0], -G[1]]], no = po.length - 1, ni = pi.length - 1;
      leather = [...soft(po[0], pi[0], po[2]), ...po.slice(2, -2), ...soft(po[no], po[no - 2], pi[ni]), ...soft(pi[ni], po[no], pi[ni - 3], 0.014), ...pi.slice(3, -3).reverse(), ...soft(pi[0], pi[3], po[0], 0.014)];
      lip = band(pi.slice(3, -3), D.lip2); bevel = 0.005;
      // the hole: the physics drop circle, opened out behind up to the rail ends and the leather band
      const sideArc = (sg) => Array.from({ length: 5 }, (_, k) => circ(Rc - 0.0006, sg * (a0 + (a1 - a0) * k / 4)));
      rest = [...sideArc(-1), ...path(D.band + 0.0008, true).reverse(), ...sideArc(1).reverse()]; restFlags = rest.map(() => true);
      // net: a bag hanging almost straight down from that whole edge; it fades out towards the front, where the balls drop in
      const aN = a0 - 0.05, fine = (pts) => pts.flatMap((q, k) => (k ? [[(pts[k - 1][0] + q[0]) / 2, (pts[k - 1][1] + q[1]) / 2], q] : [q]));
      const edge = [...Array.from({ length: 5 }, (_, k) => circ(Rc * 0.975, aN + (a1 - aN) * k / 4)), ...fine(path(D.band + 0.003, true)), ...Array.from({ length: 5 }, (_, k) => circ(Rc * 0.975, -a1 - (aN - a1) * k / 4))];
      const rim = edge.map((q) => { const nl = Math.hypot(q[0] - dc, q[1]); return { q, inw: [-(q[0] - dc) / nl, -q[1] / nl], al: Math.max(0, Math.min(1, (q[0] - dc) / D.netFade)) ** 1.5 }; });
      let run = 0; rim.forEach((e, k) => { if (k) run += Math.hypot(e.q[0] - rim[k - 1].q[0], e.q[1] - rim[k - 1].q[1]); e.run = run; });
      grid(rim.length - 1, 8, (fa, fr) => { const e = rim[Math.round(fa * (rim.length - 1))];
        return [e.q[0] + e.inw[0] * D.plate.netLean * fr, e.q[1] + e.inw[1] * D.plate.netLean * fr, D.netTop - (D.netTop - D.netBottom) * fr, 1 - 0.5 * fr, e.run / (2 * Rc), e.al]; });
    } else {
      // S1: round hole = the physics drop circle; behind the front part its wall runs up to the rail top
      rest = Array.from({ length: Nb + 1 }, (_, k) => circ(Rc - 0.0006, -a0 + 2 * a0 * k / Nb)); restFlags = rest.map(() => true);
      // leather arc round the outside of the hole, with round ends lying on the two rail ends
      const aL = a1 + D.over[s.p.kind], ri = Rc - D.lip, ro = Rc + D.width, rm = (ri + ro) / 2, h = (ro - ri) / 2, K = 72;
      const endCap = (fz, sg) => Array.from({ length: 9 }, (_, k) => { const be = Math.PI * (k + 1) / 10, e = [Math.cos(fz), Math.sin(fz)], tt = [sg * Math.sin(fz), -sg * Math.cos(fz)], c = sg * Math.cos(be), sn = Math.sin(be);
        return [dc + rm * e[0] + h * (c * e[0] + sn * tt[0]), rm * e[1] + h * (c * e[1] + sn * tt[1])]; });
      leather = [...Array.from({ length: K + 1 }, (_, k) => circ(ro, aL - 2 * aL * k / K)), ...endCap(-aL, 1),
        ...Array.from({ length: K + 1 }, (_, k) => circ(ri, -aL + 2 * aL * k / K)), ...endCap(aL, -1)];
      // net: half a bowl hanging in the back half of the hole (high at the rim, low in the middle)
      grid(32, 8, (fa, fr) => { const q = circ((Rc - 0.001) * fr, -Math.PI / 2 + Math.PI * fa);
        return [q[0], q[1], D.netBottom + (D.netTop - D.netBottom) * fr * fr, (q[0] - dc + Rc) / (2 * Rc), (q[1] + Rc) / (2 * Rc)]; });
    }
  }
  for (const [d, l] of leather) if (d < dS && Math.abs(l) < hwid(d)) throw new Error(`pocket ${s.p.id}: the leather covers the physics mouth`);
  const hole = { pitWall: [...frontPts, ...rest].map(W), frontCount: Nf + 1, backFlags: [...frontPts.map(() => false), ...restFlags] };
  return { next, prev, hole, leather: leather.map(W), lip: lip && lip.map(W), bevel, net, netKind: style };
}
const S1_ALL = shapes.map((s, i) => s1Pocket(s, shapes[(i + 1) % shapes.length].p.mouthMid, 's1'));
const T1 = shapes.map((s, i) => s1Pocket(s, shapes[(i + 1) % shapes.length].p.mouthMid, 't1'));
const v2 = (pts) => pts.map((q) => new THREE.Vector2(q.x, q.y));
// ---------- procedural textures (drawn in code, no image files) ----------
function noiseTexture(base, amount, size = 256, grain = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    let n = (rnd() - 0.5) * amount * 255;
    if (grain) n += Math.sin(y * 0.11 + Math.sin(x * 0.02) * 3) * 14 + Math.sin(y * 0.53) * 5;
    d[i] += n; d[i + 1] += n * 0.8; d[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Table markings (owner 2026-11-27): baulk line, the D (towards the baulk cushion) and the six spots, painted into
// one transparent picture laid over the bed with the same metre-based mapping as the edge shading. Positions come from
// the table geometry (the spots the rules use). The picture is drawn at CONFIG.view3d.markings.pxPerM with mipmaps
// and anisotropy, so a line a few millimetres wide stays smooth and steady at phone size.
// Night 6 (frame time): the picture covers only where there are marks: the band of the baulk line and the D, and a
// small square round each of the blue, pink and black spots. A layer over the whole bed cost about 6% frame time.
function markingsPieces(maxAniso) {
  const M = CONFIG.view3d.markings, pad = 0.02;
  const draw = (g, px, py, W) => {
    g.strokeStyle = g.fillStyle = `rgba(${M.colour}, ${M.alpha})`;
    g.lineWidth = M.lineWidth * M.pxPerM;
    g.beginPath(); g.moveTo(0, py(table.baulkY)); g.lineTo(W, py(table.baulkY)); g.stroke(); // baulk line, cushion to cushion
    // the D: half circle on the baulk line, on the baulk-cushion side (-y = down on the canvas)
    g.beginPath(); g.arc(px(table.dCentre.x), py(table.dCentre.y), table.dRadius * M.pxPerM, 0, Math.PI, false); g.stroke();
    for (const s of Object.values(table.spots)) { g.beginPath(); g.arc(px(s.x), py(s.y), M.spotRadius * M.pxPerM, 0, 2 * Math.PI); g.fill(); }
  };
  const piece = (x0, x1, y0, y1) => { // one textured rectangle of the bed, [x0,x1] x [y0,y1] in table metres
    const W = Math.round((x1 - x0) * M.pxPerM), Hh = Math.round((y1 - y0) * M.pxPerM);
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    draw(c.getContext('2d'), (x) => (x - x0) * M.pxPerM, (y) => (y1 - y) * M.pxPerM, W);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = maxAniso;
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0); geo.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return { geo, map: t };
  };
  const sp = table.spots, q = M.spotRadius + pad;
  return [piece(-hw, hw, table.baulkY - table.dRadius - pad, table.baulkY + pad),
    ...[sp.blue, sp.pink, sp.black].map((s) => piece(s.x - q, s.x + q, s.y - q, s.y + q))];
}
function vignette(strength) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 40, 128, 128, 180);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
// Even light over the whole table, all four rails and all six pockets (same for every option and every view):
// soft light from all round + one wide lamp straight above for the ball shadows; only a gentle falloff to the edges.
const EDGE_DARK = 0.2; // how much the cloth darkens towards the table edge (0 = not at all)
function addLamp(sc) {
  sc.add(new THREE.HemisphereLight('#fff1dc', '#5a4632', 1.25));
  const lamp = new THREE.DirectionalLight('#ffe6bd', 2.4); lamp.position.set(0.3, -1.6, 4); lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0005; lamp.shadow.radius = 4;
  const c = lamp.shadow.camera; c.left = -1.4; c.right = 1.4; c.top = 2.3; c.bottom = -2.3; c.near = 0.5; c.far = 6;
  sc.add(lamp, lamp.target);
}
const clothTex = () => { const t = noiseTexture(A.cloth, 0.07, 256); t.repeat.set(3.4, 3.4); return t; }; // uv = metres
// Wood of the rails (night 5): one long grain that runs ALONG the rail. The picture covers WOOD.along metres along
// the grain (left-right on the picture) and WOOD.across metres across it (up-down), and it repeats seamlessly in both
// directions, so no block edge or seam shows. railUv() lays it on each rail piece in metres along that rail's own
// length, so all four rails get the same grain at the same scale. Grain = one pattern across (broad soft shades +
// fine darker lines), bent gently and slowly along the length. `dark` / `light` = the two ends of the shade range.
const WOOD = { along: 2.0, across: 0.5, w: 1024, h: 256, dark: [40, 17, 7], light: [112, 56, 26], broad: 0.55, fine: 0.35, pores: 0.06 };
function woodTex() {
  const W = WOOD.w, Hh = WOOD.h, c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  let seed = 4711; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  // smooth random profile that repeats after n cells (cosine-eased value noise)
  const vnoise = (n) => { const v = Array.from({ length: n }, () => rnd() * 2 - 1);
    return (t) => { const f = ((t % n) + n) % n, i = Math.floor(f), k = (1 - Math.cos((f - i) * Math.PI)) / 2; return v[i] * (1 - k) + v[(i + 1) % n] * k; }; };
  // the profile across the grain (one value per row, repeating after Hh rows): broad shades + fine lines
  const b1 = vnoise(6), b2 = vnoise(14), f1 = vnoise(48), f2 = vnoise(110);
  const prof = new Float32Array(Hh * 4); // 4x finer than a row, read with linear interpolation
  for (let i = 0; i < prof.length; i++) {
    const r = i / prof.length;
    const broad = 0.65 * b1(r * 6) + 0.35 * b2(r * 14);
    const fine = 0.6 * f1(r * 48) + 0.4 * f2(r * 110);
    prof[i] = WOOD.broad * broad + WOOD.fine * Math.sign(fine) * Math.pow(Math.abs(fine), 0.7);
  }
  const at = (r) => { const f = (((r % 1) + 1) % 1) * prof.length, i = Math.floor(f), k = f - i; return prof[i] * (1 - k) + prof[(i + 1) % prof.length] * k; };
  // how the lines bend: slow waves along the length (whole numbers of waves per picture, so it still repeats)
  const ph = Array.from({ length: 4 }, () => rnd() * Math.PI * 2), TAU = Math.PI * 2;
  const pore = vnoise(97);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / Hh;
    const bend = 0.030 * Math.sin(TAU * u + ph[0]) + 0.014 * Math.sin(TAU * 3 * u + ph[1]) + 0.010 * Math.sin(TAU * (2 * u + v) + ph[2]) + 0.004 * Math.sin(TAU * (7 * u - 2 * v) + ph[3]);
    // short pores: tiny dark flecks stretched along the grain
    const p = pore(u * 97 + Math.floor(v * 97) * 13.7) * pore(v * 194);
    const t = Math.max(-1, Math.min(1, at(v + bend) - WOOD.pores * Math.max(0, p) * 4));
    const m = (t + 1) / 2, i = (y * W + x) * 4;
    for (let ch = 0; ch < 3; ch++) d[i + ch] = WOOD.dark[ch] + (WOOD.light[ch] - WOOD.dark[ch]) * m;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8; tex.repeat.set(1 / WOOD.along, 1 / WOOD.across); // uv in metres
  return tex;
}
// uv of a rail piece in metres: u = along the piece's long side, v = across it, running on down the upright faces
// (so the grain turns over the top edge without a break). `k` shifts each piece to a different part of the picture.
function railUv(geo, k) {
  const P = geo.attributes.position; geo.computeBoundingBox(); const bb = geo.boundingBox;
  const alongX = bb.max.x - bb.min.x >= bb.max.y - bb.min.y, uv = [];
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const a = alongX ? x : y, b = alongX ? y : x;
    uv.push(a + k * 0.61, b - z + k * 0.17);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}
// ---------- new drawing (S1, R2) ----------
function fadeTexture(rgb, alpha) { // a soft line: `alpha` at the edge, fading to nothing
  const c = document.createElement('canvas'); c.width = 64; c.height = 4;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, `rgba(${rgb},${alpha})`); gr.addColorStop(0.45, `rgba(${rgb},${alpha * 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
  return new THREE.CanvasTexture(c);
}
// T1 leather, painted for one piece (outline `pts`, in metres): the colour runs from dark at the edge to light in the
// middle (LEATHER.rim = width of the steep part, LEATHER.far = distance over which it keeps getting a little lighter, so
// wide parts are never one flat colour), with a faint stitch line and fine grain. `bump` = the same as a height, so the
// lamp lights the piece as a rounded cushion. uv(x, y) = where a point of the piece lies on the picture.
const LEATHER = { base: [190, 136, 88], rim: 0.008, far: 0.055, edge: 0.60, mid: 0.30, slope: 0.20, stitch: 0.0055, stitchDash: [0.0032, 0.0022], grain: 9 };
function leatherTexture(pts) {
  const L = LEATHER, n = 512, xs = pts.map((q) => q.x), ys = pts.map((q) => q.y), pad = 0.004;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, side = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) + pad, sc = n / side;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.lineJoin = g.lineCap = 'round'; return [c, g]; };
  const [cc, gc] = mk(), [cb, gb] = mk();
  const trace = (g) => { g.beginPath(); pts.forEach((q, k) => { const px = (q.x - x0) * sc, py = n - (q.y - y0) * sc; if (k) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); };
  const sm = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const light = (x) => L.edge + L.mid * sm(x / L.rim) + L.slope * Math.min(1, x / L.far); // brightness at distance x from the edge
  const high = (x) => 0.75 * sm(x / (1.6 * L.rim)) + 0.25 * Math.min(1, x / L.far);        // height at distance x from the edge
  const col = (f) => `rgb(${L.base.map((v) => Math.round(Math.min(255, v * f))).join(',')})`, grey = (h) => { const v = Math.round(255 * h); return `rgb(${v},${v},${v})`; };
  gc.fillStyle = col(light(0)); gc.fillRect(0, 0, n, n); gb.fillStyle = grey(0); gb.fillRect(0, 0, n, n);
  trace(gc); gc.fillStyle = col(light(L.far)); gc.fill(); trace(gb); gb.fillStyle = grey(high(L.far)); gb.fill();
  // rings from the inside outwards: each stroke repaints everything nearer to the edge than x
  const step = 1.1 / sc; let stitched = false;
  for (let x = L.far; x > 0; x -= step) {
    trace(gc); gc.lineWidth = 2 * x * sc; gc.strokeStyle = col(light(x)); gc.stroke();
    trace(gb); gb.lineWidth = 2 * x * sc; gb.strokeStyle = grey(high(x)); gb.stroke();
    if (!stitched && x <= L.stitch) { stitched = true; gc.setLineDash(L.stitchDash.map((v) => v * sc)); trace(gc); gc.strokeStyle = col(light(x) * 1.22); gc.stroke();
      gb.setLineDash(L.stitchDash.map((v) => v * sc)); trace(gb); gb.strokeStyle = grey(Math.max(0, high(x) - 0.10)); gb.stroke(); gc.setLineDash([]); gb.setLineDash([]); }
  }
  let seed = 4321; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (const [g, amt] of [[gc, L.grain], [gb, L.grain * 0.8]]) { const img = g.getImageData(0, 0, n, n), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (rnd() - 0.5) * amt; d[i] += v; d[i + 1] += v; d[i + 2] += v; } g.putImageData(img, 0, 0); }
  const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(cb); bump.anisotropy = 8;
  return { map, bump, uv: (x, y) => [(x - x0) / side, (y - y0) / side] };
}
// net threads on nothing; the net starts between u = from and u = to (u = depth into the pocket) and is full behind that
function netTexture(from, to, step, width, colour, deep = false) {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.strokeStyle = colour; g.lineWidth = width;
  for (let i = -n; i < 2 * n; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + n, n); g.stroke(); g.beginPath(); g.moveTo(i + n, 0); g.lineTo(i, n); g.stroke(); }
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(n * from, 0, n * to, 0); gr.addColorStop(0, 'rgba(0,0,0,0)');
  if (deep) { gr.addColorStop(0.4, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.45)'); } // threads sink into the dark
  gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapT = THREE.RepeatWrapping;
  return t;
}
// a strip along a line of points, `width` wide, on the side of `toward` (sign +1) or the other side (sign -1)
function edgeStrip(pts, toward, sign, width, z, mat) {
  const pos = [], uv = [], idx = [];
  pts.forEach((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const s = (nx * (toward.x - q.x) + ny * (toward.y - q.y) > 0 ? 1 : -1) * sign;
    pos.push(q.x, q.y, z, q.x + nx * s * width, q.y + ny * s * width, z); uv.push(0.01, 0.5, 0.99, 0.5);
    if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.renderOrder = 2; return m;
}
const centre = (pts) => ({ x: pts.reduce((t, q) => t + q.x, 0) / pts.length, y: pts.reduce((t, q) => t + q.y, 0) / pts.length });
function buildNew(mode, sc, withLamp = true) {
  const S1 = mode === 's1' ? S1_ALL : mode === 't1' ? T1 : null, s1 = !!S1, t1 = mode === 't1';
  sc.background = new THREE.Color(A.bg);
  const clothMat = new THREE.MeshStandardMaterial({ map: clothTex(), roughness: 0.95 }); // ONE cloth for bed and cushions
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.45 });

  // bed: one piece, cloth right up to the front edge of every hole
  const bedShape = new THREE.Shape(v2(shapes.flatMap((s) => s.bed)));
  const bedGeo = new THREE.ShapeGeometry(bedShape, 12);
  const bed = new THREE.Mesh(bedGeo, clothMat); bed.receiveShadow = true; sc.add(bed);
  // the same darkening towards the edges lies on the bed AND on the cushion tops, so they stay one colour
  const vt = vignette(EDGE_DARK); vt.repeat.set(1 / (2 * hw), 1 / (2 * hl)); vt.offset.set(0.5, 0.5);
  const vigMat = new THREE.MeshBasicMaterial({ map: vt, transparent: true, depthWrite: false });
  // table markings: between the cloth and the edge shading (so the shading and the ball shadows lie on them too)
  // (dev: ?marks=0 leaves them out, for frame-time comparisons)
  if (!/marks=0/.test(location.search)) for (const { geo, map } of markingsPieces(8)) {
    const markMat = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.95,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const marks = new THREE.Mesh(geo, markMat); marks.position.z = 0.0002; marks.receiveShadow = true; marks.renderOrder = 0.5; sc.add(marks);
  }
  const vig = new THREE.Mesh(bedGeo, vigMat); vig.position.z = 0.0005; vig.renderOrder = 1; sc.add(vig);

  const extrude = (pts, depth, mat, z0, bevel = 0) => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(v2(pts)), { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 12 }), mat);
    m.position.z = z0 + bevel; m.castShadow = m.receiveShadow = true; sc.add(m); return m;
  };
  // cushions: straight ones between pockets + the rounded ends, all the same cloth as the bed, all inside the rail.
  // Told apart from the bed only by shading: a soft shadow at the foot and a slightly lit top edge.
  const shadeMat = new THREE.MeshBasicMaterial({ map: fadeTexture('0,0,0', 0.38), transparent: true, depthWrite: false });
  const lightMat = new THREE.MeshBasicMaterial({ map: fadeTexture('255,246,214', 0.2), transparent: true, depthWrite: false });
  const faceMat = new THREE.MeshStandardMaterial({ map: clothMat.map, color: '#c4c4c4', roughness: 0.95 });
  const jawMat = new THREE.MeshStandardMaterial({ map: clothMat.map, color: '#c4c4c4', roughness: 0.95, vertexColors: true });
  const cushion = (pts, nose, into) => {
    // top = the bed cloth; upright faces a little darker, and much darker where a jaw turns into the pocket
    const m = extrude(pts, H.cushion, [clothMat, into ? jawMat : faceMat], 0);
    if (into) {
      const g = m.geometry, P = g.attributes.position, Nn = g.attributes.normal, col = [];
      for (let i = 0; i < P.count; i++) { const c = Math.abs(Nn.getZ(i)) > 0.5 ? 1 : 1 - (t1 ? SHADE.jaw : 0.8) * into(P.getX(i), P.getY(i)); col.push(c, c, c); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    const top = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(v2(pts)), 12), vigMat); top.position.z = H.cushion + 0.0004; top.renderOrder = 1; sc.add(top);
    const c = centre(pts);
    sc.add(edgeStrip(nose, c, -1, 0.024, 0.0009, shadeMat), edgeStrip(nose, c, 1, 0.008, H.cushion + 0.0008, lightMat));
  };
  shapes.forEach((s, i) => {
    const n = shapes[(i + 1) % shapes.length];
    if (s1) { // straight cushion, the two pointed cushion ends of this pocket, and the piece of rail up to the next pocket
      const a = S1[i].next, b = S1[(i + 1) % shapes.length].prev;
      cushion([a.tangent, b.tangent, b.tanBack, a.tanBack], [a.tangent, b.tangent]);
      for (const e of [S1[i].next, S1[i].prev]) cushion(e.band, e.nose, s.into);
      railUv(extrude([...[...a.wood].reverse(), a.tanBack, b.tanBack, ...b.wood], H.rail - H.railBottom, woodMat, H.railBottom).geometry, i);
      return;
    }
    const a = s.bed[s.bed.length - 1], b = n.bed[0];
    cushion([a, b, n.rail[0], s.rail[s.rail.length - 1]], [a, b]);
    s.bands.forEach((band, k) => cushion(band, s.noses[k], s.into));
  });

  if (s1) {
    // leather with a rounded top (so it catches the light and throws a shadow), its lighter inner lip (T1), and the net
    const tanMat = new THREE.MeshStandardMaterial({ color: '#c9a26b', roughness: 0.55 });
    const lipMat = new THREE.MeshStandardMaterial({ color: '#dcbb93', roughness: 0.6 });
    const shadeMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
    const netMat = (tex, fade = false) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: fade });
    const nets = t1 ? { t1: netMat(netTexture(0.5, 0.99, 26, 3.2, '#8d8d88', true), true) } : { s1: netMat(netTexture(0.5, 0.58, 34, 5, '#a3a39d')) };
    // a soft-edged piece lying on the rail top. With `shade` (T1 leather) it wears the painted leather (dark edges,
    // light top, lit as a rounded cushion) and a soft dark shadow lies all round it on the wood.
    const puff = (pts, mat, bv, z0, depth, shade = false) => {
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(v2(pts)), { depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: shade ? 8 : 5, curveSegments: 12 });
      if (shade) { const tx = leatherTexture(pts), P = geo.attributes.position, uv = [];
        for (let k = 0; k < P.count; k++) uv.push(...tx.uv(P.getX(k), P.getY(k)));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        mat = new THREE.MeshStandardMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: SHADE.bump, roughness: 0.66 }); }
      const m = new THREE.Mesh(geo, mat);
      // (the T1 leather throws no lamp shadow: that one is hard-edged; the painted soft shadow below replaces it)
      m.position.z = z0 + bv; m.castShadow = !shade; m.receiveShadow = true; sc.add(m);
      if (shade) { const bt = 0.0004, g2 = new THREE.ExtrudeGeometry(new THREE.Shape(v2(pts)), { depth: 0.0001, bevelEnabled: true, bevelThickness: bt, bevelSize: SHADE.width, bevelOffset: 0, bevelSegments: 8, curveSegments: 12 });
        const P = g2.attributes.position, col = [];
        for (let k = 0; k < P.count; k++) { const f = Math.max(0, Math.min(1, -P.getZ(k) / bt)), near = 1 - Math.sqrt(1 - f * f); col.push(0, 0, 0, SHADE.dark * near ** 1.4); }
        g2.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
        const sh = new THREE.Mesh(g2, shadeMat); sh.position.z = H.rail + 0.0012; sh.renderOrder = 2; sc.add(sh); }
    };
    // T1: a soft dark shadow on the bed where the cloth falls into the hole, so the edge of the bed looks rounded
    const fallMat = new THREE.MeshBasicMaterial({ map: fadeTexture('0,0,0', SHADE.fall), transparent: true, depthWrite: false });
    for (const h of S1) {
      if (t1) sc.add(edgeStrip(h.hole.pitWall.slice(0, h.hole.frontCount), centre(h.hole.pitWall), -1, SHADE.fallWidth, 0.0011, fallMat));
      puff(h.leather, tanMat, h.bevel, H.rail - 0.003, 0.006, t1);
      if (h.lip) puff(h.lip, lipMat, 0.002, H.rail - 0.003, 0.006 + 2 * h.bevel - 0.006);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(h.net.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(h.net.uv, 2)); g.setIndex(h.net.idx);
      if (h.net.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(h.net.col, 4));
      const net = new THREE.Mesh(g, nets[h.netKind]); net.renderOrder = 3; sc.add(net);
    }
  } else {
    // rail: one wooden frame, cut away at each pocket (same wood as before)
    const X = hw + V.rim, Y = hl + V.rim, rr = CORNER_ROUND;
    const outer = new THREE.Shape();
    outer.moveTo(-X + rr, -Y); outer.lineTo(X - rr, -Y); outer.absarc(X - rr, -Y + rr, rr, -Math.PI / 2, 0);
    outer.lineTo(X, Y - rr); outer.absarc(X - rr, Y - rr, rr, 0, Math.PI / 2);
    outer.lineTo(-X + rr, Y); outer.absarc(-X + rr, Y - rr, rr, Math.PI / 2, Math.PI);
    outer.lineTo(-X, -Y + rr); outer.absarc(-X + rr, -Y + rr, rr, Math.PI, 1.5 * Math.PI);
    outer.holes.push(new THREE.Path(v2(shapes.flatMap((s) => s.rail))));
    const railMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: H.rail - H.railBottom, bevelEnabled: false }), woodMat);
    railMesh.position.z = H.railBottom; railMesh.castShadow = railMesh.receiveShadow = true; sc.add(railMesh);
    // dark leather cap behind each hole; it starts at cushion height so that it also lies over the cushion ends
    const leatherMat = new THREE.MeshStandardMaterial({ color: '#1b100a', roughness: 0.6 });
    for (const s of shapes) extrude(s.cap, H.rail + 0.005 - H.cushion, leatherMat, H.cushion, 0.002);
  }

  // holes: near-black. The walls only get darker downwards; nothing bright inside.
  for (const s of (s1 ? S1.map((h) => h.hole) : shapes)) {
    const pts = s.pitWall, zs = [0, -0.012, -0.035, -H.pit];
    // top of the wall: leather lining (round back) / cloth rolling over the slate edge (front) / dark (under the cushion ends)
    const top = (i) => (s.backFlags[i] ? [0.022, 0.013, 0.008] : i < s.frontCount ? [0.006, 0.035, 0.014] : [0.006, 0.006, 0.005]);
    const below = [[0.006, 0.006, 0.005], [0.003, 0.003, 0.003], [0.001, 0.001, 0.001]];
    const pos = [], col = [];
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length, a = pts[i], b = pts[j];
      const ca = [top(i), ...below], cb = [top(j), ...below];
      for (let k = 0; k < zs.length - 1; k++) {
        const za = k === 0 && s.backFlags[i] ? H.rail : zs[k], zb = k === 0 && s.backFlags[j] ? H.rail : zs[k];
        const quad = [[a, za, ca[k]], [b, zb, cb[k]], [b, zs[k + 1], cb[k + 1]], [a, za, ca[k]], [b, zs[k + 1], cb[k + 1]], [a, zs[k + 1], ca[k + 1]]];
        for (const [q, z, c] of quad) { pos.push(q.x, q.y, z); col.push(...c); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    const bottom = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(v2(pts))), new THREE.MeshBasicMaterial({ color: '#020202' }));
    bottom.position.z = -H.pit; sc.add(bottom);
  }
  if (withLamp) addLamp(sc);
  return sc;
}
return { shapes, T1, S1: S1_ALL, H, BALL, EDGE_DARK, CORNER_ROUND, CW, buildNew, addLamp, noiseTexture, vignette, v2 };
}
