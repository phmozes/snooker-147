// Night 4, Part 3c: the position-play experiment "solver 4.11p" can be switched on at run time (dev panel, soak), also
// inside the solver workers (the switch travels with each solve request). OFF = exactly solver 4.10.
import { CONFIG } from '../config/game.config';

let pos411p: boolean = CONFIG.solver.natural.pos411p.enabled;
export const pos411pOn = () => pos411p;
export function setPos411p(v: boolean) { pos411p = v; }
/** The solver version for the weird-shot list and the dev label. */
export const solverVersion = () => (pos411p ? '4.11p' : CONFIG.solver.version);
