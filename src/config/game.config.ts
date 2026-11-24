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
  // p(1) = targetRtp / firstMultiplier, then linear down to pLast.
  // multiplier(k) = floor(targetRtp / (p1*...*pk) * 100) / 100, last step fixed to topMultiplier.
  // Expected ladders are test fixtures in tests/ladder.test.ts (checked: they match these numbers exactly).
  ladder: {
    targetRtp: 0.97,
    firstMultiplier: 1.05,
    rtpTestMin: 0.961,
    rtpTestMax: 0.970,
  },
  levels: [
    { id: 'reds6',  reds: 6,  steps: 18, pLast: 0.7492656301419769, topMultiplier: 25,  maximumBreak: 75,
      label: '6 reds · up to x25' },
    { id: 'reds10', reds: 10, steps: 26, pLast: 0.7964942341213621, topMultiplier: 50,  maximumBreak: 107,
      label: '10 reds · up to x50' },
    { id: 'reds15', reds: 15, steps: 36, pLast: 0.8353317234189956, topMultiplier: 100, maximumBreak: 147,
      label: '15 reds · up to x100' },
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
    preferLowestPower: true,
    buttonsReturnDelay: 0.1,
  },

  // ---------------- SHOT SOLVER ----------------
  solver: {
    timeBudgetMs: 150,           // per outcome, in a Web Worker, solved while the player decides (a guide now)
    // The search stops after this many simulated shots, NOT after a number of ms, so every device (fast PC or slow
    // phone) picks exactly the same shot (task 4.5 plan, done early). 250 shots take about 150 ms on the dev PC.
    shotBudget: 250,
    aimSamplesPerPocket: 9,      // aim points across the pocket mouth (centre first, then alternating sides)
    aimStep: 0.005,              // metres between aim points across the mouth
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
    },
    powerSamples: 8,
    spinSamples: [-0.8, -0.3, 0, 0.4, 0.8],
    lookahead: 1,                // accept a pot only if the NEXT step stays solvable
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
    files: { reds6: 'breaks/reds6.json', reds10: 'breaks/reds10.json', reds15: 'breaks/reds15.json' },
    minPottableRedsForRedPottable: 2,
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
