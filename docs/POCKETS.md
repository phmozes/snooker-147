# Pockets: where the numbers come from (task 1.3, 2026-11-24)

WPBSA templates are proprietary; nothing official is published. Owner's research:
- Mouth (template width at the fall): corner 3.5 in = 89 mm, middle 4 in = 102 mm (86 mm is a wrong conversion).
- Jaw = rounded part (arc tangent to the cushion) + straight part; the two straight parts are parallel.
- Fall (fitter): slate cut ~3.5 in (89 mm) radius, cushion overhangs the slate by ~2 in (51 mm).
  Corners (approved): front edge of the slate cut 51 mm into the throat.
  Middles (owner, revision 2): the overhang is sideways; the cut starts close to the cushion line.
- Undercut rubber: real gap at ball-centre height is a little wider; unknown. Config `table.mouthExtra` (0 now).

## Jaw radius measured from the template photos (neck width = ruler)
Method: template edge found by colour (Chrome canvas), camera squash undone with a 2D (affine) model, circle fit
(least squares) and arc length / turn angle on the curved part only.
- Corner, reference/pocket4: squash 0.75 from the template's own edges (sides really 90 degrees apart). The curve turns
  45 degrees and ends parallel to the diagonal, with a short straight bit before the neck (matches the owner's shape).
  Estimates 87-118 mm at squash 0.75; 73-137 mm for squash 0.65-0.85. **Config: 110 mm, range 85-135.**
- Middle, reference/pocket3: only the far jaw's curve is clear and only part of it; the block gives no squash.
  Fits 95-127 mm for squash 0.5-0.9. reference/pocket2 (from above): narrowest point ~145 px = 70-93 mm behind the
  cushion line, which fits a 90-degree arc of ~70-95 mm. **Config: 80 mm (owner's choice, low end).**

## Middle-pocket drop edge (revision 2)
- reference/pocket2, centre column: cushion line (bright rim on the cushion tops) ~row 105, cloth falls away over
  the slate lip at rows 124-144 (edge taken at 128). Ruler: narrowest gap between the noses ~210 px = 102 mm.
  -> **~12 mm behind the cushion line, range 5-25 mm** (camera straight down vs tilted, edge choice +-8 px).
- reference/pocket3: the template covers the slate edge, so it cannot show this. Its cut-out apex lies ~13 mm in
  front of the far jaw's narrowest point, i.e. it seems to mark the neck, not the fall. No contradiction, no measurement.
- Side finding: the visible hole in pocket2 fits a circle of ~51-53 mm radius, not 89. Changing it barely changes
  the pot map (tested), so the config keeps the fitter's 89 mm.

## Pot map before / after (one red, 0.2 m from the mouth, angles -60..60, offsets -60..60 mm)
| | clean | rattle in | rattle out | missed | straight-in pot window |
|---|---|---|---|---|---|
| corner before (86 mm, R 150, old hole) | 14% | 51% | 35% | 0% | 85 mm |
| corner after (89 mm, R 110, throat + fall) | 11% | 48% | 41% | 0% | 81 mm |
| middle before (105 mm, R 55) | 25% | 24% | 36% | 16% | 89 mm |
| middle revision 1 (102 mm, R 100, fall 51 mm into the throat) | 13% | 41% | 43% | 2% | 95 mm |
| middle revision 2 (R 80, fall 12 mm behind the cushion line) | 56% | 13% | 21% | 10% | 119 mm |
(at 2 m/s; 1 and 3 m/s show the same pattern. Corner unchanged in revision 2.)
Why so generous now: a ball that clips the big rounded jaw just past the cushion line is turned sideways straight
into the hole, which now starts right there. Same layout with jaw radius 55 mm: clean 42%, potted 57%, window 97 mm;
40 mm: clean 35%, potted 49%, window 85 mm. Slate cut radius 51 or 60 instead of 89: no real change.
