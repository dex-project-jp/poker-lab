import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadExactMatrix,handNames} from './exact-matrix.js';
import {prepareGame,evaluateGame} from './game.js';
import {bestResponses} from './best-response.js';
import {payoff} from './pushfold-kernel.js';
import './hu10-view.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const matrix=loadExactMatrix(readFileSync(new URL('./data/equity169.bin',import.meta.url)));
const lps=read('./data/independent-hu.json').solutions;
const spot=(heroBB,villainBB,role='SB')=>({heroBB,villainBB,model:'chipEV',players:2,ante:'なし',hero:role==='SB'?'BTN/SB':'BB',villain:role==='SB'?'BB':'BTN/SB',scenario:role==='SB'?'open':'vsshove'});
const context={};vm.runInNewContext(readFileSync(new URL('./data/hu-strategies.js',import.meta.url),'utf8'),context);const data=context.POKER_LAB_DATASETS;

test('all sixteen 5..20BB LP solutions satisfy equilibrium and per-hand optimality',()=>{
 assert.deepEqual(lps.map(x=>x.stackBB),Array.from({length:16},(_,i)=>i+5));
 for(const lp of lps){
  const model={...matrix,stackBB:lp.stackBB},e=evaluateGame(prepareGame(model),lp.sbShove,lp.bbCall);
  assert.ok(e.nashGap<1e-10,`${lp.stackBB}BB gap ${e.nashGap}`);
  assert.ok(Math.abs(lp.lowerBound-lp.upperBound)<1e-10);
  assert.ok(Math.abs(e.value-lp.lowerBound)<1e-10);
  const best=bestResponses({...model,sbShove:lp.sbShove,bbCall:lp.bbCall});
  for(const [p,ev] of [[lp.sbShove,best.sbEV],[lp.bbCall,best.bbEV]])for(let i=0;i<169;i++){
   if(p[i]>1e-9)assert.ok(ev[i].advantage>=-1e-10,`${lp.stackBB}BB ${handNames[i]}`);
   if(p[i]<1-1e-9)assert.ok(ev[i].advantage<=1e-10,`${lp.stackBB}BB ${handNames[i]}`);
  }
 }
});
test('generated UI has 32 complete role/stack datasets, exact LP frequencies, no gaps or duplicates',()=>{
 assert.equal(data.length,32);const keys=new Set();
 for(const d of data){
  const key=d.game.stackBB+'/'+d.hero;assert.ok(!keys.has(key));keys.add(key);
  const lp=lps.find(l=>l.stackBB===d.game.stackBB);assert.equal(Object.keys(d.hands).length,169);
  for(let i=0;i<169;i++){const f=PokerLabView.frequencies(d,handNames[i]);assert.ok(f);const p=d.hero==='BB'?lp.bbCall[i]:lp.sbShove[i];assert.equal(f[d.hero==='BB'?'Call':'All-in'],p*100);assert.equal(f.Fold,100-p*100);}
 }
});
test('every supported effective stack matches equal and unequal stacks for both roles',()=>{
 for(let S=5;S<=20;S++)for(const role of ['SB','BB'])for(const [a,b] of [[S,S],[S,500],[500,S],[S,S+.5]]){
  const matches=data.filter(d=>PokerLabView.match(d,spot(a,b,role)));assert.equal(matches.length,1);assert.equal(matches[0].game.stackBB,S);
 }
});
test('unsupported fractional stacks are never rounded or interpolated; invalid inputs fail closed',()=>{
 for(const [a,b] of [[4,20],[21,500],[8.5,20],[5.5,6],[0,10],[NaN,10],[Infinity,10],[null,10],[10,501],['10',20]])assert.equal(data.some(d=>PokerLabView.match(d,spot(a,b))),false,`${a}/${b}`);
 for(const extra of [{players:9},{ante:'BBアンティ'},{model:'ICM'},{scenario:'vsopen'},{hero:'BTN'}])assert.equal(data.some(d=>PokerLabView.match(d,{...spot(8,20),...extra})),false);
});
test('effective stack equivalence follows explicit pot accounting with uncalled chips returned',()=>{
 // Derive net chip changes directly from both original stacks and the contested pot.
 for(const SB of [5,8,10,20,100])for(const BB of [5,8,10,20,100])for(const equity of [0,.23,.5,.77,1]){
  const S=Math.min(SB,BB),p=payoff({stackBB:S,equity});
  const returnedSB=SB-S,returnedBB=BB-S;
  const sbNet=returnedSB+equity*(2*S)-SB,bbNet=returnedBB+(1-equity)*(2*S)-BB;
  assert.ok(Math.abs(sbNet-p.sbShoveBbCall)<1e-12);
  assert.ok(Math.abs(bbNet-p.bbCallVsShove)<1e-12);
  assert.ok(Math.abs(sbNet+bbNet)<1e-12);
  assert.equal(p.sbFold,-.5);assert.equal(p.sbShoveBbFold,1);
 }
});
test('all stack certificates record actual independent convergence and numerical tolerances',()=>{
 const r=read('./data/hu-range-validation.json');assert.equal(r.verified,true);assert.equal(r.solutions.length,16);
 for(const s of r.solutions){assert.equal(s.verified,true);assert.ok(s.nashGap<=r.tolerances.publishedNashGap);assert.ok(s.cfr.nashGap<=r.tolerances.cfrNashGap);assert.ok(s.independent.maxFrequencyDifference<=r.tolerances.maxFrequencyDifference);assert.ok(s.independent.valueDifferenceBB<=r.tolerances.valueDifferenceBB);}
});
