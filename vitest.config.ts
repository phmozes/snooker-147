import { defineConfig } from 'vitest/config';

// The solver tests are heavy and run at the same time as the others, so a single test can take longer than the
// default 5 s on a busy machine. 30 s per test is a safety limit, not a target.
// tests/solver.test.ts times its own search (60 s limit per test) and timed out when every file ran at once
// (2026-11-26; it passes alone in about 36 s). It now runs in a second group that starts only after the first group
// (all other files) has finished, so it has the machine to itself. Same checks, same limits.
const SOLO = ['tests/solver.test.ts'];
export default defineConfig({
  test: {
    testTimeout: 30_000,
    projects: [
      { extends: true, test: { name: 'main', exclude: ['**/node_modules/**', '**/.claude/**', ...SOLO], sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: 'solver', include: SOLO, exclude: ['**/.claude/**'], sequence: { groupOrder: 1 } } },
    ],
  },
});
