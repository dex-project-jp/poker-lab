import test from 'node:test';
import assert from 'node:assert/strict';
import './practical-ranges.js';
import './mtt-model.js';
import {handNames,DEALS} from './exact-matrix.js';
const p=globalThis.PokerLabPractical;

test('original reference metadata never claims GTO, computed frequencies or external chart rights',()=>{
 assert.equal(p.metadata.kind,'original-strategy-design');assert.equal(p.metadata.gtoVerified,false);assert.equal(p.metadata.frequencyModel,'none');
 assert.match(p.metadata.license,/no third-party range files/);assert.ok(p.metadata.sources.every(s=>s.url.startsWith('https://')&&s.use.includes('only')));
});
test('range notation expands exact classes and rejects ambiguous/invalid definitions',()=>{
 assert.deepEqual([...p.expand('QQ+')],['QQ','KK','AA']);assert.deepEqual([...p.expand('KTs+')],['KTs','KJs','KQs']);assert.equal(p.expand('all-suited').size,78);
 for(const s of ['AK','AAs','KAs','Z9s','22o','A1s','A2x','22-99'])assert.throws(()=>p.expand(s));
});
test('all eight original open tables cover every 169 class once and all 1326 physical combinations',()=>{
 assert.deepEqual(p.hands,handNames);assert.equal(p.hands.reduce((s,h)=>s+p.comboCount(h),0),1326);
 for(const pos of p.positions.slice(0,8)){
  const t=p.table(pos);assert.equal(t.state,'reference');assert.deepEqual(Object.keys(t.hands).sort(),[...handNames].sort());assert.equal(Object.values(t.stats).reduce((a,b)=>a+b),1326);
  for(const [h,row] of Object.entries(t.hands)){assert.ok(['Raise','Fold','Limp','All-in'].includes(row.action));assert.ok(row.reason.length>15);assert.equal(row.frequency,undefined);assert.equal(row.ev,undefined);if(row.action==='Limp')assert.equal(pos,'SB');if(row.action==='Raise')assert.equal(row.sizeBB,pos==='SB'?2.5:2);}
 }
 assert.equal(p.table('BB').state,'walk');assert.equal(p.table('BB').hands,null);
});
test('early-to-button expansion is monotonic, preserves premiums, and documents explicit boundary choices',()=>{
 let prev=new Set();for(const pos of p.positions.slice(0,7)){const t=p.table(pos),current=new Set(p.hands.filter(h=>t.hands[h].action==='Raise'));for(const h of prev)assert.ok(current.has(h),pos+'/'+h);assert.ok(current.size>prev.size);prev=current;
  for(const h of ['AA','KK','QQ','AKs','AKo'])assert.equal(t.hands[h].action,'Raise');assert.equal(t.hands['72o'].action,'Fold');assert.equal(t.hands.AA.action,'Raise');
 }
 assert.equal(p.table('UTG').hands['44'].action,'Fold');assert.equal(p.table('UTG+1').hands['44'].action,'Raise');assert.equal(p.table('BTN').hands.K4s.action,'Raise');assert.equal(p.table('UTG').hands.K4s.action,'Fold');
 assert.deepEqual(p.table('MP'),p.table('UTG+2'));assert.equal(p.display('UTG+2'),'MP');
});
test('SB has explicit raise/limp/fold branches and the 30BB basic policy intentionally has no open jam',()=>{
 const t=p.table('SB');assert.equal(t.hands.AA.action,'Raise');assert.equal(t.hands['22'].action,'Limp');assert.equal(t.hands['72o'].action,'Fold');assert.equal(t.hands.K2o.action,'Limp');
 for(const pos of p.positions.slice(0,8))assert.equal(p.table(pos).stats['All-in']||0,0);
});
test('all 36 legal single-open response spots contain every hand, with legal total 3bet/call sizes',()=>{
 let count=0;for(let hi=1;hi<9;hi++)for(let oi=0;oi<hi;oi++){
  const hero=p.positions[hi],opener=p.positions[oi],t=p.table(hero,'vsopen',opener);count++;assert.equal(Object.keys(t.hands).length,169);assert.equal(Object.values(t.stats).reduce((a,b)=>a+b),1326);
  for(const row of Object.values(t.hands)){assert.ok(['Fold','Call','3-bet'].includes(row.action));if(row.action==='3-bet'){assert.equal(row.sizeBB,opener==='SB'?8:hero==='SB'||hero==='BB'?7:6);assert.ok(row.sizeBB>=(opener==='SB'?4:3));}if(row.action==='Call')assert.equal(row.sizeBB,opener==='SB'?2.5:2);}
  assert.equal(t.hands.AA.action,'3-bet');if(hero==='SB')assert.equal(t.stats.Call||0,0);
 }
 assert.equal(count,36);
});
test('invalid response order, 3bet/4bet states and unknown positions never fall back to fabricated tables',()=>{
 for(const args of [['UTG','vsopen','BTN'],['BTN','vsopen','BTN'],['SB','vsopen','BB'],['BTN','vs3bet','CO'],['BTN','vs4bet','CO'],['not-a-seat','open']])assert.equal(p.table(...args),null);
 assert.equal(p.table('UTG','vsopen',null),null);
});
test('BB ante is not paid twice in simple pot-odds arithmetic; math is not represented as EV',()=>{
 const b=p.table('BB','vsopen','BTN').math;assert.equal(b.potBeforeCallBB,4.5);assert.equal(b.additionalCallBB,1);assert.equal(b.rawCallEquityThreshold,1/5.5);
 const sb=p.table('BB','vsopen','SB').math;assert.equal(sb.potBeforeCallBB,4.5);assert.equal(sb.additionalCallBB,1.5);assert.equal(sb.rawCallEquityThreshold,.25);
 const ip=p.table('BTN','vsopen','CO').math;assert.equal(ip.additionalCallBB,2);assert.equal(ip.rawCallEquityThreshold,2/6.5);assert.match(ip.definition,/ignores equity realization/);
});
test('reference choices cannot pass the existing mathematical-GTO dataset gate',()=>{
 const t=p.table('BTN');assert.equal(PokerLabMTT.inspect(t,PokerLabMTT.defaults(),'BTN').ok,false);
 for(const pos of p.positions.slice(0,8))assert.ok(Object.values(p.table(pos).hands).every(h=>!('frequencies' in h)));
 assert.doesNotMatch(p.table('BB','vsopen','BTN').hands.KQs.reason,/Aのブロッカー/);
});
