import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{CONFIG,SEATS,LABELS,worlds,pairCombos,initial,legal,transition,terminal,settlement,buildGame}from'./mtt10-game.js';
import{distribute,showdown}from'./multiplayer-pots.js';import*as multi from'./multiplayer-solver.js';import*as old from'./btn-mini-solver.js';import{buildGame as oldGame}from'./btn-mini-game.js';
import{handNames,classCombos}from'./exact-matrix.js';import'./mtt10-view.js';import'./data/mtt10-strategy.js';import'./mtt-model.js';
const g=buildGame(),candidate=JSON.parse(readFileSync(new URL('./data/mtt10-candidate.json',import.meta.url))),ind=JSON.parse(readFileSync(new URL('./data/mtt10-independent.json',import.meta.url))),data=POKER_LAB_MTT10_LAB,view=PokerLabTenView;
const spot={players:9,stacks:Object.fromEntries(SEATS.map(p=>[p,10])),anteType:'big-blind',anteBB:1,openTo:2,sbOpenTo:2.5};
test('nine players post correct live blinds and dead ante; legal actions include overcalls but never reopen betting',()=>{
 let s=initial();assert.equal(s.live.reduce((a,b)=>a+b)+s.ante.reduce((a,b)=>a+b),2.5);assert.equal(s.stacks[7]-s.live[7],9.5);assert.equal(s.stacks[8]-s.live[8]-s.ante[8],8);
 assert.deepEqual(legal(s),[{kind:'fold'},{kind:'allin',to:10}]);s=transition(s,{kind:'allin',to:10});assert.deepEqual(legal(s),[{kind:'fold'},{kind:'call',to:10}]);s=transition(s,{kind:'call',to:10});assert.equal(s.actor,2);assert.equal(legal(s)[1].kind,'call');
 for(let p=2;p<8;p++)s=transition(s,{kind:'fold'});assert.deepEqual(legal(s),[{kind:'fold'},{kind:'call',to:9}]);s=transition(s,{kind:'call',to:9});assert.ok(terminal(s));assert.throws(()=>transition(s,{kind:'call',to:10}));
 let walk=initial();for(let p=0;p<8;p++)walk=transition(walk,{kind:'fold'});assert.ok(terminal(walk));assert.equal(walk.folded[8],false);assert.deepEqual(legal(walk),[]);assert.throws(()=>transition(initial(),{kind:'raise',to:2}));
});
test('physical card exclusion and suit reduction are exact for the stated restricted distribution, not full 1326-hand chance',()=>{
 assert.equal(handNames.length,169);assert.equal(classCombos().flat().length,1326);assert.equal(worlds().length,10);assert.equal(10*6**9,100776960);
 for(const d of worlds()){assert.equal(new Set(d).size,9);for(let p=0;p<9;p++){assert.equal(pairCombos(d[p]).length,6);for(const h of pairCombos(d[p])){assert.ok(h.every(c=>!CONFIG.board.includes(c)));for(let q=0;q<p;q++)for(const v of pairCombos(d[q]))assert.ok(h.every(c=>!v.includes(c)));}}}
 assert.equal(g.roots.length,18);assert.equal(g.roots.filter(n=>g.nodes[n].deal[0]===9).length,9);
});
test('all 18378 compiled nodes conserve chips; every actor acts once, terminal active hands remain and infos hide opponents',()=>{
 assert.equal(g.nodes.length,18378);assert.equal(g.infos.length,1020);
 for(const n of g.nodes){assert.equal(new Set(n.state.history.map(a=>a.seat)).size,n.state.history.length);if(n.actor<0){assert.ok(Math.abs(n.utility.reduce((a,b)=>a+b))<1e-9);const pay=settlement(n.state,n.deal);assert.ok(pay.awards.every(x=>x>=0));}else{assert.equal(n.state.folded[n.actor],false);assert.ok(n.actor<9);}}
 assert.ok(g.infos.some(i=>new Set(i.members.map(n=>JSON.stringify(g.nodes[n].deal))).size>1));for(const info of g.infos)for(const n of info.members){assert.equal(g.nodes[n].actor,info.player);assert.equal(g.nodes[n].deal[info.player],info.type);assert.deepEqual(g.nodes[n].state.history,info.history);assert.equal(info.parentSequence,null);}
});
test('multiway main/side pots exclude the short BB from the side pot, with uncalled returns and board ties',()=>{
 const live=[10,10,0,0,0,0,0,.5,9],ante=[0,0,0,0,0,0,0,0,1],folded=SEATS.map((_,p)=>![0,1,8].includes(p)),scores=SEATS.map((_,p)=>[6,2,p===8?14:p===0?13:12]);
 const r=distribute({live,ante,folded},scores);assert.equal(r.awards[8],28.5);assert.equal(r.awards[0],2);assert.ok(r.pots.some(p=>p.amount===2&&!p.eligible.includes(8)));assert.equal(r.refunds.reduce((a,b)=>a+b),0);
 const one=distribute({live:[10,0,0,0,0,0,0,.5,9],ante,folded:SEATS.map((_,p)=>![0,8].includes(p))},scores);assert.equal(one.refunds[0],1);assert.equal(one.awards[8],19.5);
 const board=['Ah','Kh','Qh','Jh','Th'],deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)).filter(c=>!board.includes(c)),hands=SEATS.map((_,p)=>deck.slice(2*p,2*p+2));
 const tied=showdown({live:SEATS.map((_,p)=>p===8?9:10),ante,folded:Array(9).fill(false)},hands,board);assert.ok(Math.abs(tied.awards.reduce((a,b)=>a+b)-90)<1e-9);assert.ok(tied.pots.some(p=>p.winners.length===9));hands[1][0]=hands[0][0];assert.throws(()=>showdown({live,ante,folded},hands,board));
});
test('generic N-player evaluation and BR agree with the independently retained three-player implementation',()=>{
 const mini=oldGame(),p=JSON.parse(readFileSync(new URL('./data/btn-mini-candidate.json',import.meta.url))).solution.policy,n={...mini,players:3};assert.deepEqual(multi.evaluate(n,p),old.evaluate(mini,p));for(let i=0;i<3;i++)assert.equal(multi.bestResponse(n,p,i).value,old.bestResponse(mini,p,i).value);
 assert.throws(()=>multi.evaluate({...g,players:0},candidate.policy));assert.throws(()=>multi.bestResponse(g,candidate.policy,9));
});
test('published approximate profile has actual mixed probabilities and independently rational-bounded nine-player deviation gains',()=>{
 const e=multi.exploitability(g,candidate.policy);assert.ok(e.epsilon<.002&&e.epsilon>1e-5);assert.equal(candidate.search.targetReached,false);assert.ok(candidate.policy.some(row=>row.every(x=>x>0&&x<1)));assert.equal(e.gains.length,9);
 for(let p=0;p<9;p++)assert.ok(Math.abs(e.bestResponses[p]-ind.bestResponses[p])<1e-9);const q=ind.exactRational;assert.ok(BigInt(q.epsilonNumerator)*500n<=BigInt(q.epsilonDenominator));assert.equal(data.quality,'approximate-computation');assert.equal(data.fullMTTGTO,false);
});
test('lab views never populate the remaining 167 hands; ordinary 10BB MTT stays uncomputed and conditions fail closed',()=>{
 const v=view.view(data,spot,0,'open');assert.deepEqual(Object.keys(v.hands).sort(),['55','AA']);assert.ok(v.hands.AA.frequencies);assert.equal(v.hands.AKs,undefined);assert.equal(view.view(data,spot,8,'open').state,'walk');
 for(const s of [{...spot,players:2},{...spot,anteBB:.5},{...spot,stacks:{...spot.stacks,BB:11}},{...spot,openTo:2.2}])assert.equal(view.view(data,s,0,'open'),null);
 for(const bad of [{...data,fullMTTGTO:true},{...data,config:{...data.config,rake:1}},{...data,certificate:{...data.certificate,epsilonNumerator:'1',epsilonDenominator:'1'}}])assert.equal(view.view(bad,spot,0,'open'),null);
 assert.equal(PokerLabMTT.status(PokerLabMTT.defaults(10),'BTN',[]).state,'unsupported');assert.equal(view.history(0,'vsshove',1),null);assert.equal(view.history(8,'vsshove',5,4),null);
});
test('UI ledger distinguishes single-caller refund from a genuine overcall side pot',()=>{
 const single=view.view(data,spot,8,'vsshove',0),over=view.view(data,spot,8,'vsshove',0,1);assert.equal(single.money.additionalCallBB,8);assert.equal(single.money.uncalledReturnBB,1);assert.equal(single.money.callPotBB,19.5);
 assert.equal(over.money.uncalledReturnBB,0);assert.equal(over.money.callPotBB,30.5);
});
