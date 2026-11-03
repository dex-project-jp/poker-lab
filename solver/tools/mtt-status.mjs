// Records exactly what is available. Null is uncomputed, never a Fold/0% guess.
import '../mtt-model.js';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const m=globalThis.PokerLabMTT,context={},game=m.defaults();
vm.runInNewContext(readFileSync(new URL('../data/mtt-ranges.js',import.meta.url),'utf8'),context);
const datasets=context.POKER_LAB_MTT_DATASETS;
for(const d of datasets)if(!m.inspect(d,game,d.node?.hero).ok)throw Error('Unverified MTT dataset in release registry');
const positions=m.positions.map(hero=>{const state=m.status(game,hero,datasets);return {hero,node:m.node(hero),status:state.state,raiseToBB:hero==='BB'?null:hero==='SB'?game.sbRaiseToBB:game.openRaiseToBB,frequencies:state.dataset?.hands??null};});
const report={schemaVersion:1,priority:'9-max MTT 30BB opens',game,posting:m.posting(game),positions,numericalRangesPublished:positions.some(p=>p.status==='verified'),implementation:'Configuration, open nodes, exact-condition matching, structural validation and UI only. No multiway solver implemented.',blockers:['No independently validated full-game 9-max 30BB strategy dataset with redistribution rights.','Existing HU push/fold solver cannot solve normal opens and postflop continuations.'],additionalFeesIncurred:false};
writeFileSync(new URL('../data/mtt30-status.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({positions:positions.length,openNodes:positions.filter(p=>p.node).length,published:report.numericalRangesPublished}));
