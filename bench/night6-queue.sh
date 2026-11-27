#!/bin/bash
# Night 6: runs the remaining proof and soak jobs, at most 8 vitest runs at once (a run = a log without "Duration").
# Run from the project folder: bash bench/night6-queue.sh
O=bench/results/night6
JOBS=(
 "soak/reds10-3.log|LEVEL=reds10 SHARD=3 SHARDS=4 ROUNDS=250 SHOTS=1 OUT=$O/soak bench/soak.test.ts"
 "soak/reds15-0.log|LEVEL=reds15 SHARD=0 SHARDS=4 ROUNDS=250 SHOTS=1 OUT=$O/soak bench/soak.test.ts"
 "soak/reds15-1.log|LEVEL=reds15 SHARD=1 SHARDS=4 ROUNDS=250 SHOTS=1 OUT=$O/soak bench/soak.test.ts"
 "soak/reds15-2.log|LEVEL=reds15 SHARD=2 SHARDS=4 ROUNDS=250 SHOTS=1 OUT=$O/soak bench/soak.test.ts"
 "soak/reds15-3.log|LEVEL=reds15 SHARD=3 SHARDS=4 ROUNDS=250 SHOTS=1 OUT=$O/soak bench/soak.test.ts"
 "rec-v3-reds6.log|FP_MODE=record SET=roundcode LEVEL=reds6 N=100 OUT=$O/v3-reds6.jsonl bench/night4/fp.test.ts"
 "rec-v3-reds10.log|FP_MODE=record SET=roundcode LEVEL=reds10 N=100 OUT=$O/v3-reds10.jsonl bench/night4/fp.test.ts"
 "rec-v3-reds15.log|FP_MODE=record SET=roundcode LEVEL=reds15 N=100 OUT=$O/v3-reds15.jsonl bench/night4/fp.test.ts"
 "cmp-v2-reds15.log|FP_MODE=compare IN=$O/old-v2-reds15.jsonl LEVEL=reds15 OUT=$O/proof-old.txt bench/night4/fp.test.ts"
 "cmp-marks.log|FP_MODE=compare IN=$O/old-marks.jsonl OUT=$O/proof-old.txt bench/night4/fp.test.ts"
 "cmp-v3-reds6.log|AFTER=rec-v3-reds6.log FP_MODE=compare IN=$O/v3-reds6.jsonl LEVEL=reds6 OUT=$O/proof-v3.txt bench/night4/fp.test.ts"
 "cmp-v3-reds10.log|AFTER=rec-v3-reds10.log FP_MODE=compare IN=$O/v3-reds10.jsonl LEVEL=reds10 OUT=$O/proof-v3.txt bench/night4/fp.test.ts"
 "cmp-v3-reds15.log|AFTER=rec-v3-reds15.log FP_MODE=compare IN=$O/v3-reds15.jsonl LEVEL=reds15 OUT=$O/proof-v3.txt bench/night4/fp.test.ts"
)
running() { local n=0; for f in $O/soak/*.log $O/cmp-*.log $O/rec-*.log; do [ -f "$f" ] && ! grep -q "Duration" "$f" && n=$((n+1)); done; echo $n; }
done_log() { [ -f "$O/$1" ] && grep -q "Duration" "$O/$1"; }
i=0
while [ $i -lt ${#JOBS[@]} ]; do
  log=${JOBS[$i]%%|*}; cmd=${JOBS[$i]#*|}
  after=$(echo "$cmd" | grep -o 'AFTER=[^ ]*' | cut -d= -f2)
  if [ "$(running)" -lt 8 ] && { [ -z "$after" ] || done_log "$after"; }; then
    env ${cmd% *} npx vitest run ${cmd##* } > $O/$log 2>&1 &
    echo "$(date +%H:%M) started $log"; i=$((i+1)); sleep 15
  else sleep 30; fi
done
wait
echo "$(date +%H:%M) all done"
