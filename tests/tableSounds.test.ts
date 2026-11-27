// PLAN 9.1 / 9.2: the table sounds, break-off, win and tap. Volume follows impact speed; sound code only reads recordings and never reaches the core.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { breakOffMoment, impactVolume } from '../src/game/tableSounds';
import { buildTable } from '../src/core/table/geometry';
import { newFrame } from '../src/core/rules';
import { createSim, recordShot, strike } from '../src/core/physics/sim';

const S = CONFIG.sound.tableHits;
const SOURCES = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('table sounds', () => {
  it('very soft touches are silent, harder hits louder, never above 1', () => {
    expect(impactVolume(0.01, S.ball)).toBe(0);
    expect(impactVolume(S.ball.min - 1e-6, S.ball)).toBe(0);
    expect(impactVolume(S.ball.min, S.ball)).toBeCloseTo(S.ball.floor);
    expect(impactVolume(1, S.ball)).toBeGreaterThan(impactVolume(0.3, S.ball));
    expect(impactVolume(S.ball.max, S.ball)).toBe(1);
    expect(impactVolume(50, S.cushion)).toBe(1);
    expect(impactVolume(Number.NaN, S.cushion)).toBe(0);
    expect(impactVolume(0, S.pocket)).toBeCloseTo(S.pocket.floor); // a pot is always heard
  });
  it('only the game page uses the sounds, and the sound code imports nothing from the core but types', () => {
    for (const [f, s] of Object.entries(SOURCES)) {
      if (/from '\.\.?\/(game\/)?tableSounds'/.test(s)) expect(f).toMatch(/src\/game\/gamePage\.ts$/);
    }
    const src = Object.entries(SOURCES).find(([f]) => f.endsWith('/game/tableSounds.ts'))![1];
    for (const line of src.split('\n').filter((l) => l.includes("from '../core/"))) expect(line).toMatch(/^import type /);
  });
  it('the break-off sound moment is the cue ball first touching another ball', () => {
    const table = buildTable();
    const balls = newFrame(15, table).balls;
    const cue = balls.find((x) => x.kind === 'cue')!.pos;
    const red = balls.filter((x) => x.kind === 'red').sort((p, q) => Math.hypot(p.pos.x - cue.x, p.pos.y - cue.y) - Math.hypot(q.pos.x - cue.x, q.pos.y - cue.y))[0]!.pos;
    const sim = createSim(balls, table);
    strike(sim, 'cue', { x: red.x - cue.x, y: red.y - cue.y }, 5, 0); // straight at the nearest red of the pack
    const rec = recordShot(sim);
    const t = breakOffMoment(rec);
    expect(t).not.toBeNull();
    const before = rec.events.filter((e) => e.type === 'ball' && e.t < t!);
    expect(before.every((e) => e.type === 'ball' && e.a !== 'cue' && e.b !== 'cue')).toBe(true);
  });
  it('the 8 sound files are in public/sounds/', async () => {
    const { existsSync } = await import('node:fs');
    for (const n of ['cue', 'ball-soft', 'ball-hard', 'cushion', 'pocket', 'break', 'win', 'tap']) expect(existsSync(`public/sounds/${n}.mp3`)).toBe(true);
  });
});
