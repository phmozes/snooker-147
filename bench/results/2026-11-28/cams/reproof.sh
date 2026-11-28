#!/bin/sh
# 2026-11-28 (player cams): replay check, v1-v4 codes, after this task's changes. fp.test.ts FP_MODE=compare fails on any different
# round; OUT gets its "<n> identical, <m> different" line. The sets run in parallel (12 cores).
cd "$(dirname "$0")/../../../.."
OUT=bench/results/2026-11-28/cams/reproof
mkdir -p $OUT
rm -f $OUT/*.log $OUT/lines.txt
run() { name=$1; in=$2
  FP_MODE=compare IN=$in OUT=$OUT/lines.txt npx vitest run bench/night4/fp.test.ts > $OUT/$name.log 2>&1
  echo "$name: $(grep -E 'Tests ' $OUT/$name.log | tr -s ' ')" >> $OUT/summary.txt
}
: > $OUT/summary.txt
run v1-marks bench/results/night6/old-marks.jsonl &
for l in reds6 reds10 reds15; do run v2-$l bench/results/night6/old-v2-$l.jsonl & run v3-$l bench/results/night6/v3-$l.jsonl & done
for k in 0 1 2; do run v4-reds6-$k bench/results/night8/v4-reds6-$k.jsonl & done
wait
echo done >> $OUT/summary.txt
