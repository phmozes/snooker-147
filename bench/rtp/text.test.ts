import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CONFIG } from '../../src/config/game.config';
import { rtpText } from '../../src/core/ladder';
it('rtp text', () => { writeFileSync('bench/results/rtp-text.txt', CONFIG.levels.map((l) => `${l.id}: ${rtpText(l.id)}`).join('\n') + '\n'); });
