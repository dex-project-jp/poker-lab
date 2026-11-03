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
