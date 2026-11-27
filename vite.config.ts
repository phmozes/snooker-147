// Vite settings. Additions to the defaults: developer-only endpoints (phone-cost below, task P.1) and an endpoint (dev server, never in a build) that
// receives "weird shot" marks from the phone and appends them to docs/WEIRD-SHOTS.md (owner, task 4.7).
// NOTE (2026-11-25): a dev server started before this file existed never loads it (Vite does not pick up a config
// file created later), so marks got 404. The game's developer panel now checks GET /__dev/weird/ping and says
// "PC link: not connected - restart the dev server" when the endpoint is missing.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { costLine } from './src/game/costLine';

const FILE = 'docs/WEIRD-SHOTS.md';
const HEADER = '# Weird shots (marked on the phone with the flag button)\n\n' +
  'Replay: `SHOTS="<round code>:<step>" npx vitest run bench/replay-shot.test.ts` (needs the same solver version).\n\n' +
  '| Time | Round code | Step | Ball | Outcome | Shot type | Length | Level | Solver |\n|---|---|---|---|---|---|---|---|---|\n';

/** Only short plain values get into the file (letters, digits, - . : and spaces). */
const clean = (v: unknown, max = 40) => String(v ?? '').replace(/[^\w.:\- ]/g, '').slice(0, max);

interface Mark { code: string; step: string; ball: string; outcome: string; type: string; length: string; solver: string }

const nowText = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
const cleanMark = (m: Record<string, unknown>): Mark => {
  const code = String(m.code);
  if (!/^reds\d+-(?:v[23]-)?\d+$/.test(code)) throw new Error('bad round code');
  return { code, step: clean(m.step, 4), ball: clean(m.ball), outcome: clean(m.outcome), type: clean(m.type),
    length: clean(m.length, 8), solver: clean(m.solver, 8) };
};
/** Same mark = same round, step, ball, outcome, shot type and solver (time and length are not compared). */
const keyOf = (m: Mark) => [m.code, m.step, m.ball, m.outcome, m.type, m.solver].join('|');
const existingKeys = (): Set<string> => {
  const keys = new Set<string>();
  if (!existsSync(FILE)) return keys;
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const c = line.split('|').map((s) => s.trim());
    // | time | code | step | ball | outcome | type | length | level | solver |
    if (c.length >= 10 && /^reds\d+-(?:v[23]-)?\d+$/.test(c[2]!)) keys.add([c[2], c[3], c[4], c[5], c[6], c[9]].join('|'));
  }
  return keys;
};
/** Appends the marks not in the file yet; returns how many were added. */
function addMarks(marks: Mark[], time: string): number {
  if (!existsSync(FILE)) writeFileSync(FILE, HEADER);
  const keys = existingKeys();
  let added = 0;
  for (const m of marks) {
    if (keys.has(keyOf(m))) continue;
    keys.add(keyOf(m));
    appendFileSync(FILE, `| ${clean(time)} | ${m.code} | ${m.step} | ${m.ball} | ${m.outcome} | ${m.type} | ${m.length} s | ` +
      `${m.code.split('-')[0]} | ${m.solver} |\n`);
    added++;
  }
  return added;
}
/** A line of the phone's list: "reds15-123 step 10 · blue success · long · 1.68 s · solver 4.9". */
export function parseListLine(line: string): Mark | null {
  const m = /^(reds\d+-(?:v[23]-)?\d+) step (\d+) · (\w+) (\w+) · (\w+) · ([\d.]+) s · solver (\S+)$/.exec(line.trim());
  if (!m) return null;
  return cleanMark({ code: m[1], step: m[2], ball: m[3], outcome: m[4], type: m[5], length: m[6], solver: m[7] });
}

function readBody(req: IncomingMessage, res: ServerResponse, max: number, then: (body: string) => void) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > max) req.destroy(); });
  req.on('end', () => {
    try { then(body); } catch { res.statusCode = 400; res.end('bad mark'); }
  });
}

function weirdShots(): Plugin {
  return {
    name: 'weird-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/weird', (req, res) => {
        const path = (req.url ?? '/').split('?')[0];
        if (req.method === 'GET' && path === '/ping') { res.end('ok'); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        if (path === '/list') { // "Send list to PC": every line stored on the phone, duplicates skipped
          readBody(req, res, 100_000, (body) => {
            const lines = (JSON.parse(body) as { lines: unknown }).lines;
            if (!Array.isArray(lines)) throw new Error('no lines');
            const marks = lines.map((l) => parseListLine(String(l))).filter((m): m is Mark => m !== null);
            const added = addMarks(marks, `sent ${nowText()}`);
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ added, known: marks.length - added, unreadable: lines.length - marks.length }));
          });
          return;
        }
        readBody(req, res, 2000, (body) => {
          addMarks([cleanMark(JSON.parse(body) as Record<string, unknown>)], nowText());
          res.end('ok');
        });
      });
    },
  };
}

// Task P.1: the game (dev build only) posts one line per shot with the solver cost and the THINKING wait; each line
// is rebuilt here from plain numbers and short texts and appended to bench/results/phone-cost.jsonl.
// PHONE_COST_FILE: tests write to a file of their own (tests/phoneCostPath.test.ts)
const costFile = () => process.env.PHONE_COST_FILE ?? 'bench/results/phone-cost.jsonl';
function phoneCost(): Plugin {
  return {
    name: 'phone-cost',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/cost', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        readBody(req, res, 4000, (body) => {
          appendFileSync(costFile(), costLine(JSON.parse(body) as Record<string, unknown>, String(req.headers['user-agent'] ?? ''), new Date().toISOString()) + '\n');
          res.end('ok');
        });
      });
    },
  };
}

// Fixed port (owner 2026-11-25): the phone keeps its weird-shot list per address, so the port must never change.
// strictPort: if 5181 is busy, the server stops with an error instead of moving to another port.
// cacheDir (2026-11-27): the dependency cache lives in this folder, not in node_modules/.vite. Helper copies of the
// project (git worktrees) link to the same node_modules; a dev server started there rewrote the shared cache and the
// phone page showed only BALANCE (504 Outdated Optimize Dep).
// Night 7: the real build drops the developer-only elements from index.html (the weird-shot flag, the dev tags, the
// developer panel and the mockup picture); the code that uses them is compiled out (import.meta.env.DEV).
const DEV_ONLY_HTML = [/<button id="flag"[\s\S]*?<\/button>/, /<div id="devTag"><\/div>/, /<div id="devVer"><\/div>/,
  /<div id="dev"><\/div>/, /<img id="mockup"[^>]*>/];
function stripDevHtml(): Plugin {
  return {
    name: 'strip-dev-html',
    apply: 'build',
    transformIndexHtml(html) {
      for (const re of DEV_ONLY_HTML) {
        if (!re.test(html)) throw new Error(`index.html: developer element not found (${re})`);
        html = html.replace(re, '');
      }
      return html;
    },
  };
}

// base (night 7): the build uses relative URLs ('./'), so dist/ can be hosted from any folder; the dev server keeps '/'.
// Only index.html is built (replay.html and debug.html are developer pages).
// 2026-11-27 test build (npm run build:test = scripts/build-test.mjs, mode 'devbuild'): the developer menu and dev
// tools stay in (NODE_ENV=development -> import.meta.env.DEV), so the developer HTML is kept; output dist-test/.
// `npm run build` (production) is unchanged.
export default defineConfig(({ command, mode }) => ({
  plugins: [weirdShots(), phoneCost(), ...(mode === 'devbuild' ? [] : [stripDevHtml()])], cacheDir: '.vite-cache',
  base: command === 'build' ? './' : '/', server: { host: true, port: 5181, strictPort: true },
  ...(mode === 'devbuild' ? { build: { outDir: 'dist-test', emptyOutDir: true } } : {}) }));
