// Vite settings. Only one addition to the defaults: a developer-only endpoint (dev server, never in a build) that
// receives "weird shot" marks from the phone and appends them to docs/WEIRD-SHOTS.md (owner, task 4.7).
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const FILE = 'docs/WEIRD-SHOTS.md';
const HEADER = '# Weird shots (marked on the phone with the flag button)\n\n' +
  'Replay: `SHOTS="<round code>:<step>" npx vitest run bench/replay-shot.test.ts` (needs the same solver version).\n\n' +
  '| Time | Round code | Step | Ball | Outcome | Shot type | Length | Level | Solver |\n|---|---|---|---|---|---|---|---|---|\n';

/** Only short plain values get into the file (letters, digits, - . : and spaces). */
const clean = (v: unknown, max = 40) => String(v ?? '').replace(/[^\w.:\- ]/g, '').slice(0, max);

function weirdShots(): Plugin {
  return {
    name: 'weird-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/weird', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 2000) req.destroy(); });
        req.on('end', () => {
          try {
            const m = JSON.parse(body) as Record<string, unknown>;
            if (!/^reds\d+-\d+$/.test(String(m.code))) throw new Error('bad round code');
            if (!existsSync(FILE)) writeFileSync(FILE, HEADER);
            const d = new Date();
            const z = (n: number) => String(n).padStart(2, '0');
            const time = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
            appendFileSync(FILE, `| ${clean(time)} | ${clean(m.code)} | ${clean(m.step, 4)} | ${clean(m.ball)} | ${clean(m.outcome)} | ` +
              `${clean(m.type)} | ${clean(m.length, 8)} s | ${clean(m.level)} | ${clean(m.solver, 8)} |\n`);
            res.end('ok');
          } catch {
            res.statusCode = 400;
            res.end('bad mark');
          }
        });
      });
    },
  };
}

export default defineConfig({ plugins: [weirdShots()] });
