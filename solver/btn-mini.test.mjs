import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CONFIG,initial,legal,transition,terminal,settlement,deals,pairCombos,buildGame} from './btn-mini-game.js';
import {fastEvaluate7} from './fast-equity.js';
import {evaluate as reference} from './hand-evaluator.js';
import {evaluate,bestResponse,exploitability,solve} from './btn-mini-solver.js';
import './btn-mini-view.js';
const g=buildGame();
const move=(s,kind,to)=>transition(s,{kind,...(to!==undefined?{to}:{})});
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));

test('mini game chance excludes duplicate private ranks and all 5184 physical deals exclude duplicate cards',()=>{
 let count=0;assert.equal(deals().length,24);
 for(const d of deals())for(const a of pairCombos(d[0]))for(const b of pairCombos(d[1]))for(const c of pairCombos(d[2])){assert.equal(new Set([...a,...b,...c,...CONFIG.board]).size,11);count++;}
 assert.equal(count,5184);
 for(let t=0;t<4;t++)for(const h of pairCombos(t)){assert.deepEqual(fastEvaluate7([...h,...CONFIG.board]),reference([...h,...CONFIG.board]));assert.deepEqual(reference([...h,...CONFIG.board]),reference([...CONFIG.hands[t],...CONFIG.board]));}
});
test('BTN has fold/open2/jam30, SB responds with fold/call/3bet7/jam and BB has short all-in cap29',()=>{
 const root=initial();assert.deepEqual(legal(root),[{kind:'fold'},{kind:'raise',to:2},{kind:'allin',to:30}]);
 const sb=move(root,'raise',2);assert.equal(sb.actor,1);assert.deepEqual(legal(sb),[{kind:'fold'},{kind:'call',to:2},{kind:'raise',to:7},{kind:'allin',to:30}]);
 const bb=move(sb,'fold');assert.equal(bb.actor,2);assert.ok(legal(bb).some(a=>a.kind==='allin'&&a.to===29));
 const three=move(sb,'raise',7);assert.ok(legal(three).every(a=>a.kind==='fold'||a.kind==='call'));assert.throws(()=>move(three,'raise',14));
});
test('multiway ante and uncalled-chip settlement use live caps, never give BB the BTN-SB side pot',()=>{
 let s=move(initial(),'allin',30);s=move(s,'call',30);s=move(s,'call',29);assert.ok(terminal(s));
 // BB AA wins the 88BB main pot; SB KK wins the 2BB side pot over BTN QQ.
 const r=settlement(s,[2,1,0]);assert.deepEqual(r.utility,[-30,-28,58]);assert.deepEqual(r.pots.map(x=>x.amount),[88,2]);assert.deepEqual(r.pots[1].eligible,[0,1]);
 let h=move(initial(),'allin',30);h=move(h,'fold');h=move(h,'call',29);
 const u=settlement(h,[2,1,0]);assert.deepEqual(u.utility,[-29,-.5,29.5]);assert.ok(u.pots.some(p=>p.uncalled&&p.amount===1));
 assert.throws(()=>settlement(s,[0,0,1]));
});
test('all legal terminals conserve chips and never force folded/all-in players to act',()=>{
 for(const n of g.nodes){if(n.actor<0){assert.ok(Math.abs(n.utility.reduce((a,b)=>a+b,0))<1e-10);continue;}
  assert.equal(n.state.folded[n.actor],false);assert.ok(30-n.state.ante[n.actor]-n.state.live[n.actor]>0);assert.ok(n.children.length>0);
 }
 let s=move(initial(),'fold');s=move(s,'call',1);s=move(s,'check',1);assert.ok(terminal(s));
});
test('information sets conceal opponents cards and have perfect recall',()=>{
 for(const info of g.infos){assert.equal(info.members.length,6);const own=info.members.map(n=>g.nodes[n].deal[info.player]);assert.ok(own.every(t=>t===info.type));assert.equal(new Set(info.members.map(n=>g.nodes[n].deal.join(','))).size,6);}
 assert.equal(g.infos.length,124);assert.equal(g.nodes.length,1848);
});
test('best response respects information sets and agrees with exhaustive policies in an analytic hidden-state game',()=>{
 // One information set hides which of two terminals is good; clairvoyance would win 1.
 const toy={chanceProbability:.5,roots:[0,3],infos:[{player:0,depth:0,members:[0,3],actions:[{},{}]}],nodes:[{actor:0,info:0,children:[1,2]},{actor:-1,utility:[1,-1,0]},{actor:-1,utility:[-1,1,0]},{actor:0,info:0,children:[4,5]},{actor:-1,utility:[-1,1,0]},{actor:-1,utility:[1,-1,0]}]};
 assert.equal(bestResponse(toy,[[.5,.5]],0).value,0);assert.deepEqual(evaluate(toy,[[.5,.5]]),[0,0,0]);
 for(const p of [0,1,2])assert.ok(bestResponse(g,g.infos.map(i=>i.actions.map(()=>1/i.actions.length)),p).value>=evaluate(g,g.infos.map(i=>i.actions.map(()=>1/i.actions.length)))[p]-1e-12);
});
test('multiplayer trainer does not mark a short unverified run as converged',()=>{
 const r=solve(g,{iterations:2,checkEvery:1,target:1e-12});assert.equal(r.converged,false);assert.ok(r.epsilon>1e-12);
});
test('published reduced-game profile passes exact unilateral best responses and independent LP checks',()=>{
 const candidate=read('./data/btn-mini-candidate.json'),ind=read('./data/btn-mini-independent.json'),r=exploitability(g,candidate.solution.policy);
 assert.ok(r.epsilon<=1e-5);assert.ok(r.gains.every(x=>x<=1e-5));assert.equal(ind.passed,true);assert.equal(ind.physicalDealsAudited,5184);
 for(let p=0;p<3;p++)assert.ok(Math.abs(r.bestResponses[p]-ind.bestResponses[p])<1e-9);
});
test('mini UI never fills the other 165 hands or masquerades as a full MTT solution',()=>{
 const context={};vm.runInNewContext(readFileSync(new URL('./data/btn-mini-strategy.js',import.meta.url),'utf8'),context);const d=context.POKER_LAB_BTN_MINI;
 assert.equal(d.fullMTTGTO,false);for(let p=0;p<3;p++){const v=PokerLabMiniView.view(d,p);assert.ok(v);assert.equal(Object.keys(v.hands).length,4);assert.equal(v.hands.AKs,undefined);}
 assert.equal(PokerLabMiniView.view({...d,scope:'MTT'},0),null);assert.equal(PokerLabMiniView.view({...d,fullMTTGTO:true},0),null);assert.equal(PokerLabMiniView.view({...d,certificate:{...d.certificate,epsilonBB:.01}},0),null);
});


test('finite-game epsilon certificate passes an exact integer comparison, independent of float rounding',()=>{
 const r=read('./data/btn-mini-independent.json').exactRational;
 assert.equal(r.passed,true);assert.ok(BigInt(r.epsilonNumerator)>=0n);assert.ok(BigInt(r.epsilonDenominator)>0n);
 assert.ok(BigInt(r.epsilonNumerator)*100000n<=BigInt(r.epsilonDenominator));
 assert.match(r.strategyDefinition,/normalized exactly/);
});
