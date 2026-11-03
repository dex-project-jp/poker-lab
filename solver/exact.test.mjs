import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {allCombos,overlaps,buildEquityBatch} from './equity-matrix.js';
import {classIndex,classCombos,loadExactMatrix,handNames,DEALS} from './exact-matrix.js';
import {prepareGame,evaluateGame} from './game.js';
import {bestResponses} from './best-response.js';
import {solvePushFold} from './nash-iteration.js';
import {evaluate} from './hand-evaluator.js';
import {fastEvaluate7} from './fast-equity.js';
import './hu10-view.js';
const bytes=readFileSync(new URL('./data/equity169.bin',import.meta.url));
const matrix=loadExactMatrix(bytes),model={...matrix,stackBB:10};
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));

test('pinned matrix digest and exact chance weights across ALL 1326 hands',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'9f2a641fbdfde0659533e68e3a38cafde4924d14143f9583978861d3591df40d');
 const combos=allCombos(),indices=combos.map(classIndex),groups=classCombos();let total=0;
 for(let i=0;i<1326;i++){
  const counts=Array(169).fill(0),a=combos[i];
  for(let j=0;j<1326;j++){const b=combos[j];if(a[0]!==b[0]&&a[0]!==b[1]&&a[1]!==b[0]&&a[1]!==b[1])counts[indices[j]]++;}
  assert.equal(counts.reduce((a,b)=>a+b),1225);total+=1225;
  for(let j=0;j<169;j++)assert.equal(counts[j],matrix.jointWeights[indices[i]][j]/groups[indices[i]].length);
 }
 assert.equal(total,DEALS);assert.equal(groups.flat().length,1326);
 assert.equal(groups.filter(g=>g.length===6).length,13);
 assert.equal(groups.filter(g=>g.length===4).length,78);
 assert.equal(groups.filter(g=>g.length===12).length,78);
 // Blockers matter: independent class frequencies would give 24, not 12.
 assert.equal(matrix.jointWeights[handNames.indexOf('AA')][handNames.indexOf('AKs')],12);
});
test('corrupt, partial and non-complementary matrix is rejected',()=>{
 assert.throws(()=>loadExactMatrix(bytes.subarray(1)));
 for(const offset of [0,8,12,16,114260]){const bad=Buffer.from(bytes);bad[offset]^=1;assert.throws(()=>loadExactMatrix(bad));}
});
test('input validation rejects forged cards and case-insensitive duplicates',()=>{
 assert.equal(overlaps(['as','Kh'],['AS','2c']),true);
 assert.throws(()=>overlaps(['as','AS'],['Kh','2c']));
 assert.throws(()=>buildEquityBatch({sbHands:[['as','AS']],bbHands:[['Kh','2c']]}));
 const hand=['As','Kd','Qh','Jc','9s','8d'];
 for(const fn of [evaluate,fastEvaluate7])assert.throws(()=>fn([...hand,{id:0,rank:14,suit:0}]));
});
test('negative probabilities and inconsistent blocker masks are rejected in all APIs',()=>{
 const bad={sbHands:[{probability:-1}],bbHands:[{probability:-1}],equity:[[.5]],stackBB:10,sbShove:[1],bbCall:[1]};
 for(const fn of [solvePushFold,bestResponses])assert.throws(()=>fn(bad));
 const cards={sbHands:[{cards:['As','Ah'],probability:1}],bbHands:[{cards:['As','Kd'],probability:1}],equity:[[.5]],stackBB:10};
 assert.throws(()=>prepareGame(cards));
 assert.throws(()=>prepareGame({...bad,sbHands:[{probability:1}],bbHands:[{probability:1}],jointWeights:[[NaN]]}));
});
test('general nonuniform game agrees with exhaustive pure strategy enumeration',()=>{
 const x={sbHands:[{probability:.2},{probability:.8}],bbHands:[{probability:.7},{probability:.3}],equity:[[.1,.9],[.8,.2]],stackBB:10};
 const game=prepareGame(x),p=[.13,.81],q=[.79,.27],r=evaluateGame(game,p,q);
 function value(p,q){let ev=0;for(let i=0;i<2;i++)for(let j=0;j<2;j++)ev+=x.sbHands[i].probability*x.bbHands[j].probability*((1-p[i])*(-.5)+p[i]*((1-q[j])+q[j]*10*(2*x.equity[i][j]-1)));return ev;}
 const pure=[[0,0],[0,1],[1,0],[1,1]];
 assert.ok(Math.abs(r.value-value(p,q))<1e-12);
 assert.ok(Math.abs(r.sbBestResponse-Math.max(...pure.map(a=>value(a,q))))<1e-12);
 assert.ok(Math.abs(r.bbBestResponse+Math.min(...pure.map(a=>value(p,a))))<1e-12);
 assert.ok(Math.abs(r.nashGap-2*r.exploitability)<1e-12);
});
test('CFR+ converges in mixed analytic game, independently derived frequencies',()=>{
 // One weak SB type: showdown -6; equilibrium BB calls 1.5/7.
 // One strong SB type: showdown +6, always shoves. Equal type weights.
 // BB indifference: pWeak*7 + 1*(-5)=0, so weak shoves 5/7.
 const x={sbHands:[{probability:.5},{probability:.5}],bbHands:[{probability:1}],equity:[[.2],[.8]],stackBB:10};
 const r=solvePushFold({...x,iterations:1000000,targetGap:1e-5,checkEvery:100});
 assert.ok(r.converged);assert.ok(Math.abs(r.sbShove[0]-5/7)<.001);assert.ok(Math.abs(r.bbCall[0]-1.5/7)<.001);assert.ok(r.sbShove[1]>.999);
 assert.equal(r.verified,false);
});
test('full 10BB LP strategy has tiny best-response gains and CFR+ independently converges',()=>{
 const lp=read('./data/independent-lp.json'),r=evaluateGame(prepareGame(model),lp.sbShove,lp.bbCall);
 assert.ok(r.nashGap<1e-10);assert.ok(Math.abs(r.value-(-.04537075259279144))<1e-12);
 const cfr=solvePushFold({...model,iterations:200000,targetGap:1e-8,checkEvery:100});
 assert.ok(cfr.converged);assert.ok(Math.abs(cfr.value-r.value)<1e-8);
 assert.ok(Math.max(...cfr.sbShove.map((v,i)=>Math.abs(v-lp.sbShove[i])),...cfr.bbCall.map((v,i)=>Math.abs(v-lp.bbCall[i])))<.001);
 assert.ok(cfr.history[0].nashGap>cfr.nashGap*100);
});
test('selected independent HoldemResources No Ante thresholds agree at 10BB',()=>{
 // Source: https://www.holdemresources.net/hune (2026-11-03).
 // Simplified threshold chart is qualitative only; it cannot validate mixed frequencies.
 const lp=read('./data/independent-lp.json');
 for(const [h,p,q] of [['AA',1,1],['K2s',1,1],['Q2s',1,0],['Q6o',0,0],['J2s',0,0],['J3s',1,0],['72o',0,0],['K5o',1,1],['Q9o',1,1],['Q8o',1,0]]){
  const i=handNames.indexOf(h);assert.ok(Math.abs(lp.sbShove[i]-p)<1e-6,h+' shove');assert.ok(Math.abs(lp.bbCall[i]-q)<1e-6,h+' call');
 }
});
test('UI only matches exact supported game; invalid frequencies never display',()=>{
 const data={verified:true,model:'chipEV',players:2,hero:'BTN/SB',villain:'BB',heroBB:10,villainBB:10,ante:'なし',scenario:'open',game:{variant:'NLHE',model:'chipEV',players:2,stackBB:10,sbBlind:.5,bbBlind:1,ante:0,rake:0,actions:{SB:['shove','fold'],BB:['call','fold']}},certificate:{nashGap:1e-12}};
 const spot={model:'chipEV',players:2,hero:'BTN/SB',villain:'BB',heroBB:10,villainBB:10,ante:'なし',scenario:'open'};
 assert.ok(PokerLabView.match(data,spot));
 for(const [key,value] of [['players',9],['heroBB',9.5],['ante','BBアンティ'],['scenario','vsopen'],['hero','BB'],['model','ICM']])assert.equal(PokerLabView.match(data,{...spot,[key]:value}),false);
 assert.equal(PokerLabView.match({...data,verified:false},spot),false);
 assert.equal(PokerLabView.match({...data,certificate:{nashGap:.01}},spot),false);
 const f={'All-in':50,Raise:0,Call:0,Check:0,Fold:50};
 assert.deepEqual(PokerLabView.frequencies({hands:{AA:f}},'AA'),f);
 for(const bad of [{...f,Fold:49.9},{...f,Call:NaN},{...f,Raise:-1}])assert.equal(PokerLabView.frequencies({hands:{AA:bad}},'AA'),null);
});

test('independent LP satisfies action optimality for every one of the 169 classes',()=>{
 const lp=read('./data/independent-lp.json'),r=bestResponses({...model,sbShove:lp.sbShove,bbCall:lp.bbCall});
 for(const [strategy,ev] of [[lp.sbShove,r.sbEV],[lp.bbCall,r.bbEV]])for(let i=0;i<169;i++){
  const p=strategy[i],d=ev[i].advantage;
  if(p>1e-9)assert.ok(d>=-1e-10,handNames[i]+' active action inferior');
  if(p<1-1e-9)assert.ok(d<=1e-10,handNames[i]+' fold inferior');
 }
});

test('NaN, malformed dimensions, illegal chance entries and bad solver controls fail closed',()=>{
 const x={sbHands:[{probability:1}],bbHands:[{probability:1}],equity:[[.5]],stackBB:10};
 for(const extra of [{equity:[[NaN]]},{equity:[[]]},{equity:[[undefined]]},{jointWeights:[[-1]]},{jointWeights:[[Infinity]]},{jointWeights:[[0]]},{stackBB:Infinity},{stackBB:NaN},{iterations:0},{iterations:1.5},{checkEvery:0},{targetGap:NaN}])assert.throws(()=>solvePushFold({...x,...extra}));
 for(const p of [NaN,-.1,1.1])assert.throws(()=>evaluateGame(prepareGame(x),[p],[.5]));
});
