// Gray-box 2D top view of a recorded shot (same drawing rules as the debug page, much simpler). Plain canvas.

import { CONFIG } from '../config/game.config';
import { arcPoints, type TableGeometry } from '../core/table/geometry';
import type { BallKind, Vec2 } from '../core/types';
import { BALL_COLOURS } from './playback';

export function createTable2d(canvas: HTMLCanvasElement, table: TableGeometry) {
  const ctx = canvas.getContext('2d')!;
  const rim = CONFIG.view3d.rim;
  const hw = table.halfWidth;
  const hl = table.halfLength;
  let scale = 1;
  const sx = (p: Vec2) => canvas.width / 2 + p.x * scale;
  const sy = (p: Vec2) => canvas.height / 2 - p.y * scale; // +y (top cushion) is up on screen
  const path = (pts: Vec2[]) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(sx(q), sy(q)) : ctx.moveTo(sx(q), sy(q)))); };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    scale = Math.min(canvas.width / (2 * (hw + rim)), canvas.height / (2 * (hl + rim)));
  }

  function draw(kinds: BallKind[], positions: (Vec2 | null)[]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5b3a22';
    path([{ x: -hw - rim, y: -hl - rim }, { x: hw + rim, y: -hl - rim }, { x: hw + rim, y: hl + rim }, { x: -hw - rim, y: hl + rim }]);
    ctx.fill();
    ctx.fillStyle = '#1f7a4d';
    path([{ x: -hw, y: -hl }, { x: hw, y: -hl }, { x: hw, y: hl }, { x: -hw, y: hl }]);
    ctx.fill();
    // holes (slate cut), cushions and jaws as lines
    ctx.fillStyle = '#060808';
    for (const p of table.pockets) {
      ctx.beginPath();
      ctx.arc(sx(p.captureCentre), sy(p.captureCentre), p.captureRadius * scale, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = '#e8d9a8';
    ctx.lineWidth = Math.max(1, scale * 0.006);
    for (const s of [...table.cushions, ...table.throatWalls]) { path([s.a, s.b]); ctx.stroke(); }
    for (const j of table.jaws) { path(arcPoints(j, j.start, j.start + j.sweep)); ctx.stroke(); }
    // baulk line and D
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    path([{ x: -hw, y: table.baulkY }, { x: hw, y: table.baulkY }]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx(table.dCentre), sy(table.dCentre), table.dRadius * scale, 0, Math.PI);
    ctx.stroke();
    // balls
    positions.forEach((q, i) => {
      if (!q) return;
      ctx.beginPath();
      ctx.arc(sx(q), sy(q), table.ballRadius * scale, 0, 2 * Math.PI);
      ctx.fillStyle = BALL_COLOURS[kinds[i]!];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
    });
  }
  return { resize, draw };
}
