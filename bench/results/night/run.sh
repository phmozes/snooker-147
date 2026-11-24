#!/bin/sh
# usage: run.sh <tag> [N]  -> runs natural.test.ts for the three levels in parallel, waits, prints the summary
cd "$(dirname "$0")/../../.."
T=$1; N=${2:-60}
for L in reds6 reds10 reds15; do N=$N LEVELS=$L OUT=bench/results/night/$T-$L.json npx vitest run bench/natural.test.ts > bench/results/night/$T-$L.log 2>&1 & done
wait
node bench/results/night/sum.mjs bench/results/night/$T-reds6.json bench/results/night/$T-reds10.json bench/results/night/$T-reds15.json > bench/results/night/$T.sum
