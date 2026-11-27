// PLAN 9.1: the table sounds. Volume follows impact speed; sound code only reads recordings and never reaches the core.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { impactVolume } from '../src/game/tableSounds';

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
  it('the 5 sound files are in public/sounds/', async () => {
    const { existsSync } = await import('node:fs');
    for (const n of ['cue', 'ball-soft', 'ball-hard', 'cushion', 'pocket']) expect(existsSync(`public/sounds/${n}.mp3`)).toBe(true);
  });
});
