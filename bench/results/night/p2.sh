#!/bin/sh
# usage: p2.sh <tag> '<PATCH json>'  -> 60 rounds at 6 and 15 reds in parallel with a config patch
cd "$(dirname "$0")/../../.."
D=bench/results/night
for L in reds6 reds15; do N=60 LEVELS=$L OUT=$D/$1-$L.json PATCH="$2" npx vitest run bench/natural.test.ts > $D/$1-$L.log 2>&1 & done
wait
node $D/sum.mjs $D/$1-reds6.json $D/$1-reds15.json > $D/$1.sum
