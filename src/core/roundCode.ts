// Task 5.4: the round code. It reproduces a whole round: `<level>-<seed>[-<colour letters>][-C<step>]`, for example
// `reds6-48213-BKPK-C7`. The seed fixes the break and every outcome (RULES A.5); the letters are the colours played on
// the colour steps while reds remain (in order, one per red potted and followed by a colour shot); `-C7` means the
// player cashed out after step 7. Without `-C` the round ran to its own end (failure, clearance or RE-RACK).
// Old codes without letters (`reds6-48213`) still parse: then every colour is the automatic pick (RULES B.3).
// Generator version (night 4, docs/FAIRNESS.md): a code of a v2 round (HMAC-SHA256, every new round) carries the marker
// `v2` before the seed: `reds6-v2-48213-BKPK-C7` (or `v2-48213` without the level). A code without the marker is a v1
// round (the old light hash) and replays with the old generator exactly as before. Night 6: new rounds carry `v3`
// (`reds6-v3-48213`): the same v2 generator with the new break-off library (cue ball on the baulk line, RULES B.1);
// v1 and v2 codes keep the old library. Night 8: new 6-red rounds carry `v4` (v3 + the v4 6-red break library).
// Pure: no rendering, no Math.random.

import { baseCode, cashOut, newRound, setLevel, shoot, start, type LevelId, type Round, type RngVersion, type ShotProvider } from './round';
import type { TableGeometry } from './table/geometry';
import type { Colour } from './types';
import { CONFIG } from '../config/game.config';

export const COLOUR_LETTER: Record<Colour, string> = { yellow: 'Y', green: 'G', brown: 'N', blue: 'B', pink: 'P', black: 'K' };
const LETTER_COLOUR = Object.fromEntries(Object.entries(COLOUR_LETTER).map(([c, l]) => [l, c])) as Record<string, Colour>;

export interface RoundCode { levelId: LevelId | null; seed: number; rng: RngVersion; colours: Colour[] | null; cashOutAfter: number | null }

/** The colours of the colour steps (a shot right after a potted red), in order. */
export function colourSteps(r: Round): Colour[] {
  const out: Colour[] = [];
  for (let i = 1; i < r.history.length; i++) if (r.history[i - 1]!.target === 'red') out.push(r.history[i]!.target as Colour);
  return out;
}

/** The full code of a round (while it runs: what has been played so far). */
export function roundCodeOf(r: Round): string {
  const letters = colourSteps(r).map((c) => COLOUR_LETTER[c]).join('');
  return `${baseCode(r.levelId, r.seed, r.rng)}${letters ? `-${letters}` : ''}${r.end?.type === 'cashOut' ? `-C${r.step}` : ''}`;
}

/** "reds6-12345", "12345" (the level stays as it is), "reds6-12345-BKP-C7". null if it is not a round code. */
export function parseRoundCode(text: string): RoundCode | null {
  const m = /^\s*(?:(reds\d+)\s*-\s*)?(?:v([234])\s*-\s*)?(\d{1,10})(?:\s*-\s*([YGNBPK]+))?(?:\s*-\s*C(\d{1,3}))?\s*$/i.exec(text);
  if (!m) return null;
  const seed = Number(m[3]);
  const rng: RngVersion = m[2] ? (Number(m[2]) as RngVersion) : 1;
  if (seed > 0xffffffff) return null;
  const levelId = m[1] ? (CONFIG.levels.find((l) => l.id === m[1]!.toLowerCase())?.id ?? null) : null;
  if (m[1] && !levelId) return null;
  const colours = m[4] ? [...m[4].toUpperCase()].map((l) => LETTER_COLOUR[l]!) : null;
  const cashOutAfter = m[5] ? Number(m[5]) : null;
  if (cashOutAfter !== null && cashOutAfter < 1) return null;
  return { levelId, seed, rng, colours, cashOutAfter };
}

/** The colour the code asks for on the colour step with this index, or undefined (then the automatic pick). */
export function codeColour(code: RoundCode, colourIndex: number): Colour | undefined {
  return code.colours?.[colourIndex];
}

/**
 * Play the round of a code headless: the same break, shots, outcomes and end as the round it came from. On a colour
 * step the automatic pick is used when it is the colour in the code (exactly what the game did), else that colour.
 */
export function replayRound(code: RoundCode, provider: ShotProvider, table: TableGeometry, levelId?: LevelId): Round {
  const level = code.levelId ?? levelId ?? (CONFIG.defaultLevel as LevelId);
  let r: Round = start(setLevel(newRound(code.seed, undefined, code.rng), level), provider, table);
  let colourIndex = 0;
  while (r.phase === 'decide') {
    if (code.cashOutAfter !== null && r.step >= code.cashOutAfter) return cashOut(r);
    if (r.frame!.phase === 'colour') {
      const want = codeColour(code, colourIndex++);
      const auto = provider.autoColour?.(r.frame!, { roundCode: r.roundCode, step: r.step + 1 });
      r = want && want !== auto ? shoot(r, provider, table, want) : shoot(r, provider, table);
    } else r = shoot(r, provider, table);
  }
  return r;
}
