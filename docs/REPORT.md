# Report: owner's server decisions recorded (2026-11-27)

The owner's 5 server decisions of 2026-11-27 are written at the top of docs/SERVER-OUTCOMES.md under "Owner's
decisions (2026-11-27)". They replace the old "Open decisions for the owner" list; the rest of the file is unchanged.
The decisions:
1. B2B: the casino holds the licence, accounts and balance; we supply the game and a small outcome server. A
   gambling lawyer first.
2. Provably fair as a per-casino switch.
3. Player seed inside that switch, off by default, under "advanced".
4. We host the server, provider after the lawyer; server down = the casino's rules for unfinished rounds.
5. The casino owns the wallet; bet limits per casino in config; round records kept as the licence requires.

docs/NOW.md: the owner's line "answer the 5 open decisions" is replaced by one line saying the server is decided and
the next step is the owner's gambling-lawyer advice before any server work. No code changed, so no tests, builds or
soaks were run (no soak failures). Committed and pushed to origin/master (standing approval). The previous report is
in docs/reports/2026-11-27-a456be5.md.

One small leftover: step 1 of "How a player verifies a round afterwards" in that file still says "if decision 3 is
yes". With the new decision 3 it should read "if the casino's provably-fair switch and the player seed are on". I left
it as it is because the task said to keep everything else.
