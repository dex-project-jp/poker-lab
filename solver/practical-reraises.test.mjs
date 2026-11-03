import test from 'node:test';
import assert from 'node:assert/strict';
import './practical-ranges.js';
import './practical-reraises.js';
const p=globalThis.PokerLabPractical,r=globalThis.PokerLabReraises;
const pairs=[];for(let oi=0;oi<8;oi++)for(let ti=oi+1;ti<9;ti++)pairs.push([p.positions[oi],p.positions[ti]]);
// Independent chip debit ledger across all nine seats, not the production dead-money formula.
function debitLedger(opener,bettor,stage,jam=false){
 const stack=Object.fromEntries(p.positions.map(x=>[x,30])),live=Object.fromEntries(p.positions.map(x=>[x,0]));let pot=0;
 const pay=(seat,n)=>{assert.ok(n>=0&&n<=stack[seat]);stack[seat]-=n;pot+=n;};
 pay('BB',1);pay('BB',1);live.BB=1;pay('SB',.5);live.SB=.5;
 const bet=(seat,to)=>{pay(seat,to-live[seat]);live[seat]=to;};
 bet(opener,opener==='SB'?2.5:2);bet(bettor,opener==='SB'?8:['SB','BB'].includes(bettor)?7:6);
 if(stage===4)bet(opener,jam?30:14);
 return {stack,live,pot,pay,bet};
}
test('all role selectors enforce order, self-opener vs3bet, self-3bettor vs4bet and separate cold4bet',()=>{
 let n3=0,n4=0;for(const hero of p.positions){const a=r.roles(hero,'vs3bet'),b=r.roles(hero,'vs4bet');n3+=a.threeBettors.length;n4+=b.openers.length;for(const o of a.openers)assert.equal(o,hero);for(const t of b.threeBettors)assert.equal(t,hero);
 for(const o of r.roles(hero,'cold4bet').openers)for(const t of r.roles(hero,'cold4bet',o).threeBettors){assert.ok(p.positions.indexOf(o)<p.positions.indexOf(t));assert.ok(p.positions.indexOf(t)<p.positions.indexOf(hero));assert.equal(r.table(hero,'cold4bet',o,t),null);}}
 assert.equal(n3,36);assert.equal(n4,36);assert.deepEqual(r.roles('MP','vs3bet'),r.roles('UTG+2','vs3bet'));
 for(const args of [['BTN','vs3bet','CO','BB'],['BTN','vs3bet','BTN','CO'],['BB','vs3bet','BB','SB'],['UTG','vs4bet','BTN','UTG'],['BTN','vs4bet','CO','BB'],['?','vs4bet','CO','BB']])assert.equal(r.table(...args),null);
});
test('108 response tables classify all 169 hands / 1326 combos; reference rows carry no made-up numeric performance',()=>{
 let count=0;for(const [o,t]of pairs)for(const [hero,scenario,jam]of [[o,'vs3bet',false],[t,'vs4bet',false],[t,'vs4bet',true]]){
  const table=r.table(hero,scenario,o,t,{fourBetAllIn:jam});count++;assert.equal(Object.keys(table.hands).length,169);assert.equal(Object.values(table.stats).reduce((a,b)=>a+b),1326);
  for(const [h,row]of Object.entries(table.hands)){
   assert.equal(row.historyEligible,(scenario==='vs3bet'?p.table(hero).hands[h].action==='Raise':p.table(hero,'vsopen',o).hands[h].action==='3-bet'));
   assert.ok(row.historyEligible?['Fold','Call','4-bet','4-bet All-in','5-bet All-in'].includes(row.action):row.action===null);
   for(const key of ['ev','frequency','frequencies','winRate','exploitability'])assert.equal(row[key],undefined);
   if(row.money){assert.ok(row.money.additionalBB>=0);assert.ok(row.money.heroRemainingBB>=0);assert.ok(row.money.toBB<=table.money.liveCapsBB[hero]);}
   if(jam)assert.ok(row.action===null||['Call','Fold'].includes(row.action));
  }
  assert.equal(table.metadata.gtoVerified,false);assert.equal(table.hands.AA.action,scenario==='vs3bet'?'4-bet':jam?'Call':'5-bet All-in');
 }
 assert.equal(count,108);assert.equal(r.table('BTN','vs3bet','BTN','BB').hands['72o'].action,null);
});
test('all pairs and betting stages agree with independent chip-by-chip debit accounting',()=>{
 for(const [o,t]of pairs)for(const stage of [3,4])for(const jam of stage===3?[false]:[false,true]){
  const l=r.ledger(o,t,stage,jam),d=debitLedger(o,t,stage,jam),hero=l.hero,op=l.opponent;
  assert.equal(l.potBeforeActionBB,d.pot);for(const seat of [o,t])assert.equal(l.remainingBB[seat],d.stack[seat]);
  const c=r.outcome(l,'Call'),target=Math.min(d.live[op],d.live[hero]+d.stack[hero]),extra=target-d.live[hero],refund=Math.max(0,d.live[op]-target);
  assert.equal(c.additionalBB,extra);assert.equal(c.uncalledReturnBB,refund);assert.equal(c.potAfterActionBB,d.pot+extra-refund);assert.equal(c.heroRemainingBB,d.stack[hero]-extra);
  assert.equal(l.call.rawEquityThreshold,extra/c.potAfterActionBB);
  assert.equal(Object.values(d.stack).reduce((a,b)=>a+b)+d.pot,270);
  const f=r.outcome(l,'Fold');assert.equal(f.uncalledReturnBB,d.live[op]-d.live[hero]);assert.equal(f.heroRemainingBB,d.stack[hero]);
 }
});
test('minimum raises are increments, BB live cap is 29 and uncalled excess is returned after a jam-call',()=>{
 const s=r.ledger('SB','BB',3);assert.equal(s.minimumRaiseToBB,13.5);assert.equal(s.potBeforeActionBB,11.5);assert.equal(s.call.additionalBB,5.5);
 assert.throws(()=>r.outcome(s,'4-bet',13));assert.throws(()=>r.outcome(s,'4-bet All-in',29));assert.throws(()=>r.outcome(s,'5-bet All-in',30));
 const jam=r.outcome(s,'4-bet All-in',30);assert.equal(jam.additionalBB,27.5);assert.equal(jam.heroRemainingBB,0);assert.equal(jam.ifCalled.uncalledReturnBB,1);assert.equal(jam.ifCalled.potBB,59);
 const bb=r.ledger('BTN','BB',4,true),call=r.outcome(bb,'Call');assert.equal(bb.remainingBB.BB,22);assert.equal(call.additionalBB,22);assert.equal(call.toBB,29);assert.equal(call.uncalledReturnBB,1);assert.equal(call.potAfterActionBB,59.5);assert.equal(call.heroRemainingBB,0);assert.throws(()=>r.outcome(bb,'5-bet All-in',29));
 const five=r.outcome(r.ledger('BTN','BB',4),'5-bet All-in',29);assert.equal(five.toBB,29);assert.equal(five.additionalBB,22);assert.equal(five.ifCalled.potBB,59.5);
});
test('non-all-in 4bet sizes meet minimum legal raises for every seat pair; raise semantics never imply extra total',()=>{
 for(const [o,t]of pairs){const l=r.ledger(o,t,3);assert.ok(14>=l.minimumRaiseToBB);const a=r.outcome(l,'4-bet',14);assert.equal(a.additionalBB,14-l.openToBB);assert.equal(a.heroRemainingBB,16);assert.equal(a.allIn,false);}
 assert.equal(r.table('BTN','vs3bet','BTN','BB').hands.AKo.action,'4-bet All-in');assert.equal(r.table('BTN','vs3bet','BTN','BB').hands.JJ.action,'4-bet All-in');
 assert.equal(r.table('UTG','vs3bet','UTG','BB').hands.JJ.action,'Call');
});
