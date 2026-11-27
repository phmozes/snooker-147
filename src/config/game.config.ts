// The single config file. Every tunable number of the game lives here. Game code only reads it.
// Sections not used yet are still drafts; they get checked when their task is built.
// Units: metres, seconds, radians. Origin = table centre, +y toward the black end, +x to the right
// (portrait view, baulk at the bottom, as in the mockups).

export const CONFIG = {
  // ---------------- MONEY (owner decides) ----------------
  money: {
    startingBalance: 1000,
    minBet: 1,
    maxBet: 100,
    betStep: 1,               // the - / + buttons
    quickBets: [1, 5, 10, 50],
    defaultBet: 10,
    currencyDecimals: 2,
    demoCredits: true,
  },

  // ---------------- LEVELS AND LADDERS (owner decides) ----------------
  // Multipliers: p(1) = targetRtp / firstMultiplier, then linear down to pLast (the linear chance);
  // multiplier(k) = floor(targetRtp / (p1*...*pk) * 100) / 100, last step fixed to topMultiplier.
  // Chances: each level's p table (RTP option 3c, docs/RTP-OPTION3.md). Cash-out RTP 97.00% or a little below, never above.
  // Expected ladders are test fixtures in tests/ladder.test.ts (checked: they match these numbers exactly).
  ladder: {
    targetRtp: 0.97,
    firstMultiplier: 1.05,
    rtpTestMin: 0.961,
    rtpTestMax: 0.970,
  },
  levels: [
    { id: 'reds6',  reds: 6,  steps: 18, pLast: 0.7492656301419769, topMultiplier: 25,  maximumBreak: 75,
      label: '6 reds · up to x25',
      // RTP option 3c (owner 2026-11-25): chance per step, from bench/rtp/option3c.test.ts
      p: [0.9238095238095237, 0.9210526315789476, 0.8976377952755904, 0.8943661971830986, 0.8819875776397514, 0.8702702702702704, 0.8644859813084111, 0.8525896414342632, 0.8394648829431436, 0.8328690807799445, 0.8196347031963469, 0.8111111111111111, 0.8, 0.7903981264637003, 0.7799086757990868, 0.7700421940928269, 0.7592098238120663, 0.7492000000000001] },
    { id: 'reds10', reds: 10, steps: 26, pLast: 0.7964942341213621, topMultiplier: 50,  maximumBreak: 107,
      label: '10 reds · up to x50',
      // RTP option 3c (owner 2026-11-25): chance per step, from bench/rtp/option3c.test.ts
      p: [0.9238095238095237, 0.9210526315789476, 0.9119999999999999, 0.9118999999999999, 0.9018186435493272, 0.8994082840236688, 0.8941798941798942, 0.8873239436619719, 0.8801652892561983, 0.88, 0.873015873015873, 0.8653846153846153, 0.8625592417061612, 0.8577235772357723, 0.8526863084922011, 0.8472834067547724, 0.8428217821782178, 0.8373056994818652, 0.831896551724138, 0.82679971489665, 0.8219097832454598, 0.8167464114832537, 0.8116504854368931, 0.806704260651629, 0.801607232546459, 0.7964000000000001] },
    { id: 'reds15', reds: 15, steps: 36, pLast: 0.8353317234189956, topMultiplier: 100, maximumBreak: 147,
      label: '15 reds · up to x100',
      // RTP option 3c (owner 2026-11-25): chance per step, from bench/rtp/option3c.test.ts
      p: [0.9238095238095237, 0.9237095238095238, 0.9167104719849123, 0.9166104719849123, 0.9140609489476015, 0.9135802469135803, 0.9101123595505618, 0.9035532994923857, 0.9034532994923857, 0.9010422422877215, 0.8996282527881041, 0.893687707641196, 0.8931750741839762, 0.8915343915343916, 0.8873239436619719, 0.8872239436619719, 0.8826274819206981, 0.8802588996763755, 0.8790896159317212, 0.8754669987546702, 0.8728260869565216, 0.8712121212121211, 0.8677074774034512, 0.8655761024182076, 0.8631062001227747, 0.8605388272583201, 0.858114233907525, 0.8557020946470132, 0.8530774321641298, 0.8503095104108047, 0.8480076354092103, 0.8454710510389348, 0.8428838632885564, 0.8403829665618748, 0.837782832515264, 0.8353] },
  ],
  defaultLevel: 'reds6',

  // ---------------- RNG ----------------
  rng: {
    algorithm: 'mulberry32',     // seeded, fast; one independent stream per purpose
    // outcome of step k = f(seed, 'outcome', k) -> never depends on colour choices or visuals
    streams: ['outcome', 'break', 'failureType', 'variety', 'solver', 'messages'],
  },

  // ---------------- TABLE GEOMETRY (real snooker table) ----------------
  table: {
    length: 3.569,               // cushion face to cushion face
    width: 1.778,
    ballRadius: 0.02625,         // 52.5 mm balls
    baulkLineFromBottom: 0.737,
    dRadius: 0.292,
    blackFromTop: 0.324,
    // pink spot = midway between blue (centre) and the top cushion, so it is computed, not set
    // Pockets. Spots (yellow, green, brown, blue, pink, black) are computed from the numbers above.
    // Each jaw = a rounded part (arc tangent to the cushion face) + a straight part; the two straight parts are
    // parallel, `mouth` apart. WPBSA templates are not published; widths are the accepted template widths,
    // the fall is a fitter's figure, jaw radii are measured from the template photos (see docs/POCKETS.md).
    mouthExtra: 0.000,           // "effective width" added to every mouth (undercut rubber); tune difficulty here
    corner: {
      mouth: 0.089,              // 3.5 in template
      jawRadius: 0.110,          // measured from photo pocket4: 110 mm (range 85-135)
      throatLength: 0.140,       // straight parallel part, to the back of the pocket
      fallSetback: 0.020,        // measured (pocket4 template front, pocket1): fall ~20 mm past the end of the curve (0-40)
      fallFrom: 'throat',
      slateCutRadius: 0.089,     // slate cut ~3.5 in radius
    },
    middle: {
      mouth: 0.102,              // 4 in template
      jawRadius: 0.080,          // owner's choice: low end of the photo range (pocket3 80-130; pocket2 suggests 70-95)
      throatLength: 0.140,
      fallSetback: 0.012,        // measured from photo pocket2: hole edge ~12 mm behind the cushion line (5-25)
      fallFrom: 'cushionLine',   // here the "2 in overhang" is sideways: the cut starts near the cushion line
      slateCutRadius: 0.089,
    },
  },
  rack: {
    redGap: 0.0002,              // gap between touching reds in the triangle
    pinkToApexGap: 0.002,        // gap between pink and the front red
    cueStart: [0.12, -1.15],     // cue ball in the D before the break-off (x, y); break library may override
  },
  ballValues: { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 },
  respotPriority: ['black', 'pink', 'blue', 'brown', 'green', 'yellow'],
  finalColourOrder: ['yellow', 'green', 'brown', 'blue', 'pink', 'black'], // RULES C.3
  respot: {
    gap: 0.0002,                 // a spot is free if a ball placed there is at least this far from every other ball
    lineStep: 0.0005,            // search step along the long centre line when every spot is covered (RULES C.2)
  },

  // ---------------- PHYSICS (our own deterministic 2D module) ----------------
  physics: {
    timestep: 1 / 480,           // fixed step, seconds
    maxSimSeconds: 8,            // safety stop for a simulation
    gravity: 9.81,               // m/s^2
    rollingFriction: 0.05,       // deceleration = rollingFriction * gravity; "light game" (owner, task 1.4, provisional)
    // Debug friction slider marks. Real snooker cloth: about 0.01-0.02 (a ball rolled at 1 m/s runs 2.5-5 m).
    frictionMarks: { realisticCloth: 0.015, lightGame: 0.05, game: 0.12 },
    slidingFriction: 0.2,        // cloth friction while a ball slides (spin and speed do not match)
    maxTipOffset: 0.5,           // full follow/screw = cue tip half a ball radius above/below centre
    ballBallRestitution: 0.95,
    cushionRestitution: 0.75,
    jawRestitution: 0.6,         // pocket jaws are softer than the straight cushions (more rattles drop)
    stopSpeed: 0.005,            // below this a ball is "stopped"
    maxEventsPerStep: 64,        // safety limit for contacts inside one time step (should never be reached)
    maxCueSpeed: 6.0,            // m/s, hardest shot
    spinMin: -1, spinMax: 1,     // -1 = screw (back spin), +1 = follow; no side spin in v1
  },

  // ---------------- SHOTS AND PACE ----------------
  shot: {
    minDuration: 1.0,            // until object ball potted AND cue ball stopped
    maxDuration: 1.5,
    maxDurationFlex: 2.2,        // fallback level 1 may allow this
    playbackTimeScale: 1.0,      // >1 = play recorded shot faster (pace tuning without re-solving)
    // Night 4, Part 3b (docs/SLOW-SHOTS.md option 1): play the END of a shot faster, playback only (src/view/fastEnd.ts).
    // Starts only once the result is visible (every pot down, the object ball at rest or dropped), the same rule on
    // success and failure shots; eases from 1x to `rate` over `ease` s; not when less than `minRest` s would remain.
    // OFF by default (owner decides after a phone check); dev panel switch.
    fastEnd: { enabled: false, rate: 2.5, ease: 0.4, minRest: 0.5 },
    preferLowestPower: true,
    buttonsReturnDelay: 0.1,
  },

  // ---------------- SHOT SOLVER ----------------
  solver: {
    version: '4.10',           // shown in the weird-shot list: a replay needs the same solver version
    timeBudgetMs: 150,           // per outcome, in a Web Worker, solved while the player decides (a guide now)
    // The search stops after this many simulated shots, NOT after a number of ms, so every device (fast PC or slow
    // phone) picks exactly the same shot (task 4.5 plan, done early). 250 shots take about 150 ms on the dev PC.
    shotBudget: 250,
    // RULES D.3 wide search (after the normal search found nothing within shot.maxDurationFlex): natural shots only
    wide: { shotBudget: 1000, aimSamples: 13, aimStep: 0.004, powerSamples: 10,
            spinSamples: [-1, -0.6, -0.3, 0, 0.3, 0.6, 1] },
    // position play (task 4.3): the search minimises shot length + weight x how hard the next shot looks from where
    // the cue ball stops (cut/45 + mean distance in m; about 0.5 easy, 2-3 hard; noShotCost when no pocket is open)
    position: { enabled: true, weight: 3, noShotCost: 4, overPenalty: 10, overFrom: 1.5, deadPenalty: 100, lockedCost: 5 }, // overFrom: seconds; extra cost per second above it; deadPenalty: no open pocket for the next ball
    aimSamplesPerPocket: 9,      // aim points across the pocket mouth (centre first, then alternating sides)
    aimStep: 0.005,              // metres between aim points across the mouth
    aimRetryWithin: 0.12,        // m: a missed pot tries the next aim point only if the ball came this near the pocket
    firstPowerAt: 0.45,          // the search starts at this share of the power range and works outwards
    minSpeed: 0.8,               // m/s, softest power tried (powers go up to physics.maxCueSpeed)
    maxCutDeg: 75,               // thinner cuts are not tried
    // failure shots (task 4.2): aim points across the pocket mouth (m, + = left of the approach) for each type
    failure: {
      aimOffsets: {
        plainMiss: [0.06, -0.06, 0.075, -0.075, 0.09, -0.09, 0.11, -0.11, 0.13, -0.13], // just outside the jaws
        jawRattle: [0.03, -0.03, 0.035, -0.035, 0.04, -0.04, 0.045, -0.045], // onto the jaw
        inOff: [0, 0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.08, -0.08, 0.1, -0.1],
        wrongBallFirst: [0, 0.02, -0.02],
      },
      mustReach: 0.2,            // a missed target ball must come within this of the pocket mouth (a real attempt)
      softSpeeds: [0.4, 0.6, 0.9, 1.3], // RULES D.2 soft shot into a wrong ball (m/s)
      tapSpeed: 0.08,            // RULES D.2 gentle tap that hits nothing (m/s, rolls about 1 cm)
      tapDirections: 24,
      maxCutDeg: 50,             // task 4.7: a failure is an attempt at a sensible pot: cut at most this
      potMargin: 1.0,            // ... and a pot whose naturalness cost is within this of the most natural one
      maxSpeed: 4.5,             // m/s: no smashes
      softFoulMaxShots: 40,      // cap on the soft-foul attempts (fixed, whatever the number of balls)
    },
    powerSamples: 8,
    spinSamples: [-0.8, -0.3, 0, 0.4, 0.8],
    lookahead: 1,                // accept a pot only if the NEXT step stays solvable
    // night 2026-11-24: object-ball doubles (aim at a pocket's mirror image in a cushion), tried before the spray
    doubles: { shotBudget: 1200, offsets: [0, -0.02, 0.02, -0.04, 0.04], speeds: [3.0, 4.5, 6.0], spins: [0, -0.6] },
    // last search before RE-RACK: many aim points across each target ball, straight and off each cushion, firm
    spray: { shotBudget: 2000, offsets: [0, -0.3, 0.3, -0.55, 0.55, -0.75, 0.75, -0.9, 0.9],
             speeds: [2.5, 3.5, 4.5, 6.0], spins: [0, -0.6, 0.6] },
    // task 4.7: naturalness (how a professional builds a break). Cost 0 = natural; the solver adds weight x cost to
    // its score and keeps exhibition shots for the last searches before RE-RACK. src/core/shotType.ts
    natural: {
      weight: 1.5,               // naturalness cost -> score (seconds-equivalent)
      comfortableCutDeg: 30,     // cuts up to this are free
      cutDegPerPoint: 15,        // then 1 point per 15 degrees
      perMetre: 0.3,             // per metre of cue-to-ball + ball-to-pocket distance
      redFromPackWhileLoose: 1.0, // taking a red out of the pack while loose reds exist
      clusterGap: 0.02,          // m: reds closer than 2r + this touch "almost"
      clusterNeighbours: 2,      // a red with this many near reds is in the pack
      mediumSpeed: 3.5,          // m/s: powers above it cost powerPerSpeed2 x (excess)^2
      powerPerSpeed2: 0.3,
      longFrom: 2.6,             // m: cue-to-ball + ball-to-pocket above this is a long pot
      farPocketFrom: 1.2,        // m: a pot this far into a pocket ...
      farPocketMargin: 0.6,      // ... when another pocket was this much nearer at a comfortable angle = far pocket
      doubleFrom: 0.3,           // m: a cushion touch further than this from the pocket it drops into = a double
      // strict naturalness (owner 2026-11-24): ALL must hold, else the shot is not natural (shotType.naturalCheck)
      maxSeconds: 2.5,           // the whole shot
      maxCueCushions: 1,         // cushions the cue ball touches after its first contact
      maxCueTravel: 1.5,         // m the cue ball rolls after its first contact (about 40% of the table length)
      disturbFrom: 0.01,         // m: a ball that moves more than this is disturbed ...
      packDisturbMax: 0.5,       // ... except reds moved at most this far by a (pack / soft) cannon
      packCannonSpeed: 1.5,      // m/s: a pack cannon hitting the reds harder is not planned
      unnaturalPlayCost: 3.0,
      lookaheadNatural: false,   // the lookahead check accepts only a strictly natural next shot
      autoColourNeedsNextRed: true, // RULES B.3 auto colour: black is 'natural' only if it also leaves a red
      planColours: true,         // task 4.7: on a colour, solve the red after it for each candidate (two shots ahead)
      wideForPoorColour: false,  // night round 4: a red pot that leaves a poor colour also runs the wide search
      planReds: true,            // night round 2: plan a red two shots ahead too (solve black / pink / blue after it)
      planCandidates: 8,         // ... colour shots checked (cap: 8 x (1 + lookaheadShots) stays below the lookahead cap)
      planMargin: 3.0,           // ... within this score of the best colour shot
      planWeight: 1.0,           // ... the red's score counts this much in choosing the colour shot    // naturalness cost of a pot that fails the strict check (cue ball running around ...)
      softCannonSpeed: 0.8,      // m/s: the cue ball touching reds after a red pot at most this fast = soft cannon (natural)
      cannonCost: 3.0, longCost: 3.0, exhibitionCost: 6, // night round 1: 1.5 / 2.0 -> 3 / 3
      poorNextCost: 2.5,         // after a colour: a next red this hard (long, touching, thin) -> also run the wide search
      touchGap: 0.01,            // m: balls closer than 2r + this touch (position: a touching red is a poor next ball)
      touchingCost: 2.5,         // ... it costs this much more as the next ball (open the pack instead)
      pathMargin: 0.02,          // m: position: the next ball's paths must clear other balls by this much
      maxEntryDeg: { middle: 45, corner: 50 }, // a pot is tried only when the ball comes in within this of straight-in
      minLooseReds: 1,           // after a colour, fewer loose reds than this with a pack left = pack left closed
      packClosedCost: 1.0,
      idealNextCutDeg: [5, 35],  // position: leave an angle on the next ball
      straightCost: 0.3,         // dead straight next ball (no angle to play position)
      // Positional play around the black (owner, night 2026-11-24; docs/SOLVER.md "Phase 1"). Ends are named by the
      // balls: black end (+y, black spot) and baulk end (-y, yellow/green/brown). All costs are position costs (x position weight).
      blackPlay: {
        enabled: true,
        behindBlackCost: 2.0,      // next ball black, cue ball between the black and the black-end cushion
        blackDist: [0.3, 0.9],     // m: comfortable cue-ball-to-black distance ...
        blackDistCostPerM: 1.5,    // ... cost per metre outside it
        blackCutDeg: [10, 32],     // next ball black: about three-quarter ball to half ball
        thinCutFrom: 50,           // any next ball: a cut sharper than this is a positional failure of this shot ...
        thinCutCost: 3.0,          // ... and costs this much
        sideMaxDeg: 70,            // next ball a colour while reds remain: a loose red within this of the cue ball's
        wrongSideCost: 1.0,        // natural path after the pot (the tangent line), else this cost (wrong side)
        // pocket choice: a red from the black half into a baulk-end corner; a middle pocket (when natural);
        // black into anything but a black-end corner; pink into a baulk-end corner
        redBaulkCornerCost: 2.0, redMiddleCost: 0.3, colourOffPocketCost: 2.0,
        zoneHalfWidth: 0.45,       // m: keep the cue ball between black, pink and blue (|x| <= this, blue.y - zoneBelowBlue
        zoneBelowBlue: 0.1,        // <= y <= black.y) while reds remain in the black half ...
        zoneCostPerM: 1.5,         // ... cost per metre outside that zone
      },
      // Task 4.9 (owner 2026-11-25): position on the next RED after a colour (solver redPlayCost); position costs
      redPlay: {
        enabled: true,
        cutDeg: [5, 35],           // a small, comfortable angle on the red (not dead straight, not thin) ...
        cutDegPerPoint: 15,        // ... above it 1 point per this many degrees
        farPocketCost: 1.5,        // a red in the black half into a pocket that is not one of its two nearest
        sideCushionM: 0.25,        // m: cue ball this near a side cushion for the red ...
        sideCushionCost: 1.0,      // ... costs this much
        returnBelowBlack: 0.35,    // m: the goal for the cue ball after the red: this far below the black (pink side)
        returnMaxDeg: 45,          // the goal within this of the cue ball's natural line (tangent or follow) ...
        returnNearM: 0.4,          // ... unless the red is already this near the goal
        returnCost: 1.0,           // ... else this cost
        maxCost: 1.0,              // cap on far pocket + side cushion + return (x position weight 3 = a long pot's cost)
        inRedLookahead: false,     // also in a red's look-ahead (the colour after it)? false: there the colour comes first
      },
      // task 4.10 (owner 2026-11-25): a red that leaves no natural black or pink (the auto pick then plays a long blue)
      topColour: {
        enabled: true,
        noNaturalCost: 3.0,        // red planning: added when neither the black nor the pink is natural after this red
        extraCandidates: 4,        // ... and if none of the checked reds leaves one, this many more reds are checked
        redCheckShots: 60,         // ... natural means: natural pot AND a natural red after it (like the auto pick); budget of that check
        longDisturbCost: 3.0,      // a long colour pot that moves another ball (more than disturbFrom) costs this much more
      },
      // Night 4, Part 3c: position-play experiment "solver 4.11p" (owner's real-player patterns). OFF by default; dev
      // panel switch. Success planning only (failures never look at position). For the next ball black or pink (after
      // a red), or a red in the black half (after a colour):
      pos411p: {
        enabled: false,
        notBlackEndCornerCost: 1.0, // ... a pot not into a black-end corner pocket costs this much
        cutBackCost: 1.5,          // ... the cue ball nearer the black-end cushion than that ball (the pot is cut back)
        innerMarginM: 0.03,        // m: the cue ball must stop at least this much below the ball (inner side)
      },
      // RULES B.3 (owner 2026-11-24): auto colour = the first of these with a natural shot; else black
      autoColours: ['black', 'pink', 'blue'],
      nextColourCost: { black: 0, pink: 0.5, blue: 1.0 }, // position after a red: black preferred
    },
    // task 4.7: exhibition search (cushion-first, plants, blocked pairs; wide grid), last resort before the spray
    exhibition: { shotBudget: 1000 },
    // night 2026-11-24 (RULES D: avoid RE-RACK): when every shot found leaves the next ball unreachable, search again
    // (wide) and keep a shot only if the next ball can then be potted by any shot (exhibition and cushion-first allowed)
    // night 2026-11-25: a last-resort shot (exhibition, doubles, spray) must leave a pottable ball if one of them can
    lastResortCheck: { enabled: true, shotBudget: 1000 },
    rescue: { enabled: true, candidates: 6, lookaheadShots: 300, margin: 30 }, // margin: candidates within this score of the best
    lookaheadMargin: 1.0,        // task 4.7: shots within this score of the best are kept as lookahead candidates
    lookaheadSpread: 0.15,       // m: ... and checked only if their cue ball stops this far from the ones already checked
    lookaheadCandidates: 4,      // how many of the best shots are checked (best first)
    lookaheadShots: 100,         // shot budget for solving the next step in that check (per colour tried after a red)
    requireBlackPottableAfterRed: true,
    requireExtraColoursPottable: 1,  // black + at least this many more
    // flex order when no shot is found (outcome never changes):
    flexOrder: ['longerDuration', 'otherPocket', 'otherBallSameType', 'wideSearch', 'fallbackShot'],
    logFallbacks: true,
  },

  // ---------------- VISUAL DIFFICULTY FOLLOWS THE ODDS (addition A) ----------------
  // score = wCue*dist(cue,object) + wPocket*dist(object,pocket) + wCut*cutAngle ; normalised 0..1
  difficulty: {
    weights: { cueToObject: 0.35, objectToPocket: 0.35, cutAngle: 0.30 },
    maxCutDeg: 75,
    // target range by ladder progress (step / steps); solver prefers shots inside the range
    targets: [
      { upToProgress: 0.25, min: 0.00, max: 0.30 },
      { upToProgress: 0.50, min: 0.15, max: 0.45 },
      { upToProgress: 0.75, min: 0.30, max: 0.65 },
      { upToProgress: 1.00, min: 0.45, max: 0.85 },
    ],
  },

  // ---------------- VARIETY (addition E) ----------------
  variety: {
    randomRedPick: true,         // do not always take the easiest red
    pocketSpread: 0.3,           // 0 = always best pocket, 1 = any valid pocket equally
    specialShotRate: 0.08,       // per success shot
    specialShots: { cushionFirst: 0.3, middlePocket: 0.4, longPot: 0.3 },
  },

  // ---------------- FAILURES (visual only, never affect odds) ----------------
  failures: {
    step1: { plainMiss: 0.80, snookered: 0.20 },
    later: { plainMiss: 0.60, jawRattle: 0.25, inOff: 0.10, wrongBallFirst: 0.05 },
    stripLabels: { plainMiss: 'MISSED', jawRattle: 'MISSED', inOff: 'IN-OFF',
                   wrongBallFirst: 'FOUL', snookered: 'SNOOKERED' },
  },

  // ---------------- POCKET-CAMERA CUT (must never reveal the result, RULES B.6) ----------------
  // From step 2. To reveal nothing: P(cut | success) must equal P(cut | failure)
  //   = rattleCutRate * failures.later.jawRattle = 0.40 * 0.25 = 0.10. A test checks this.
  pocketCut: {
    rattleCutRate: 0.40,         // share of jaw rattles that get the cut
    successCutRate: 0.10,        // share of successful pots that get the same cut
    secondsBeforeArrival: 0.5,   // cut happens this long before the ball reaches the pocket
    maxSeconds: 3,
  },

  // ---------------- RE-RACK (last resort, RULES D.4) ----------------
  reRack: {
    stripText: 'RE-RACK · WON {amount} · x{multiplier}',
    maxPerHundredThousandShots: 1, // soak test limit
  },

  // ---------------- BREAK-OFF LIBRARY ----------------
  breakLibrary: {
    perLevelPerKind: 200,        // kinds: 'redPottable', 'snookered'
    files: { reds6: 'breaks/reds6.json', reds10: 'breaks/reds10.json', reds15: 'breaks/reds15.json' }, // in public/
    minPottableRedsForRedPottable: 2,
    seed: 147,
    // the opponent's break-off: cue ball in the D, aimed this many ball radii outside the outer red of the pack
    breakShot: { speedMin: 4.5, speedMax: 6.0, offsetMin: 0.6, offsetMax: 2.0, spins: [-0.3, 0, 0.3] },
    escapeSpeeds: [1.5, 2.5, 3.5], // the failed escape from a snooker (step 1)
    // owner 2026-11-24: a break may move these colours at most this far (m) from their spots
    stillColours: ['yellow', 'green', 'brown', 'blue'] as const,
    maxColourMove: 0.02,
    // owner 2026-11-25: the break-off may move the pink and the black each at most this far (m) from their spots
    topColours: ['pink', 'black'] as const,
    maxTopColourMove: 0.30,
    requireNaturalChain: true,
    maxPackedShare: { reds6: 0.5, reds10: 0.5, reds15: 0.6 }, // at most this share of the reds still packed after the break   // task 4.7: step-1 red, the black after it and the next red all natural
  },

  // ---------------- COLOUR CHOICE ----------------
  colourChoice: {
    optionsMin: 2,
    optionsMax: 3,
    alwaysOfferBlack: true,
    // offered: black + every other colour with a ready pot, up to optionsMax, higher values first
    offerOrder: ['pink', 'blue', 'brown', 'green', 'yellow'],
    finalColoursUseShootButton: true,
    autoPickBeforeColourStage: 'black',
  },

  // ---------------- MESSAGES (ladder strip, ~1 s, max one per shot) ----------------
  messages: {
    durationSeconds: 1.0,
    priority: ['MAXIMUM', 'TOTAL_CLEARANCE', 'OPPONENT_NEEDS_SNOOKERS', 'CENTURY', 'FIFTY_BREAK',
               'FRAME_BALL', 'MAXIMUM_IS_ON', 'LAST_RED', 'ON_THE_COLOURS', 'FLUKE'],
    maximumIsOnFromRed: { reds6: 3, reds10: 4, reds15: 5 },
    flukeRate: 0.02,
    clearanceMessageMaxSeconds: 3,
  },

  // ---------------- CAMERAS (Three.js, all numbers here) ----------------
  camera: {
    // Main camera presets (owner chooses, task 2.1). A preset gives the viewing angle and the lens; the distance and
    // aim point are fitted to the screen so the whole table (plus fitEdge) always shows, as large as possible.
    // Angle = degrees above the cloth (90 = straight down). History: first config camera [0,-2.6,4.2] -> [0,0.15,0]
    // was about 57 degrees but cut off the table on a portrait phone; task 2.1 used [0,-2.7,7.4] -> [0,-0.15,0] = 71.
    main: 'C' as 'A' | 'B' | 'C',  // owner's choice 2026-11-24 (task 2.1); A and B kept to switch later
    presets: {
      A: { label: 'A steep', elevationDeg: 71, fov: 38 },   // the task 2.1 angle
      B: { label: 'B flat', elevationDeg: 57, fov: 38 },    // the first config camera's angle
      C: { label: 'C middle', elevationDeg: 64, fov: 38 },
    },
    fitEdge: 0.16,               // metres beyond the cushion faces that must stay in view (corner pocket holes)
    fitMargin: 0.02,             // share of the view kept free at the tightest edge
    pockets: {                   // six fixed cameras, used for near-miss and the final pot of a clearance
      topLeft:     { position: [-0.6,  2.2, 0.35], lookAt: [-0.889,  1.78, 0], fov: 35 },
      topRight:    { position: [ 0.6,  2.2, 0.35], lookAt: [ 0.889,  1.78, 0], fov: 35 },
      middleLeft:  { position: [ 0.3,  0.0, 0.40], lookAt: [-0.889,  0.00, 0], fov: 35 },
      middleRight: { position: [-0.3,  0.0, 0.40], lookAt: [ 0.889,  0.00, 0], fov: 35 },
      bottomLeft:  { position: [-0.6, -2.2, 0.35], lookAt: [-0.889, -1.78, 0], fov: 35 },
      bottomRight: { position: [ 0.6, -2.2, 0.35], lookAt: [ 0.889, -1.78, 0], fov: 35 },
    },
    slowMotionScale: 0.35,
    clearanceFinale: 'replayAfterPot', // final pot plays from main camera, then pocket-camera slow-motion replay
  },

  // gray-box 3D view (task 2.1): plain shapes only
  view3d: {
    background: '#0f1513',       // same as the game page background
    rim: 0.2,                    // wooden frame width outside the cushion faces (m), wide enough for the throats
    cushionHeight: 0.036,        // cushion nose height above the cloth (m), about 0.7 ball diameter
    cushionDepth: 0.05,          // how far the cushion boxes reach behind the face (m)
    jawPieces: 6,                // straight pieces per rounded jaw
    // How big the balls are DRAWN (1 = true size). Visual only: physics, pockets and the solver keep the true radius.
    ballScale: 1.4,              // owner's choice after the real-phone test (2026-11-24), provisional
    ballScaleOptions: [1, 1.3, 1.4, 1.6, 2], // developer menu on the game page
    ambientLight: 1.2, topLight: 1.6,
    // Night 4: the approved look (look A + T1 pockets, src/view/tableLook.ts) or the old gray box (dev panel switch).
    look: 'club' as 'club' | 'grey',
    club: { shadowMap: 2048, maxPixelRatio: 2 }, // lamp shadow map size (px) and the highest device pixel ratio drawn
    dropSeconds: 0.2,            // a potted ball is seen falling into the hole for at most this long (visual only)
    // Night 4, Part 4: the cue (C1, approved in docs/cue-options.html; drawn by src/view/cue.ts). Shown after the SHOOT
    // press and on the automatic step-1 shot: appears, one short stroke (appear + stroke <= 0.25 s), then fades out while
    // the balls roll. Visual and timing only. ON by default, dev panel switch.
    cue: { enabled: true },
  },

  // Game screen layout from mockups A/C/D (share of the screen height, top to bottom). Used by the replay check page
  // to draw placeholder boxes; task 2.2 builds the real layout.
  layout: {
    phoneAspect: 9 / 19.5,
    portraitBelow: 0.8,          // window width/height below this = a phone: the game uses the full screen
    sidePad: 0.04,               // share of the width
    topBar: [0.0, 0.075], table: [0.075, 0.735], ladder: [0.74, 0.785], cashOut: [0.80, 0.855],
    hint: [0.86, 0.89], shoot: [0.898, 0.98],
  },

  // ---------------- UI TIMING ----------------
  ui: {
    wonMessageSeconds: 1.0,      // then the bet area returns
    balanceCountUpSeconds: 0.8,
    reRackSeconds: 0.4,
    ladderStrip: { previous: 1, next: 3 },
    minButtonHeightPx: 44,
    rememberLevel: true,
    rememberMute: true,
  },

  // ---------------- SOUND ----------------
  sound: {
    masterVolume: 0.8,
    ballBallMinImpact: 0.05, ballBallMaxImpact: 4.0,   // impact speed -> volume 0..1
    table: ['cueHit', 'ballBall', 'cushion', 'pocketDrop', 'jawRattle', 'breakOff'],
    ui: ['button', 'cashOut', 'popup'],
    voiceSlots: [                // optional, empty until the owner supplies files
      'MAXIMUM', 'TOTAL_CLEARANCE', 'OPPONENT_NEEDS_SNOOKERS', 'CENTURY', 'FIFTY_BREAK',
      'FRAME_BALL', 'MAXIMUM_IS_ON', 'LAST_RED', 'ON_THE_COLOURS', 'FLUKE',
      'FOUL', 'SNOOKERED', 'IN_OFF', 'MISSED', 'RE_RACK',
    ],
    crowd: { enabled: false },   // polish stage
  },

  // ---------------- DEV (development builds only) ----------------
  dev: {
    testPanel: true,             // ignored in production builds
    soak: { rounds: 5000, rtpRngOnlyRounds: 2_000_000 },
    breakAimRow: 1,              // debug/test break: aim at the outer red of this triangle row (0 = front)
    breakAimOffset: 1.5,         // ... this many ball radii outside it (picked by a scan, see testShots.ts)
    debugPowerDefault: 0.5,      // debug page power slider start (share of maxCueSpeed)
    // speed benchmark + pace study (task 1.4): random full-rack shots; quickest potting shot per one-red layout
    bench: { seed: 147, reds: 15, shots: 200, minSpeed: 1.0, maxSpeed: 6.0, targetMsPerShot: 1.0,
             paceLayouts: 30, paceMaxCutDeg: 45, paceMinSpeed: 0.3, paceSpeedStep: 0.1,
             paceFrictions: [0.015, 0.03, 0.05, 0.08, 0.12] },
    spinTest: { gap: 0.3, cueY: -1.0 },
    // task 2.2 static game screens (placeholders until the game loop exists). Ball places copied from mockups A/C/D
    // (table metres; colours not listed stay on their spots; D = the start rack).
    screens: {
      level: 'reds6',              // balance and bet: money.startingBalance and money.defaultBet
      D: { step: 0, hint: '' },
      A: { step: 4, hint: 'RED · NEXT x{next}', cue: [-0.12, -0.49],
           reds: [[-0.045, 0.75], [0.13, 0.61], [-0.2, 0.51], [0.27, 0.30]] },
      C: { step: 5, hint: 'CHOOSE A COLOUR · NEXT x{next}', cue: [-0.165, 0.68],
           reds: [[0.13, 0.61], [-0.2, 0.51], [0.27, 0.30]], colourChoices: ['blue', 'pink', 'black'] },
    },
    // task 2.1 check page: a red potted into a corner (quickest valid shot is searched, see testShots.ts)
    potRedShot: { cue: [0.25, 0.2], red: [0.55, 1.15], pocket: 'topRight', aimRange: 0.03, aimStep: 0.005,
                  minSpeed: 0.3, speedStep: 0.1 }, // debug "straight shot test": cue ball position and distance to the red
    // debug page "pocket test": roll one ball at a pocket
    pocketTest: { distance: 0.2, speed: 1.5, angleMaxDeg: 70, offsetMaxMm: 60, mapAngleStepDeg: 5, mapOffsetStepMm: 3,
                  cornerJawMarks: [0.085, 0.110, 0.135], middleJawMarks: [0.070, 0.080, 0.095, 0.130] },
  },
} as const;
