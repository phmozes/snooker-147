#!/bin/sh
# Start the soak test in the background: 3 shards per level. usage: bench/soak-start.sh <until epoch ms> [target per shard]
cd "$(dirname "$0")/.."
U=$1; T=${2:-34000}; O=bench/results/soak
mkdir -p $O
for L in reds6 reds10 reds15; do for S in 0 1 2; do
  LEVEL=$L SHARD=$S SHARDS=3 TARGET=$T UNTIL=$U OUT=$O nohup npx vitest run bench/soak.test.ts > $O/$L-$S.log 2>&1 &
done; done
