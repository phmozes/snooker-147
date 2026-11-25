#!/bin/sh
# Task F.1: the fairness run, one level after another (memory). Resumes from <level>.done.
cd "$(dirname "$0")/../.."
D=bench/results/fairness; mkdir -p $D
for L in reds6 reds10 reds15; do
  F=0; [ -f $D/$L.done ] && F=$(cut -d' ' -f1 $D/$L.done)
  [ "$F" -ge "${N:-5000}" ] && continue
  LEVEL=$L SEED_FROM=$F N=$(( ${N:-5000} - F )) OUT=$D npx vitest run bench/fairness.test.ts > $D/$L.log 2>&1
done
