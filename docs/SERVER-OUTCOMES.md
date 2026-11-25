# Server outcomes (design note, night 3 — no code yet)
Before real money, the outcome of every step must be decided on a server; the seed must never reach the browser
until the round is over. The game logic (RULES A.5: outcome = seed + step only) does not change.

## Open decisions for the owner (top first)
1. Licence and certified RNG: which jurisdiction / test lab (needed before any real-money launch; legal advice first).
2. Verify mode: "provably fair" (seed hash shown before START, seed shown after the round) — yes / no.
3. Player seed: may the player add their own text to the seed (stronger proof, standard in crypto games) — yes / no.
4. Hosting and cost: which server/provider and region (goes into EXPENSES.md); what happens if the server is down.
5. Who owns the balance and bet limits on the server, and how long round records are kept (privacy policy).

## What moves to the server
- The round seed: a random 32-byte server seed per round from a cryptographic RNG (later: the certified one).
- Balance, bet, START, SHOOT, CASH OUT: the server takes the bet, decides step k from (seed, k) with the same
  stepSucceeds code (shared TypeScript in src/core), pays CASH OUT / clearance / RE-RACK and keeps the record.
- The outcome stream: the browser asks "SHOOT step k" and gets back only `success` or the failure type for step k,
  never u, p of a future step, or the seed.
- RE-RACK: the browser reports "no shot found"; the server checks it by running the same solver (deterministic,
  shot budget counted in shots, not time) before paying. Cheap to check because it is rare (night-3 soak: docs/NIGHT-3.md).

## What the browser still does
- Physics, the solver (both outcomes are solved before SHOOT, as now: THINKING… never hints at the result), playback,
  sound, colour choice. It cannot change odds: it only learns the outcome of the step it is playing.
- The colour pick and position play stay visual only (they never change money).

## How a player verifies a round afterwards
1. Before START the server shows `hash = SHA-256(server seed)` (and the player's own seed text, if decision 3 is yes).
2. After the round ends the server reveals the server seed. The round code becomes `level-seed-letters-Cstep` as today
   (task 5.4), with the long seed.
3. A public verify page (static, runs in any browser, open source): it checks SHA-256(seed) = the hash shown before
   START, then replays the round from the round code (same break, shots, outcomes, end) and shows u and p per step.
4. Optional: the next round's hash is shown with the reveal, so the server cannot pick a seed after seeing the bet.

## Steps (when the owner says go)
1. Split src/core into "server-safe" (rng, round, ladder, rules) and "client" (solver, physics, view). Already pure.
2. Small server: START / SHOOT / CASH OUT endpoints, seed store, balance ledger, rate limits, logs. Tests: the same
   fairness tests run against the server API.
3. Seed size: today seeds are 32-bit (round codes stay short). For real money use the 256-bit server seed and derive
   the 32-bit game seed from it (HMAC), so codes stay short and the proof still holds.
4. Security review, then a soak against the server (latency on SHOOT must stay hidden behind the solve time).

## Risks
- Latency: SHOOT needs one server round trip (~50-200 ms); hidden by playing the shot only after both answers exist.
- Cheating client: can only see the step it is on; cannot cash out "knowing" the next step (server decides at SHOOT).
- The 32-bit seed range is small for real money (guessable by brute force from a hash): hence point 3 above.
