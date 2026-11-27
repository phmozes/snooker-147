# Night 4 report (2026-11-26/27)
(Written during the night; the final summary is at the top when the night ends.)

## Part 3c pass rule (fixed BEFORE the ON soak was started, 2026-11-27 ~02:10; run once, no re-tuning)
Paired soak, the same 1,000 v2 rounds per level (seeds 5,000,000 + shard + 4i, shards 0-3, 250 rounds each), switch
OFF (= solver 4.10, bench/results/soak-n4base) vs ON (solver 4.11p, bench/results/soak-n4pos). PASS only if, per level:
1. stuck 0 (over the shot cap or a crash);
2. RE-RACK ON <= OFF;
3. success-fallback % (success shots that needed any flex step) ON <= OFF + 1.0 point;
4. shots over 3.5 s that are not last resort: ON <= OFF;
5. THINKING time median ON <= OFF x 1.10. THINKING is measured by the number of simulated shots per success solve
   (the solver's work; the same on every device and not disturbed by the PC load during the soak). The solve
   milliseconds are reported next to it for information only (the PC runs other jobs at the same time).
Whatever the result, the switch stays OFF.
