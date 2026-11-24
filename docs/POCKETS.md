# Pockets: where the numbers come from (task 1.3, 2026-11-24)

WPBSA templates are proprietary; nothing official is published. Owner's research:
- Mouth (template width at the fall): corner 3.5 in = 89 mm, middle 4 in = 102 mm (86 mm is a wrong conversion).
- Jaw = rounded part (arc tangent to the cushion) + straight part; the two straight parts are parallel.
- Fall (fitter): slate cut ~3.5 in (89 mm) radius, cushion overhangs the slate by ~2 in (51 mm).
  Our reading: the slate cut's front edge is 51 mm into the throat. At its widest the cut then runs
  44 mm (corner) / 38 mm (middle) under each jaw, so the sideways reading of "2 in" also roughly fits.
- Undercut rubber: real gap at ball-centre height is a little wider; unknown. Config `table.mouthExtra` (0 now).

## Jaw radius measured from the template photos (neck width = ruler)
Method: template edge found by colour (Chrome canvas), camera squash undone with a 2D (affine) model, circle fit
(least squares) and arc length / turn angle on the curved part only.
- Corner, reference/pocket4: squash 0.75 from the template's own edges (sides really 90 degrees apart). The curve turns
  45 degrees and ends parallel to the diagonal, with a short straight bit before the neck (matches the owner's shape).
  Estimates 87-118 mm at squash 0.75; 73-137 mm for squash 0.65-0.85. **Config: 110 mm, range 85-135.**
- Middle, reference/pocket3: only the far jaw's curve is clear and only part of it; the block gives no squash.
  Fits 95-127 mm for squash 0.5-0.9. **Config: 100 mm, range 80-130, less sure.**
  Doubt: with 100 mm and a 90-degree turn the throat starts 100 mm behind the cushion line and the fall ~150 mm.

## Pot map before / after (one red, 0.2 m from the mouth, angles -60..60, offsets -60..60 mm)
| | clean | rattle in | rattle out | missed | straight-in pot window |
|---|---|---|---|---|---|
| corner before (86 mm, R 150, old hole) | 14% | 51% | 35% | 0% | 85 mm |
| corner after (89 mm, R 110, throat + fall) | 11% | 48% | 41% | 0% | 81 mm |
| middle before (105 mm, R 55) | 25% | 24% | 36% | 16% | 89 mm |
| middle after (102 mm, R 100, throat + fall) | 13% | 41% | 43% | 2% | 95 mm |
(at 2 m/s; 1 and 3 m/s show the same pattern)
