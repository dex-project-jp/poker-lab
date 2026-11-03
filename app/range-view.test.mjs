import test from 'node:test';import assert from 'node:assert/strict';import './range-view.js';
const v=globalThis.PokerLabRangeView;
// Synthetic rendering fixture only. No production poker strategy uses these numbers.
const mixed={kind:'computed',frequencies:{Raise:.7,Call:.3},provenance:{method:'synthetic UI fixture',modelId:'fixture-only',source:'unit test',validation:{status:'verified',scope:'renderer test only; no poker claim'}}};
test('reference recommendations render one solid color without manufacturing 100% frequencies',()=>{
 const row=v.view({kind:'reference',action:'4-bet'});assert.equal(row.background,v.colors['4-bet']);assert.equal(row.segments[0].fraction,null);assert.doesNotMatch(row.label,/%/);assert.equal(v.view({kind:'reference',action:null}),null);
});
test('computed fractions produce exact multi-color boundaries with explicit model provenance',()=>{
 const row=v.view(mixed);assert.match(row.background,/#e9a53d 0%,#e9a53d 70%,#399dd5 70%,#399dd5 100%/);assert.equal(row.label,'Raise 70.0% / Call 30.0%');assert.equal(row.provenance.modelId,'fixture-only');
});
test('unverified, unknown, negative, nonfinite and incomplete mixtures fail closed',()=>{
 for(const frequencies of [{Raise:70,Call:30},{Raise:.7},{Raise:-.1,Call:1.1},{Raise:NaN,Call:1},{Unknown:1},{}])assert.equal(v.view({...mixed,frequencies}),null);
 for(const provenance of [{},null,{...mixed.provenance,validation:{status:'pending'}},{...mixed.provenance,source:''}])assert.equal(v.view({...mixed,provenance}),null);
 assert.equal(v.view({...mixed,kind:'guessed'}),null);
});
