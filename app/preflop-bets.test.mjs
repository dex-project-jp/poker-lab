import test from'node:test';import assert from'node:assert/strict';
import './preflop-bets.js';import '../solver/practical-ranges.js';import '../solver/practical-reraises.js';
const b=PokerLabBets,r=PokerLabReraises,positions=b.positions;
const base=(over={})=>({scenario:'vs4bet',hero:'BB',opener:'BTN',bettor:'BB',stacks:Object.fromEntries(positions.map(p=>[p,30])),ante:{type:'big-blind',amountBB:1},openTo:2,threeTo:7,fourTo:14,...over});
test('baseline money agrees with existing fixed-ledger implementation for all 108 histories',()=>{
 for(let oi=0;oi<8;oi++)for(let ti=oi+1;ti<9;ti++)for(const [scenario,jam]of [['vs3bet',false],['vs4bet',false],['vs4bet',true]]){
 const o=positions[oi],t=positions[ti],d=b.defaults(o,t),input=base({scenario,hero:scenario==='vs3bet'?o:t,opener:o,bettor:t,openTo:d.openTo,threeTo:d.threeTo,fourTo:jam?30:14,fourBetAllIn:jam}),v=b.calculate(input),l=r.ledger(o,t,scenario==='vs3bet'?3:4,jam);
 assert.equal(v.ok,true);assert.equal(v.potBeforeActionBB,l.potBeforeActionBB);assert.equal(v.heroRemainingBB,l.remainingBB[v.hero]);assert.equal(v.call.additionalBB,l.call.additionalBB);assert.equal(v.call.uncalledReturnBB,l.call.uncalledReturnBB);assert.equal(v.call.potAfterCallBB,l.call.potAfterCallBB);assert.equal(v.minimumRaiseToBB,l.minimumRaiseToBB);assert.equal(b.matchesReference(input,v),true);
 }
});
test('arbitrary sizes recalculate pot, sunk chips, minimum increment and remaining chips without claiming ranges',()=>{
 const input=base({openTo:2.2,threeTo:7.5,fourTo:16}),v=b.calculate(input);assert.equal(v.ok,true);assert.equal(v.potBeforeActionBB,25);assert.equal(v.heroRemainingBB,21.5);assert.equal(v.call.additionalBB,8.5);assert.equal(v.call.potAfterCallBB,33.5);assert.equal(v.call.remainingBB,13);assert.equal(v.minimumRaiseToBB,24.5);assert.equal(b.matchesReference(input,v),false);
 assert.equal(Object.values(v.remainingBB).reduce((a,b)=>a+b)+Object.values(v.contributionsBB).reduce((a,b)=>a+b),270);
});
test('open and single-open projections distinguish before-action pot from proposed raise pot',()=>{
 const open=b.calculate(base({scenario:'open',hero:'BTN',openTo:2.2}));assert.equal(open.potBeforeActionBB,2.5);assert.equal(open.projection.additionalBB,2.2);assert.equal(open.projection.potAfterBB,4.7);assert.equal(open.projection.remainingBB,27.8);assert.equal(open.minimumRaiseToBB,2);
 const v=b.calculate(base({scenario:'vsopen',hero:'BB',opener:'BTN',openTo:2.5,threeTo:8}));assert.equal(v.potBeforeActionBB,5);assert.equal(v.call.additionalBB,1.5);assert.equal(v.minimumRaiseToBB,4);assert.equal(v.projection.additionalBB,7);assert.equal(v.projection.potAfterBB,12);
 const walk=b.calculate(base({scenario:'open',hero:'BB'}));assert.equal(walk.walk,true);assert.equal(walk.projection,null);
});
test('all-ins apply ante live caps, short raises do not reopen, and only-short-all-in situations are explicit',()=>{
 const v=b.calculate(base({fourTo:30,fourBetAllIn:true}));assert.equal(v.opponentAllIn,true);assert.equal(v.canRaise,false);assert.equal(v.call.additionalBB,22);assert.equal(v.call.uncalledReturnBB,1);assert.equal(v.call.potAfterCallBB,59.5);assert.equal(v.call.remainingBB,0);
 const short=b.calculate(base({scenario:'vs3bet',hero:'BTN',threeTo:2.5,stacks:{...base().stacks,BB:3.5}}));assert.equal(short.ok,true);assert.equal(short.shortAllIn,true);assert.equal(short.canRaise,false);assert.equal(short.projection,null);assert.equal(short.call.additionalBB,.5);
 const invalid=b.calculate(base({fourTo:3,threeTo:2.5,stacks:{...base().stacks,BB:3.5}}));assert.equal(invalid.ok,false);
 const only=b.calculate(base({fourTo:28}));assert.equal(only.canRaise,true);assert.equal(only.onlyShortAllIn,true);assert.equal(only.minimumRaiseToBB,49);assert.equal(only.heroLiveCapBB,29);
});
test('invalid precision, stack excess and minimum violations fail closed with no stale numeric output',()=>{
 for(const over of [{openTo:1.9},{threeTo:2.5},{fourTo:11},{fourTo:31},{openTo:NaN},{threeTo:7.001},{hero:'UTG'},{bettor:'CO',opener:'BTN'},{stacks:{...base().stacks,BB:.5}}])assert.equal(b.calculate(base(over)).ok,false,JSON.stringify(over));
 const tooSmall=b.calculate(base({scenario:'open',hero:'BTN',openTo:1.9}));assert.equal(tooSmall.ok,true);assert.ok(tooSmall.projectionError);assert.equal(b.matchesReference(base({scenario:'open',hero:'BTN',openTo:1.9}),tooSmall),false);
});
test('per-player and no ante accounting remain distinct, and impossible hero roles are excluded',()=>{
 const none=b.calculate(base({ante:{type:'none',amountBB:0}}));assert.equal(none.postedPotBB,1.5);assert.equal(none.heroLiveCapBB,30);
 const per=b.calculate(base({ante:{type:'per-player',amountBB:.1}}));assert.equal(per.postedPotBB,2.4);assert.equal(per.heroLiveCapBB,29.9);
 assert.ok(!b.allowedHeroes('vsopen').includes('UTG'));assert.ok(!b.allowedHeroes('vs3bet').includes('BB'));assert.ok(!b.allowedHeroes('vs4bet').includes('UTG'));assert.deepEqual(b.allowedHeroes('cold4bet').slice(0,1),['UTG+2']);
});
