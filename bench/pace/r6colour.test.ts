import { it } from 'vitest';
import { run } from './lib';
it('pace 6 colour', () => { run(6, 'colour', 50, process.env.TEMP + '/pace_6_colour.json'); }, 1_200_000);
