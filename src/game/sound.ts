// Night 4 (Part 5): game sound on / off. The mute button in the top bar switches it; the choice is kept on this device
// (config ui.rememberMute). Every game sound must ask isMuted() before it plays. (There are no sound files yet: the
// announcer voice and the ball sounds come in stages 9-10; this is the one switch they will all use.)
import { CONFIG } from '../config/game.config';

const KEY = 'snooker147.mute';
let muted = (() => { try { return CONFIG.ui.rememberMute && localStorage.getItem(KEY) === '1'; } catch { return false; } })();
const listeners: ((m: boolean) => void)[] = [];

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  if (CONFIG.ui.rememberMute) try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* private window: until reload */ }
  for (const f of listeners) f(m);
}
/** Called when the switch changes (e.g. to pause a playing sound). */
export const onMuteChange = (f: (m: boolean) => void) => { listeners.push(f); };

/** The speaker icon for the button (drawn in code). */
export const muteIcon = (m: boolean) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>` +
  (m ? '<path d="M16 9l6 6M22 9l-6 6"/>' : '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>') + '</svg>';
