import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import './mtt-model.js';
import {handNames} from './exact-matrix.js';
const m=globalThis.PokerLabMTT;

test('MTT defaults define nine seats, all 30BB before posts, BBA and exact raise sizes',()=>{
 const c=m.defaults();assert.equal(m.errors(c).length,0);assert.equal(c.players,9);assert.ok(m.positions.every(p=>c.stacksBeforePostsBB[p]===30));
 assert.deepEqual(m.positions,['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB']);assert.deepEqual(m.hands,handNames);
 const p=m.posting(c);assert.equal(p.potBB,2.5);assert.equal(p.remaining.SB,29.5);assert.equal(p.remaining.BB,28);assert.equal(p.remaining.UTG,30);
 assert.equal(c.openRaiseToBB,2);assert.equal(c.sbRaiseToBB,2.5);assert.equal(c.model,'chipEV');
});
test('BBA, per-player and no ante are distinct accounting models and signatures',()=>{
 const a=m.defaults(),b=m.defaults(),c=m.defaults();b.ante={type:'per-player',amountBB:.1};c.ante={type:'none',amountBB:0};
 assert.equal(m.posting(b).remaining.UTG,29.9);assert.ok(Math.abs(m.posting(b).potBB-2.4)<1e-12);assert.equal(m.posting(c).potBB,1.5);
 assert.notEqual(m.signature(a),m.signature(b));assert.notEqual(m.signature(a),m.signature(c));
});
test('eight open nodes have correct prior folds and future players; BB is a walk',()=>{
 for(let i=0;i<8;i++){const n=m.node(m.positions[i]);assert.deepEqual(n.history,m.positions.slice(0,i).map(seat=>({seat,action:'fold'})));assert.deepEqual(n.toAct,m.positions.slice(i));}
 assert.equal(m.node('BB'),null);assert.equal(m.status(m.defaults(),'BB').state,'not-applicable');assert.equal(m.node('fake'),null);
});
test('30BB waits for verification; 10..100BB remain unsupported and never display fabricated frequencies',()=>{
 for(const pos of m.positions.slice(0,8))assert.equal(m.status(m.defaults(),pos).state,'pending');
 for(let S=10;S<=100;S++)if(S!==30)assert.deepEqual(m.status(m.defaults(S),'UTG').dataset,null);
 assert.equal(m.status(m.defaults(100),'BTN').label,'未対応');
 const context={};vm.runInNewContext(readFileSync(new URL('./data/mtt-ranges.js',import.meta.url),'utf8'),context);assert.equal(context.POKER_LAB_MTT_DATASETS.length,0);
});
test('nine-stack matching cannot silently use the HU hero-villain minimum',()=>{
 const base=m.defaults(),changed=m.defaults();changed.stacksBeforePostsBB.HJ=29;
 assert.notEqual(m.signature(base),m.signature(changed));assert.equal(m.status(changed,'UTG').state,'unsupported');
 for(const modify of [c=>c.openRaiseToBB=2.2,c=>c.sbRaiseToBB=3,c=>c.ante.amountBB=.9]){const c=m.defaults();modify(c);assert.notEqual(m.signature(base),m.signature(c));assert.equal(m.status(c,'UTG').state,'unsupported');}
});
test('invalid numbers and incompatible payoff models are rejected',()=>{
 for(const modify of [c=>c.players=8,c=>c.stacksBeforePostsBB.CO=NaN,c=>c.ante.amountBB=Infinity,c=>c.ante.type='guess',c=>c.openRaiseToBB=0,c=>c.openRaiseToBB=30,c=>c.rake=.05,c=>c.icm=true,c=>c.model='ICM',c=>c.stackBaseline='after ante']){const c=m.defaults();modify(c);assert.ok(m.errors(c).length);assert.equal(m.signature(c),null);assert.throws(()=>m.posting(c));}
});
function structuralFixture(){ // Synthetic schema test ONLY, never exported into application data.
 const g=m.defaults(),hash='a'.repeat(64),f={'All-in':0,Raise:100,Call:0,Check:0,Fold:0};
 return {schemaVersion:1,verified:true,game:g,node:m.node('UTG'),source:{name:'Synthetic schema fixture; not GTO',url:'https://example.org/schema-test',solverVersion:'test-only',artifactSha256:hash,redistributionAllowed:true,licenseReference:'fixture'},validation:{method:'full-game-unilateral-best-response-bounds',unit:'BB/dealt-hand',toleranceBB:1e-4,fullBettingTreeSha256:hash,postflopIncluded:true,fullGameAbstractionErrorIncluded:true,evidenceSha256:hash,independentReference:'https://example.org/test-only',independentMaxDifference:0,bestResponseGainUpperBoundsBB:Object.fromEntries(m.positions.map(p=>[p,0]))},hands:Object.fromEntries(m.hands.map(h=>[h,{...f}]))};
}
test('dataset gate rejects HU-style certificates, missing proof, wrong conditions and partial data',()=>{
 const d=structuralFixture();assert.ok(m.inspect(d,m.defaults(),'UTG').ok); // Structure only, not mathematical certification.
 for(const modify of [d=>d.verified=false,d=>delete d.source.solverVersion,d=>d.source.redistributionAllowed=false,d=>d.validation.postflopIncluded=false,d=>d.validation.fullGameAbstractionErrorIncluded=false,d=>d.validation.method='HU Nash gap',d=>d.source.artifactSha256=42,d=>d.validation.fullBettingTreeSha256={},d=>d.validation.evidenceSha256=[],d=>d.validation.unit='BB/100',d=>d.validation.bestResponseGainUpperBoundsBB.CO=.1,d=>delete d.validation.bestResponseGainUpperBoundsBB.BB,d=>d.game.stacksBeforePostsBB.BTN=31,d=>d.node.history.push({seat:'fake',action:'fold'}),d=>delete d.hands.AA,d=>d.hands.AA.Fold=NaN,d=>d.hands.AA.Call=100,d=>d.hands.AA.Check=100]){const d=structuralFixture();modify(d);assert.equal(m.inspect(d,m.defaults(),'UTG').ok,false);}
 assert.equal(m.inspect(d,m.defaults(),'BTN').ok,false);assert.equal(m.inspect(d,m.defaults(),'BB').ok,false);
});
