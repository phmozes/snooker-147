// Night 4: the visual switches (table look, cue, faster shot end) can never change a shot or an outcome. The outcome
// and the shot are made in src/core (round, rules, physics, solver); these switches live only in the view and the page.
// (bench/night4/fp.test.ts replays whole rounds frame by frame to show the shots themselves did not change.)
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const files = Object.keys(SOURCES);

describe('visual switches stay out of the outcome', () => {
  it('no file in src/core imports from src/view or src/game', () => {
    const core = files.filter((f) => f.includes('/src/core/'));
    expect(core.length).toBeGreaterThan(10);
    for (const f of core) expect(SOURCES[f]).not.toMatch(/from '\.\.\/(\.\.\/)?(view|game)\//);
  });
  it('the cue, the faster end and the table look are used only by the page and the 3D view', () => {
    for (const f of files) {
      const s = SOURCES[f]!;
      const where = f.replace(/^.*\/src\//, 'src/');
      if (/from '\.\.?\/(view\/)?cue'/.test(s)) expect(['src/game/gamePage.ts', 'src/view/table3d.ts']).toContain(where);
      if (/from '\.\.?\/(view\/)?fastEnd'/.test(s)) expect(['src/game/gamePage.ts']).toContain(where);
      if (/from '\.\.?\/(view\/)?tableLook'/.test(s)) expect(['src/view/table3d.ts']).toContain(where);
    }
  });
  it('Math.random is used nowhere in src (outcome = seed + step only)', () => {
    for (const f of files) expect(SOURCES[f]).not.toMatch(/Math\.random\s*\(/);
  });
});
