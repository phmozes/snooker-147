import { defineConfig } from 'vitest/config';

// The solver tests are heavy and run at the same time as the others, so a single test can take longer than the
// default 5 s on a busy machine. 30 s per test is a safety limit, not a target.
export default defineConfig({ test: { testTimeout: 30_000 } });
