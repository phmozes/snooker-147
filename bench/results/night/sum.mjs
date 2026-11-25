// prints one short line per level from natural.test.ts OUT json files
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  let j; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { console.log(f, 'missing'); continue; }
  for (const [l, r] of Object.entries(j)) {
    const p = r.position, pr = r.pace;
    console.log(`${f.split('/').pop()} ${l}: nat ${r.natural} exh ${r.exhibition} RR ${r.reRacks} | behind ${p.blackFromBehind} baulkC ${p.redsBaulkCorner} (fromBlackHalf ${p.redsBaulkCornerFromBlackHalf}) cutMed ${p.cutMedian} cut>50 ${p.cutsOver50} | med ${r.median.toFixed(2)} <=2.5 ${r.within25}% >3.5 ${r.over35all} (notLast red ${pr.red.over35} col ${pr.colour.over35}) | ms p90 ${r.solveMsP90} max ${r.solveMsMax} || 4.9 redCut med ${p.redCutMedian} >35 ${p.redCutsOver35}% far ${p.redsFarFromBlackHalf}% side ${p.redsNearSideCushion}% comfyCol ${p.colourAfterRedComfy}% tried med ${p.triedMedian} max ${p.triedMax}`);
  }
}
