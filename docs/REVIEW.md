# Review list (autonomous session 2026-11-24, 16:23-18:23)

One section per task: what was built, how to check it, numbers, decisions for the owner to confirm, what is unfinished.

## 0. Phone fixes on the game page
**Built:** the game now sizes itself to the area you can really see (visual viewport minus the notch/bar insets) and
re-fits when the browser bars show or hide. The page is locked: no scroll, no pinch or double-tap zoom, no sideways
drag, no browser text zoom, no text selection, no long-press menu, no tap highlight. Balls are drawn at 1.4x (new
default), with 1.4x added to the menu.
**Check:** on the phone open http://192.168.1.111:5180/ . Screen D: "BALANCE" fully visible, START fully on screen
with a small gap below. Screen C (≡ menu): colour buttons not touching the bottom. Long-press "x1.14": nothing happens.
Pinch, double-tap, drag sideways: nothing moves.
**Likely cause of the old problem:** the in-app browser's text zoom made everything larger, and the old code used the
window height including the area under the browser bars. Both are fixed; I could not test on Android myself.
**Decisions to confirm:** none (1.4x is your choice, marked provisional).
**Not finished:** nothing.
