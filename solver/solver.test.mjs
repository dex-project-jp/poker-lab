import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,compare,showdown,parseCard} from './hand-evaluator.js';
import {payoff,shoveEV,bbCallEquityThreshold} from './pushfold-kernel.js';
test('card parsing and invalid duplicates',()=>{
 assert.equal(parseCard('As').rank,14);
 assert.throws(()=>parseCard('1x'));
 assert.throws(()=>evaluate(['As','As','Kd','Qh','Tc']));
});
test('royal flush beats quads and wheel straight',()=>{
 const royal=evaluate(['As','Ks','Qs','Js','Ts']);
 const quads=evaluate(['Ah','Ad','Ac','As','2c']);
 assert.equal(royal[0],8);assert.equal(quads[0],7);assert.ok(compare(royal,quads)>0);
 assert.deepEqual(evaluate(['As','2d','3h','4c','5s']),[4,5]);
});
test('full house and flush outrank straight',()=>{
 assert.ok(compare(evaluate(['Ah','Ad','Ac','Kh','Kd']),evaluate(['2s','3s','4s','5s','7s']))>0);
 assert.ok(compare(evaluate(['2s','3s','4s','5s','7s']),evaluate(['9d','Td','Jc','Qh','Ks']))>0);
});
test('seven-card evaluator picks best five',()=>{
 assert.deepEqual(evaluate(['As','Ks','Qs','Js','Ts','2d','3c']),[8,14]);
});
test('showdown tie on board and hero win',()=>{
 assert.equal(showdown(['2c','3d'],['4c','5d'],['As','Ks','Qs','Js','Ts']),0);
 assert.equal(showdown(['Ah','Ad'],['Kc','Kd'],['2c','7d','9h','Js','3c']),1);
 assert.throws(()=>showdown(['Ah','Ad'],['Ah','Kd'],['2c','7d','9h','Js','3c']));
});
test('10BB payoff and BB call threshold',()=>{
 const p=payoff({stackBB:10,equity:0.5});
 assert.equal(p.sbFold,-0.5);assert.equal(p.sbShoveBbFold,1);
 assert.equal(p.sbShoveBbCall,0);assert.equal(p.bbFoldToShove,-1);
 assert.equal(shoveEV({stackBB:10,equity:0.5,bbCallProbability:0.5}),0.5);
 assert.equal(bbCallEquityThreshold(10),0.45);
 assert.throws(()=>payoff({stackBB:10,equity:1.1}));
});

test('straight flush requires same suit and wheel straight flush is five-high',()=>{
 assert.deepEqual(evaluate(['As','2s','3s','4s','5s']),[8,5]);
 assert.equal(evaluate(['As','Ks','Qs','Js','Td'])[0],4);
 assert.equal(evaluate(['As','Ks','Qs','Js','9s'])[0],5);
});
test('kickers break ties correctly',()=>{
 assert.ok(compare(evaluate(['Ah','Ad','Kc','Qd','2s']),evaluate(['As','Ac','Kc','Jd','2h']))>0);
 assert.ok(compare(evaluate(['Ah','Ad','Kh','Kd','Qs']),evaluate(['As','Ac','Ks','Kc','Jh']))>0);
 assert.ok(compare(evaluate(['Ah','Ad','Ac','Ks','Qd']),evaluate(['As','Ad','Ac','Kh','Jd']))>0);
});
test('board quads tie and no duplicate cards allowed',()=>{
 assert.equal(showdown(['2c','3d'],['4c','5d'],['As','Ah','Ad','Ac','Ks']),0);
 assert.throws(()=>showdown(['As','Kd'],['Qh','Jc'],['As','2h','3d','4c','5s']));
});
test('10BB payoff zero-sum at showdown and correct boundary equities',()=>{
 for(const equity of [0,0.1,0.45,0.5,0.9,1]){
  const p=payoff({stackBB:10,equity});
  assert.ok(Math.abs(p.sbShoveBbCall+p.bbCallVsShove)<1e-12);
  assert.equal(p.sbShoveBbFold,1);
 }
 assert.equal(payoff({stackBB:10,equity:1}).sbShoveBbCall,10);
 assert.equal(payoff({stackBB:10,equity:0}).sbShoveBbCall,-10);
});

test('fast evaluator agrees with reference on 2000 deterministic random seven-card hands',async()=>{
 const {fastEvaluate7}=await import('./fast-equity.js');
 const deck=[];for(const r of '23456789TJQKA')for(const suit of 'cdhs')deck.push(parseCard(r+suit));
 let seed=123456;const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 for(let i=0;i<2000;i++){
  const cards=[...deck];for(let j=0;j<7;j++){const k=j+Math.floor(rnd()*(52-j));[cards[j],cards[k]]=[cards[k],cards[j]]}
  const hand=cards.slice(0,7);assert.deepEqual(fastEvaluate7(hand),evaluate(hand));
 }
});
test('AA versus KK exact equity across all 1,712,304 boards',async()=>{
 const {fastExactHeadsUpEquity}=await import('./fast-equity.js');
 const result=fastExactHeadsUpEquity(['As','Ah'],['Kc','Kd']);
 assert.deepEqual({wins:result.wins,ties:result.ties,losses:result.losses,total:result.total},{wins:1388072,ties:6538,losses:317694,total:1712304});
 assert.ok(Math.abs(result.equity-0.8125548967940273)<1e-12);
});

test('best response uses opponent call frequency and matchup equity',async()=>{
 const {bestResponses}=await import('./best-response.js');
 const sbHands=[{probability:1,cards:[0,1]}],bbHands=[{probability:1,cards:[2,3]}];
 const r=bestResponses({sbHands,bbHands,equity:[[0.8]],stackBB:10,sbShove:[1],bbCall:[1]});
 assert.ok(Math.abs(r.sbEV[0].shove-6)<1e-12);
 assert.equal(r.sbBest[0],1);assert.equal(r.bbBest[0],0);
});
test('blocked matchups are excluded and BB can have no facing shove',async()=>{
 const {bestResponses}=await import('./best-response.js');
 const sbHands=[{probability:0.5},{probability:0.5}],bbHands=[{probability:0.5},{probability:0.5}];
 const r=bestResponses({sbHands,bbHands,equity:[[null,0.8],[0.2,null]],stackBB:10,sbShove:[0,0],bbCall:[0,0]});
 assert.equal(r.sbEV[0].shove,1);assert.equal(r.bbBest[0],null);
});
