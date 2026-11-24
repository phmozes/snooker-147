import { it } from 'vitest';
import { run } from './lib';
it('pace 15 colour', () => { run(15, 'colour', 50, process.env.TEMP + '/pace_15_colour.json'); }, 1_200_000);
