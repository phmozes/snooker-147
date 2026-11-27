// Night 6: every place that checks the text of a round code accepts the new v3 marker (and still v1 / v2): the round
// code parser, the phone cost lines and the phone's weird-shot marks (vite.config.ts: cleanMark, existingKeys,
// parseListLine).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRoundCode } from '../src/core/roundCode';
import { costLine } from '../src/game/costLine';
import { parseListLine } from '../vite.config';

const CODES = ['reds6-123', 'reds10-v2-123', 'reds15-v3-123'];

describe('night 6: round code formats (v1, v2, v3)', () => {
  it('parseRoundCode reads all three versions', () => {
    expect(CODES.map((c) => parseRoundCode(c)!.rng)).toEqual([1, 2, 3]);
    expect(parseRoundCode('reds6-v4-123')).toBeNull();
  });
  it('a phone cost line accepts all three', () => {
    for (const code of CODES) expect(JSON.parse(costLine({ code, step: 2 }, '', 't')).code).toBe(code);
    expect(() => costLine({ code: 'reds6-v4-123' }, '', 't')).toThrow();
  });
  it("the weird-shot mark list reads a v3 line (parseListLine)", () => {
    for (const code of CODES) {
      const m = parseListLine(`${code} step 4 · red success · plain · 1.23 s · solver 4.11p`);
      expect(m?.code).toBe(code);
    }
  });
  it('vite.config.ts: every round-code check (cleanMark, existingKeys, parseListLine) allows the v3 marker', () => {
    const src = readFileSync('vite.config.ts', 'utf8');
    expect(src.match(/reds\\d\+-\(\?:v\[23\]-\)\?\\d\+/g)).toHaveLength(3);
    expect(src).not.toContain('(?:v2-)?');
  });
});
