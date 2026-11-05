import test from 'node:test';
import assert from 'node:assert/strict';
import {createReachMoments,createCoverageAudit,diagnoseReach,summarizeCoverage} from './mtt10-br-coverage.js';
import {TREE,CLASSES} from './mtt10-mccfr.js';
import {dealer,handClass} from './mtt10-deck.js';
const policy=()=>Array(510*169).fill(.25);
test('ESS independently matches equal, skew, zero and tiny weights',()=>{
 const m=createReachMoments(4);[1,1,1].forEach(w=>m.add(0,w));[1,.5,.25,0].forEach(w=>m.add(1,w));[1e-200,1e-200].forEach(w=>m.add(2,w));
 assert.equal(m.at(0).effectiveSamples,3);assert.equal(m.at(1).sumReach,1.75);assert.equal(m.at(1).sumSquaredReach,1.3125);assert.ok(Math.abs(m.at(1).effectiveSamples-49/21)<1e-14);assert.equal(m.at(2).effectiveSamples,2);assert.equal(m.at(2).squaredSumUnderflow,true);assert.equal(m.at(3).effectiveSamples,null);
 assert.throws(()=>m.add(0,NaN));assert.throws(()=>m.add(0,-1));assert.throws(()=>m.add(4,1));
});
test('reach matches independent public history product for each row',()=>{
 const deal=dealer(160201)(),p=policy(),a=createCoverageAudit(p);a.observe(deal);
 const walk=(n,reach)=>{const node=TREE.nodes[n];if(node.actor<0)return;const h=CLASSES.indexOf(handClass(deal.hands[node.actor])),r=a.row(node.info,h);assert.equal(r.classSamples,1);assert.equal(r.sumReach,reach);assert.equal(r.nonzeroSamples,1);walk(node.children[0],reach*.75);walk(node.children[1],reach*.25);};walk(0,1);
});
test('class observations remain positive on unreachable deterministic histories',()=>{
 const deal=dealer(7)(),p=Array(510*169).fill(0),a=createCoverageAudit(p);a.observe(deal);a.observe(deal);
 let zeros=0;for(let i=0;i<510;i++){const h=CLASSES.indexOf(handClass(deal.hands[TREE.infos[i].player])),r=a.row(i,h);assert.equal(r.classSamples,2);if(r.status==='zero-reach')zeros++;else assert.equal(r.effectiveSamples,2);}assert.ok(zeros>400);
 const s=summarizeCoverage(a);assert.equal(Object.values(s.totals).reduce((a,b)=>a+b),86190);assert.ok(s.totals.noClassSamples>0);
});
test('independent seed replay is deterministic and inputs are immutable',()=>{
 const p=policy(),original=p.slice(),a=diagnoseReach(p,{samples:4,seed:123}),b=diagnoseReach(p,{samples:4,seed:123});assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(p,original);assert.notDeepEqual(a.snapshot().classSamples,diagnoseReach(p,{samples:4,seed:124}).snapshot().classSamples);
});
test('missing policy never receives fallback and audit freezes input',()=>{
 const p=policy();p[0]=null;assert.throws(()=>createCoverageAudit(p));delete p[0];assert.throws(()=>createCoverageAudit(p));p[0]=.25;const a=createCoverageAudit(p);p.fill(0);const deal=dealer(5)();a.observe(deal);const h=CLASSES.indexOf(handClass(deal.hands[0]));assert.equal(a.row(0,h).sumReach,1);assert.throws(()=>diagnoseReach(p,{samples:0,seed:1}));
});
