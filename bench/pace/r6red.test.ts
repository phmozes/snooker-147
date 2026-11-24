import { it } from 'vitest';
import { run } from './lib';
it('pace 6 red', () => { run(6, 'red', 50, process.env.TEMP + '/pace_6_red.json'); }, 1_200_000);
