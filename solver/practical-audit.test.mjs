import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import './practical-ranges.js';import './practical-reraises.js';import './practical-audit.js';import './data/practical-audit-equities.js';
import{loadExactMatrix,handNames,BOARDS,classCombos}from'./exact-matrix.js';
const p=PokerLabPractical,r=PokerLabReraises,a=PokerLabAudit,data=POKER_LAB_AUDIT_EQUITIES,m=loadExactMatrix(readFileSync(new URL('./data/equity169.bin',import.meta.url)));
test('every 169-class hypothetical range equity is an exact blocker-weighted sum of pinned native counts',()=>{
 assert.equal(a.inspect(data),true);for(const [id,model]of Object.entries(data.models))for(let i=0;i<169;i++){let n=0,w=0;for(const v of model.range){const j=handNames.indexOf(v);n+=m.halfPots[i][j];w+=m.jointWeights[i][j];}assert.deepEqual(model.hands[handNames[i]],{halfPots:n,compatibleDeals:w});assert.ok(n/(2*BOARDS*w)>=0&&n/(2*BOARDS*w)<=1);}
});
test('explicit physical card filtering verifies weights independently, including A/K and pair blockers',()=>{
 const groups=classCombos();for(const [id,model]of Object.entries(data.models))for(const hand of handNames){const i=handNames.indexOf(hand),hero=groups[i][0];let count=0;for(const v of model.range)for(const villain of groups[handNames.indexOf(v)])if(!villain.some(card=>hero.includes(card)))count++;assert.equal(model.hands[hand].compatibleDeals,count*groups[i].length);}
 assert.equal(data.models.value.hands.AKs.compatibleDeals/4,21);assert.equal(data.models.value.hands.QQ.compatibleDeals/6,29);
});
test('all 108 conditional comparisons cover 169 hands and preserve history eligibility and exact EV signs',()=>{
 let count=0;for(let oi=0;oi<8;oi++)for(let ti=oi+1;ti<9;ti++){const before=r.table(p.positions[ti],'vs4bet',p.positions[oi],p.positions[ti],{fourBetAllIn:true});for(const id of Object.keys(a.presets)){count++;const after=a.apply(before,data,id);assert.equal(Object.keys(after.hands).length,169);assert.equal(Object.values(after.stats).reduce((x,y)=>x+y),1326);for(const h of handNames){const row=after.hands[h];assert.equal(row.historyEligible,before.hands[h].historyEligible);if(!row.historyEligible){assert.equal(row.action,null);assert.equal(row.evaluation,null);continue;}const e=row.evaluation;assert.equal(row.action,BigInt(e.evNumerator)>0n?'Call':'Fold');assert.equal(e.requiredEquity,before.money.call.additionalBB/before.money.call.potAfterCallBB);assert.ok(Math.abs(e.callEVBB-(e.equity*before.money.call.potAfterCallBB-before.money.call.additionalBB))<1e-12);assert.equal(row.frequencies,undefined);assert.equal(row.frequency,undefined);assert.ok(['Fold','Call'].includes(row.action));}}
 }
 assert.equal(count,108);
});
test('conditional changes are justified and sensitive to opponent range and exact seat-dependent call price',()=>{
 const utg=r.table('BTN','vs4bet','UTG','BTN',{fourBetAllIn:true}),btn=r.table('BB','vs4bet','BTN','BB',{fourBetAllIn:true}),sb=r.table('BB','vs4bet','SB','BB',{fourBetAllIn:true});
 assert.equal(utg.hands.QQ.action,'Fold');assert.equal(a.apply(utg,data,'value').hands.QQ.action,'Call');assert.equal(a.apply(utg,data,'tight').hands.QQ.action,'Fold');
 assert.equal(btn.hands.AQs.action,'Call');assert.equal(a.apply(btn,data,'value').hands.AQs.action,'Fold');assert.ok(a.evaluate(data,'AQs',btn.money,'value').callEVBB<-4);
 assert.equal(a.apply(btn,data,'value').hands.JJ.action,'Fold');assert.equal(a.apply(sb,data,'value').hands.JJ.action,'Call');
 assert.ok(Math.abs(a.evaluate(data,'QQ',btn.money,'value').equity-.40207)<.00001);
 assert.equal(r.table('BB','vs4bet','BTN','BB',{fourBetAllIn:true}).hands.AQs.action,'Call'); // no mutation of legacy policy
});
test('unknown models, non-all-in decisions and corrupt/incomplete data never substitute an evaluation',()=>{
 const l=r.ledger('BTN','BB',4,true),table=r.table('BB','vs4bet','BTN','BB',{fourBetAllIn:true});
 for(const bad of [null,{}, {...data,matrixSha256:'wrong'},{...data,method:'estimated'},{...data,models:{...data.models,value:{...data.models.value,hands:{}}}}]){assert.equal(a.inspect(bad),false);assert.equal(a.apply(table,bad,'value'),null);}
 assert.equal(a.evaluate(data,'AA',r.ledger('BTN','BB',4),'value'),null);assert.equal(a.evaluate(data,'AA',l,'missing'),null);assert.equal(a.apply(r.table('BTN','vs3bet','BTN','BB'),data,'value'),null);
});
test('audit report records unchanged unconditional reference boundaries and explicit before/after comparisons',()=>{
 const report=JSON.parse(readFileSync(new URL('./data/practical-audit-report.json',import.meta.url)));assert.deepEqual(report.unconditionalRangeChanges,[]);assert.equal(report.comparisons.length,108);assert.equal(report.selfPlayDiagnostics.length,36);assert.ok(report.selfPlayDiagnostics.every(s=>s.differences.length>0));
});
