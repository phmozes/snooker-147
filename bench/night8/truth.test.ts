// Night 8 step 6 (report only): every number / text the player sees, compared with the config and the latest RTP
// results (docs/RTP-OPTION3.md option 3c, bench/results/rtp-rng-v2-200M.txt). Writes bench/results/night8/truth.txt.
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { ladderForLevel, rtpText } from '../../src/core/ladder';
import { formatMult } from '../../src/game/roundView';
import { stripHtml, stripSteps } from '../../src/game/ladderStrip';
import { CHANCE_NOTE, chanceRows, RERACK_SENTENCE, RULE_LINES, rulesHtml } from '../../src/game/rulesText';
import { newRound, outcomeDraw, setLevel } from '../../src/core/round';

it('truth check', () => {
  const out: string[] = [];
  const row = (what: string, where: string, shown: string, source: string, truth: string, ok: boolean) =>
    out.push(`${ok ? 'YES' : 'NO '} | ${what} | ${where} | shown: ${shown} | ${source}: ${truth}`);
  const opt = readFileSync('docs/RTP-OPTION3.md', 'utf8').split('\n');
  const i3c = opt.findIndex((l) => l.startsWith('The p table is in src/config'));
  const m200 = readFileSync('bench/results/rtp-rng-v2-200M.txt', 'utf8');
  const rules = readFileSync('docs/RULES.md', 'utf8');
  for (const l of CONFIG.levels) {
    const lad = ladderForLevel(l.id);
    const top = Math.max(...lad.map((x) => x.multiplier));
    const doc = opt.slice(i3c).find((x, k, a) => a[k - 1]?.startsWith(`**${l.id}**`))!;
    const docSteps = doc.trim().split(' | ').map((s) => { const m = /(\d+):x([\d.]+) ([\d.]+)/.exec(s)!; return { k: +m[1]!, mult: +m[2]!, p: +m[3]! }; });
    const multOk = docSteps.length === lad.length && docSteps.every((d, k) => Math.abs(d.mult - lad[k]!.multiplier) < 1e-9);
    const pOk = docSteps.every((d, k) => Math.abs(d.p - lad[k]!.p * 100) < 0.006);
    row(`${l.reds} reds ladder chips (${lad.length} multipliers)`, 'ladder strip', lad.map((x) => formatMult(x.multiplier)).join(' '), 'RTP-OPTION3 3c', docSteps.map((d) => `x${d.mult.toFixed(2)}`).join(' '), multOk);
    row(`${l.reds} reds p(step) behind the ladder (not shown)`, 'config levels[].p', `${lad.length} values`, 'RTP-OPTION3 3c (2 dp)', pOk ? 'all equal' : 'differ', pOk);
    row(`${l.reds} reds top multiplier`, 'Rules box "(up to ...)"', formatMult(top), 'RULES A.4 / config label', `x${{ 6: 25, 10: 50, 15: 100 }[l.reds]} / "${l.label}"`, top === { 6: 25, 10: 50, 15: 100 }[l.reds] && l.label.endsWith(`x${top}`));
    row(`${l.reds} reds number of steps`, 'ladder strip', String(lad.length), 'RULES A.2', String({ 6: 18, 10: 26, 15: 36 }[l.reds]), lad.length === { 6: 18, 10: 26, 15: 36 }[l.reds]);
    const t = rtpText(l.id);
    const docText = { reds6: 'RTP 97% at every cash-out step', reds10: 'between 96.94% and 97%', reds15: 'between 96.42% and 97%' }[l.id]!;
    row(`${l.reds} reds RTP text`, 'Rules box', t, 'RTP-OPTION3 player text + RULES A.6', docText, t.includes(docText) && rules.includes(t.replace(/^RTP 97% \(/, '').replace(/\)$/, '').split(',')[0]!));
    const sec = m200.split(`== ${l.id} `)[1]!.split(/\n== /)[0]!;
    const rows = sec.split('\n').filter((x) => /^\s*\d+ \|/.test(x)).map((x) => x.split('|')[1]!.trim().split(' / ').map(Number));
    const meas = rows.map((r) => r[0]!); const form = rows.map((r) => r[1]!); const z = rows.map((r) => Math.abs(Number(r[2])));
    const formOk = form.every((f, k) => Math.abs(f - 100 * lad[k]!.multiplier * lad.slice(0, k + 1).reduce((a, s) => a * s.p, 1)) < 0.00051);
    row(`${l.reds} reds cash-out RTP measured (200M rounds, v2)`, '(behind the RTP text)', `${Math.min(...meas).toFixed(4)}%-${Math.max(...meas).toFixed(4)}%, worst |z| ${Math.max(...z).toFixed(2)}`, 'pass rule |z|<4 and formula = config', formOk ? 'formula column = config' : 'formula column differs from config', rows.length === lad.length && formOk && Math.max(...z) < 4);
  }
  const M = CONFIG.money;
  row('bet limits', 'BET - / + (clamped in core setBet)', `${M.minBet}-${M.maxBet}, step ${M.betStep}`, 'RULES A.1', '1-100', M.minBet === 1 && M.maxBet === 100);
  row('quick bets', 'bet row', M.quickBets.join(' '), 'config money.quickBets', M.quickBets.join(' '), M.quickBets.every((q) => q >= M.minBet && q <= M.maxBet));
  row('default bet / START label', 'bet row, START · <bet>', String(M.defaultBet), 'config money.defaultBet', String(M.defaultBet), true);
  row('starting balance', 'top bar', String(M.startingBalance), 'config money.startingBalance', String(M.startingBalance), true);
  row('RE-RACK strip text', 'ladder strip', CONFIG.reRack.stripText, 'RULES D.4', 'RE-RACK · WON <amount> · x<multiplier>', CONFIG.reRack.stripText === 'RE-RACK · WON {amount} · x{multiplier}');
  // Rules box text (src/game/rulesText.ts, the same text openRules shows)
  const ruleE = /## E\. In-game rules text[^\n]*\n"([^"]+)"/.exec(rules)![1]!;
  row('Rules box line 1 (break-off, first shot)', 'Rules box', RULE_LINES[0]!, 'RULES B.2', 'step 1 is played by SHOOT', /SHOOT for your first shot/.test(RULE_LINES[0]!) && !/plays itself/.test(RULE_LINES[0]!));
  row('Rules box line 4 (re-rack)', 'Rules box', RULE_LINES[3]!, 'RULES E (exact sentence)', ruleE, RULE_LINES[3]!.includes(ruleE) && RERACK_SENTENCE === ruleE && !/re-racked/.test(RULE_LINES[3]!));
  row('Rules box line 3 (end of round)', 'Rules box', RULE_LINES[2]!, 'RULES C.5', 'miss / foul / in-off end the round', /miss, a foul or an in-off ends the round/.test(RULE_LINES[2]!));
  row('Rules box chance note', 'Rules box', CHANCE_NOTE, 'RULES A.6 (p depends on the step only)', 'step only', /only on the step/.test(CHANCE_NOTE));
  // chance table: every row, every level, against config p AND against the p the game draws with (outcomeDraw)
  for (const l of CONFIG.levels) {
    const lad = ladderForLevel(l.id); const html = rulesHtml(l.id); const r = setLevel(newRound(1), l.id as Parameters<typeof setLevel>[1]);
    for (const c of chanceRows(l.id)) {
      const cfgP = l.p![c.step - 1]!; const gameP = outcomeDraw(r, c.step).p;
      const want = `${(cfgP * 100).toFixed(1)}%`;
      const ok = c.chance === want && gameP === cfgP && c.mult === formatMult(lad[c.step - 1]!.multiplier) && html.includes(`<tr><td>${c.step}</td><td>${c.mult}</td><td>${c.chance}</td></tr>`);
      row(`${l.reds} reds chance table step ${c.step}`, 'Rules box table', `${c.mult} ${c.chance}`, 'config levels[].p / game outcomeDraw p', `${formatMult(lad[c.step - 1]!.multiplier)} ${want} (p ${cfgP.toFixed(6)}, game ${gameP.toFixed(6)})`, ok);
    }
  }
  // ladder chips (owner 2026-11-28, option C): the whole % under every chip, in every strip the game can show (every step
  // 0..n, in a round and between rounds), against round-half-up of the config p and of the p the game draws with, and
  // against the Rules table's one-decimal value
  for (const l of CONFIG.levels) {
    const lad = ladderForLevel(l.id); const r = setLevel(newRound(1), l.id as Parameters<typeof setLevel>[1]);
    const seen = new Map<number, Set<string>>();
    for (let step = 0; step <= lad.length; step++) for (const between of [false, true]) {
      const chips = [...stripHtml(lad, step, between).matchAll(/<span>(x[\d.]+)<\/span><small class="pc">(\d+%)<\/small>/g)];
      stripSteps(lad.length, step).forEach((k, i) => { const c = chips[i]!; (seen.get(k) ?? seen.set(k, new Set()).get(k)!).add(`${c[1]} ${c[2]}`); });
    }
    const table = chanceRows(l.id);
    for (let k = 1; k <= lad.length; k++) {
      const shown = [...(seen.get(k) ?? [])];
      const cfgP = l.p![k - 1]!; const gameP = outcomeDraw(r, k).p;
      const half = (x: number) => Math.floor(x * 100 + 0.5 + 1e-9);
      const want = `${formatMult(lad[k - 1]!.multiplier)} ${half(cfgP)}%`;
      const tableWhole = Math.floor(parseFloat(table[k - 1]!.chance) + 0.5);
      const ok = shown.length === 1 && shown[0] === want && half(gameP) === half(cfgP) && tableWhole === half(cfgP);
      row(`${l.reds} reds chip % step ${k}`, 'ladder strip chip', shown.join(' / ') || '(never shown)', 'round half up of config p / game outcomeDraw p / Rules table', `${want} (p ${cfgP.toFixed(6)}, game ${gameP.toFixed(6)}, table ${table[k - 1]!.chance})`, ok);
    }
  }
  writeFileSync('bench/results/night8/truth.txt', out.join('\n') + '\n');
});
