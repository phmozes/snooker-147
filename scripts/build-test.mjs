// npm run build:test (owner 2026-11-27): a build WITH the developer menu and dev tools, into dist-test/.
// NODE_ENV=development keeps import.meta.env.DEV true in the build; VITE_TEST_BUILD=1 switches off every posting to the
// PC (phone-cost lines, weird-shot marks): there is no dev server behind a test build. vite.config.ts: mode 'devbuild'
// keeps the developer HTML and writes to dist-test/. `npm run build` (production) is unchanged.
import { build } from 'vite';

process.env.NODE_ENV = 'development';
process.env.VITE_TEST_BUILD = '1';
await build({ mode: 'devbuild' });
