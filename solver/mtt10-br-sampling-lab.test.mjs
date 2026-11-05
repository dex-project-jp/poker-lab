import test from 'node:test';import assert from 'node:assert/strict';
import {CONFIG,WORLDS,INFOS,ROWS,makeTable,fixedPolicy,conditionalProposal,exactOracle,scoreWorld,scoreExact,fitFinite,evaluateFinite,selectFinite,exactEstimatorVariance,uniformIndex} from './mtt10-br-sampling-lab.js';
import {fastEvaluate7} from './fast-equity.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('finite chance reduction preserves card exclusion and pair order for all suits',()=>{
 assert.equal(WORLDS.length,24);assert.equal(new Set(WORLDS.map(String)).size,24);for(const w of WORLDS)assert.equal(new Set(w).size,3);
 for(const [h,rank] of [...'AKQJ'].entries())for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){const cards=[rank+'cdhs'[a],rank+'cdhs'[b],...CONFIG.board];assert.equal(new Set(cards).size,7);const s=fastEvaluate7(cards);assert.equal(s[0],1);assert.equal(s[1],14-h);}
});
test('conditional proposal exactly restores unnormalized hand/history action advantage',()=>{
 const t=makeTable(),o=exactOracle(t);for(let row=0;row<ROWS;row++){const q=conditionalProposal(t,row);near(q.entries.reduce((s,e)=>s+e.probability,0),1);near(q.mass,o.mass[row]);near(q.entries.reduce((s,e)=>s+e.probability*q.mass*t.worlds[e.world].rows[Math.floor(row/4)].delta,0),o.advantage[row]);for(const e of q.entries){assert.equal(WORLDS[e.world][INFOS[Math.floor(row/4)].actor],row%4);near(e.probability*q.mass,e.mass);}}
});
test('oracle is exact best response among all pure unilateral choices in finite game',()=>{
 const t=makeTable(),o=exactOracle(t);for(let p=0;p<3;p++){const rows=Array.from({length:ROWS},(_,r)=>r).filter(r=>INFOS[Math.floor(r/4)].actor===p);let best=-Infinity;for(let bits=0;bits<2**rows.length;bits++){const q=t.policy.slice();rows.forEach((r,k)=>q[r]=(bits>>k)&1);best=Math.max(best,scoreExact(t,q)[p]);}near(best,o.gains[p]);}
 for(const w of t.worlds)near(w.values.reduce((a,b)=>a+b),0);
});
test('same row-lookup budget, reproducible fits and no mutation',()=>{
 const t=makeTable(),original=JSON.stringify(t);for(const method of ['joint','conditional']){const f=fitFinite(t,{method,samples:64,seed:170201});assert.equal(f.rowValueLookups,64*INFOS.length);assert.deepEqual(f,fitFinite(t,{method,samples:64,seed:170201}));}assert.equal(JSON.stringify(t),original);assert.throws(()=>fitFinite(t,{method:'conditional',samples:3,seed:1}));
});
test('unreachable rows remain baseline, sparse policies rejected, no fabricated precision',()=>{
 const p=Array(ROWS).fill(0),t=makeTable(p),f=fitFinite(t,{method:'conditional',samples:64,seed:1});for(let r=0;r<ROWS;r++)if(!conditionalProposal(t,r).mass){assert.equal(f.counts[r],0);assert.equal(f.effectiveSamples[r],null);assert.equal(f.response[r],p[r]);}delete p[0];assert.throws(()=>makeTable(p));assert.throws(()=>conditionalProposal(t,ROWS));
});
test('paired evaluation, conservative selection and variance agree with small calculations',()=>{
 const t=makeTable(),o=exactOracle(t),e=evaluateFinite(t,o.response,o.response,{samples:16,seed:172201});for(const x of e.contrasts){assert.equal(x.meanBB,0);assert.equal(x.standardErrorBB,0);assert.ok(x.lowerBB<0&&x.upperBB>0);}assert.deepEqual(selectFinite(t,o.response,e).response,t.policy);
 const v=exactEstimatorVariance(t,0,64),xs=t.worlds.map(w=>w.rows[0].row===0?w.rows[0].reach*w.rows[0].delta:0),mean=xs.reduce((a,b)=>a+b)/24;near(v.mean,mean);near(v.jointVariance,xs.reduce((s,x)=>s+(x-mean)**2,0)/24/64);assert.ok(v.conditionalVariance>=0);
 assert.deepEqual(scoreWorld(t,t.policy,0),[0,0,0]);
});

test('integer categorical primitives reject modulo bias and unsupported policy grids',()=>{
 const words=[4294967295,7];assert.equal(uniformIndex(()=>words.shift(),24),7);assert.equal(words.length,0);
 const hits=Array(24).fill(0);for(let i=0;i<24;i++)hits[uniformIndex(()=>i,24)]++;assert.deepEqual(hits,Array(24).fill(1));
 assert.throws(()=>uniformIndex(()=>0,0));const p=fixedPolicy();p[0]=.123456;assert.throws(()=>makeTable(p));
 const t=makeTable();for(let r=0;r<ROWS;r++){const q=conditionalProposal(t,r),n=q.entries.reduce((s,e)=>s+e.tickets,0);for(const e of q.entries){assert.ok(Number.isSafeInteger(e.tickets));assert.equal(e.probability,e.tickets/n);}}
});
