// Bug 2026-11-27 (owner's phone): the pocket-drop sound came just BEFORE the ball was seen dropping (about 0.1 s of
// shot time, about 0.3 s on screen in the pocket-camera slow motion). The sound (and the milestone applause) now come
// when the drawn ball's centre reaches the cloth. Live check on the dev server: scripts/drop-sound-check.mjs.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/game.config';
import { createSim, recordShot, strike } from '../src/core/physics/sim';
import { pocketRollStart } from '../src/core/physics/testShots';
import { buildTable, type PocketId } from '../src/core/table/geometry';
import { lastSoundAt, potHeardAt } from '../src/game/tableSounds';
import { DROP_GRAVITY, dropSeenAt, positionsAt } from '../src/view/playback';

const table = buildTable(CONFIG.table);
const rs = CONFIG.table.ballRadius * CONFIG.view3d.ballScale;

function pot(pocket: PocketId) {
  const st = pocketRollStart(table, { pocket, angleDeg: 0, offset: 0, speed: 1.6, distance: 1.0 })!;
  const sim = createSim([{ id: 'red1', kind: 'red', pos: st.pos }], table);
  strike(sim, 'red1', st.dir, 1.6, 0);
  const rec = recordShot(sim);
  const e = rec.events.find((x) => x.type === 'pot')!;
  return { rec, e };
}

describe('the drop sound comes when the ball is seen dropping', () => {
  it('heard = first frame without the ball + the drawn fall to the cloth, the same for every pocket', () => {
    for (const id of ['topLeft', 'middleRight', 'bottomLeft'] as PocketId[]) {
      const { rec, e } = pot(id);
      expect(e).toBeTruthy();
      const heard = potHeardAt(rec, e.t, 'red1', rs);
      const fall = Math.sqrt((2 * rs) / DROP_GRAVITY); // ~0.087 s with ballScale 1.4
      // the playback shows the ball until heard - fall, then it is gone (the view starts its fall there)
      expect(positionsAt(rec, heard - fall - 1e-6)[0]).not.toBeNull();
      expect(positionsAt(rec, heard - fall + 1e-6)[0]).toBeNull();
      // after the physics pot moment by the fall plus at most one recorded frame
      expect(heard - e.t).toBeGreaterThanOrEqual(fall - 1e-9);
      expect(heard - e.t).toBeLessThanOrEqual(fall + rec.frameDt + 1e-9);
    }
  });
  it('never later than the drawn fall lasts; no pot = null; the playback runs until the last pot is heard', () => {
    const { rec } = pot('topRight');
    expect(dropSeenAt(rec, 'red1', rs, 0.01)! - dropSeenAt(rec, 'red1', rs, 0)!).toBeCloseTo(0.01);
    expect(dropSeenAt(rec, 'nobody', rs, 0.2)).toBeNull();
    expect(lastSoundAt(rec, rs)).toBeGreaterThanOrEqual(potHeardAt(rec, 0, 'red1', rs));
    expect(lastSoundAt(rec, rs)).toBeGreaterThanOrEqual(rec.duration);
  });
  it('the game page uses the same moment for the drop sound and the milestone applause', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/game/gamePage.ts', 'utf8');
    expect(src).toMatch(/applauseAt = applause \? \(potEv \? potHeardAt\(rec, potEv\.t, potEv\.a, rs\)/);
    expect(src).toMatch(/playEventsBetween\(rec, tPrev, t, rs, breakAt\)/);
    expect(src).toMatch(/playEventsBetween\(lp\.rec, [^;]*table\.ballRadius \* ballScale\)/);
  });
});
