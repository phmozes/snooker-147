import { it } from 'vitest';
import { run } from './lib';
it('pace 15 red', () => { run(15, 'red', 50, process.env.TEMP + '/pace_15_red.json'); }, 1_200_000);
