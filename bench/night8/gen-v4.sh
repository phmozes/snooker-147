#!/bin/sh
# Night 8: build the v4 6-red library in 11 parallel chunks of 400,000 attempt indices each (0 .. 4,400,000).
cd "$(dirname "$0")/../.."
for k in 0 1 2 3 4 5 6 7 8 9 10; do
  FROM=$((k*400000)) TO=$(((k+1)*400000)) OUT=bench/results/night8/v4chunk-$k.json npx vitest run bench/night8/gen-v4-chunk.test.ts > bench/results/night8/v4chunk-$k.log 2>&1 &
done
wait
echo done
