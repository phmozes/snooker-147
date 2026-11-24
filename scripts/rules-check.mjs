// Builds the results table in docs/RULES-CHECK.md from tests/rules.test.ts and tests/score.test.ts. Run: npm run rules-check
// Only the part between the RESULTS markers is rewritten; the notes around it are kept.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'rules-')), 'r.json');
try { execSync(`npx vitest run tests/rules.test.ts tests/score.test.ts --reporter=json --outputFile="${out}"`, { stdio: 'ignore' }); } catch { /* failures are reported below */ }
const json = JSON.parse(readFileSync(out, 'utf8'));
const cases = json.testResults.flatMap((f) => f.assertionResults);
const groups = new Map();
for (const c of cases) {
  const group = c.ancestorTitles[0];
  const m = /^\[([A-Z]\.\d+)\]\s*(.*)$/.exec(c.title);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ ref: m ? m[1] : '-', text: m ? m[2] : c.title, ok: c.status === 'passed' });
}
const passed = cases.filter((c) => c.status === 'passed').length;
const lines = [`Result: **${passed} of ${cases.length} passed** (${new Date().toISOString().slice(0, 10)}).`, ''];
for (const [group, rows] of groups) {
  lines.push(`### ${group}`, '', '| RULES.md | Case | Result |', '|---|---|---|');
  for (const r of rows) lines.push(`| ${r.ref} | ${r.text} | ${r.ok ? 'pass' : '**FAIL**'} |`);
  lines.push('');
}
const file = 'docs/RULES-CHECK.md';
const doc = readFileSync(file, 'utf8');
const start = '<!-- RESULTS START -->';
const end = '<!-- RESULTS END -->';
const a = doc.indexOf(start);
const b = doc.indexOf(end);
if (a < 0 || b < a) throw new Error(`${file}: result markers not found`);
writeFileSync(file, `${doc.slice(0, a)}${start}\n${lines.join('\n')}\n${doc.slice(b)}`);
console.log(`docs/RULES-CHECK.md: ${passed} of ${cases.length} passed`);
if (passed !== cases.length) process.exit(1);
