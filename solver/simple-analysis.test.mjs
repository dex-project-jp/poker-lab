import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classes,expandRange,analyze,decision,validate} from './simple-analysis.js';
const base={hero:['As','Ah'],board:['Ac','Ad','2c','3d','4h'],range:{KK:1},pot:100,bet:50};
test('169 classes, physical combos and blockers',()=>{
 assert.equal(new Set(classes).size,169);assert.equal(expandRange(Object.fromEntries(classes.map(h=>[h,1]))).length,1326);
 assert.equal(expandRange({AA:1},['As']).length,3);assert.equal(expandRange({AKs:.25}).length,4);assert.equal(expandRange({AKo:.5}).length,12);
 assert.throws(()=>expandRange({AA:1},['As','Ah','Ac']));
});
test('river nuts, board tie, and decision from current point',()=>{
 let r=analyze(base);assert.equal(r.equity,1);assert.equal(r.total,6);assert.equal(r.callEV,150);assert.equal(r.required,.25);
 r=analyze({...base,hero:['2c','3d'],board:['As','Ks','Qs','Js','Ts'],range:{AA:1,KK:.5}});assert.equal(r.equity,.5);assert.equal(r.tie,1);
 assert.equal(decision(.25,100,50).favorable,false);assert.equal(decision(.25,100,50).callEV,0);assert.equal(decision(0,100,0).favorable,false);
});
test('exact turn and flop enumerate every legal runout',()=>{
 const turn=analyze({...base,board:['Ac','Ad','2c','3d']});assert.equal(turn.total,6*44);assert.equal(turn.equity,1);
 const flop=analyze({...base,board:['Ac','Ad','2c']});assert.equal(flop.total,6*990);assert.equal(flop.equity,1);
});
test('weighted combos normalize after blockers, not by class',()=>{
 const a=analyze({...base,hero:['As','Kd'],board:['Ac','7h','8h','9d','2c'],range:{AA:.25,KK:.75}});
 const aa=analyze({...base,hero:['As','Kd'],board:['Ac','7h','8h','9d','2c'],range:{AA:1}});
 const kk=analyze({...base,hero:['As','Kd'],board:['Ac','7h','8h','9d','2c'],range:{KK:1}});
 assert.ok(Math.abs(a.equity-(aa.equity*.25+kk.equity*2.25)/2.5)<1e-12);
});
test('invalid and empty inputs never produce results',()=>{
 for(const patch of [{range:{}},{range:{AA:NaN}},{range:{AA:1.1}},{pot:0},{bet:-1},{pot:Infinity},{hero:['As','As']},{board:['As','2c','3d']}])assert.throws(()=>validate({...base,...patch}));
});
