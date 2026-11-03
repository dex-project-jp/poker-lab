import '../practical-ranges.js';import '../practical-reraises.js';import '../practical-audit.js';
import {readFileSync,writeFileSync} from 'node:fs';import {createHash}from'node:crypto';
import {loadExactMatrix,handNames,BOARDS}from'../exact-matrix.js';
const p=PokerLabPractical,r=PokerLabReraises,a=PokerLabAudit;
const bytes=readFileSync(new URL('../data/equity169.bin',import.meta.url)),hash=createHash('sha256').update(bytes).digest('hex');if(hash!==a.matrixSha256)throw Error('Matrix digest mismatch');const m=loadExactMatrix(bytes);
const models={};for(const [id,model]of Object.entries(a.presets)){
 const range=[...p.expand(model.notation)],hands={};for(let i=0;i<169;i++){
  let halfPots=0,compatibleDeals=0;for(const h of range){const j=handNames.indexOf(h);halfPots+=m.halfPots[i][j];compatibleDeals+=m.jointWeights[i][j];}hands[handNames[i]]={halfPots,compatibleDeals};
 }models[id]={notation:model.notation,range,hands};
}
const data={schema:1,matrixSha256:hash,method:'exact-blocker-weighted-showdown',boardsPerMatchup:BOARDS,rangeAssumption:'Every compatible physical opponent combo in the named hypothetical range has equal weight; hero class suit symmetric; dead cards/fold info not inferred',gtoVerified:false,models};
if(!a.inspect(data))throw Error('Invalid generated audit data');
const compact=e=>({action:e.action,equity:e.equity,requiredEquity:e.requiredEquity,callEVBB:e.callEVBB,evNumerator:e.evNumerator,evDenominator:e.evDenominator});
const comparisons=[],selfPlayDiagnostics=[],boundaryHands=['A2s','A5s','A9s','22','44','55','66','KQo','KJs','QJs','QQ','JJ','AKo','AQs'];
for(let oi=0;oi<8;oi++)for(let ti=oi+1;ti<9;ti++){
 const o=p.positions[oi],t=p.positions[ti],legacy=r.table(t,'vs4bet',o,t,{fourBetAllIn:true});
 for(const id of Object.keys(models)){const changed=a.apply(legacy,data,id);comparisons.push({opener:o,hero:t,model:id,pot:legacy.money.call.potAfterCallBB,cost:legacy.money.call.additionalBB,requiredEquity:legacy.money.call.rawEquityThreshold,changes:p.hands.filter(h=>legacy.hands[h].action!==changed.hands[h].action).map(h=>({hand:h,before:legacy.hands[h].action,after:changed.hands[h].action,...compact(changed.hands[h].evaluation)})),boundary:boundaryHands.filter(h=>legacy.hands[h].historyEligible).map(h=>({hand:h,referenceAction:legacy.hands[h].action,...compact(changed.hands[h].evaluation)}))});}
 // Diagnostic only: what if the opponent mechanically follows our reference 4bet jam branch?
 const jamRange=p.hands.filter(h=>r.table(o,'vs3bet',o,t).hands[h].action==='4-bet All-in');
 const differences=[];for(let i=0;i<169;i++){const h=handNames[i];if(!legacy.hands[h].historyEligible)continue;let n=0,w=0;for(const v of jamRange){const j=handNames.indexOf(v);n+=m.halfPots[i][j];w+=m.jointWeights[i][j];}if(!w)continue;const eq=n/(2*BOARDS*w),ev=eq*legacy.money.call.potAfterCallBB-legacy.money.call.additionalBB;if((ev>0?'Call':'Fold')!==legacy.hands[h].action)differences.push({hand:h,reference:legacy.hands[h].action,conditionalBest:ev>0?'Call':'Fold',equity:eq,callEVBB:ev});}
 selfPlayDiagnostics.push({opener:o,hero:t,assumedOpponentJamHands:jamRange,differences,meaning:'Fixed reference-policy response diagnostic only; not a Nash/exploitability certificate'});
}
const coverage={openPositions:8,singleOpenSpots:36,vs3betSpots:36,vs4betSpots:36,vs4betAllInSpots:36,handsPerTable:169};
const report={schema:1,baselineCommit:'221696889db54130a671992a4ec6371fdf7f16ff',matrixSha256:hash,coverage,unconditionalRangeChanges:[],reason:'No unseen-opponent or postflop optimum can be established from raw equity alone. Existing reference boundaries retained; hypothetical all-in comparisons are explicit opt-in.',referenceSourceSha256:Object.fromEntries(['practical-ranges.js','practical-reraises.js'].map(f=>[f,createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex')])),comparisons,selfPlayDiagnostics};
const files=[['practical-audit-equities.js','// Generated exact equity counts for explicit hypothetical ranges; no GTO frequencies.\nglobalThis.POKER_LAB_AUDIT_EQUITIES='+JSON.stringify(data)+';\n'],['practical-audit-report.json',JSON.stringify(report,null,2)+'\n']];
for(const [name,content]of files){const path=new URL('../data/'+name,import.meta.url);if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==content)throw Error('Stale '+name);}else writeFileSync(path,content);}
console.log({coverage,conditionalComparisons:comparisons.length,changedComparisons:comparisons.filter(x=>x.changes.length).length,selfPlayMismatches:selfPlayDiagnostics.filter(x=>x.differences.length).length,unconditionalRangeChanges:0});
