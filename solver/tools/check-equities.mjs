// Independent JS evaluator, exact enumeration, and separately implemented suit key.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {classCombos,handNames,loadExactMatrix,BOARDS} from '../exact-matrix.js';
import {fastExactHeadsUpEquity} from '../fast-equity.js';
import {overlaps} from '../equity-matrix.js';
const permutations=[];
function permute(a,rest){if(!rest.length)permutations.push(a);else for(const x of rest)permute([...a,x],rest.filter(y=>x!==y));}
permute([],['c','d','h','s']);
function key(a,b){return permutations.map(p=>[a,b].map(h=>h.map(c=>c[0]+p['cdhs'.indexOf(c[1])]).sort().join('')).join('/')).sort()[0];}
const groups=classCombos(),matrix=loadExactMatrix(readFileSync(new URL('../data/equity169.bin',import.meta.url))),results=[],cache=new Map();
for(const [a,b] of [['AA','AA'],['AA','KK'],['AKs','QQ'],['AKo','22'],['KQs','AJo'],['72o','32o']]){
 let weight=0,halfPots=0,unique=0;
 for(const h of groups[handNames.indexOf(a)])for(const v of groups[handNames.indexOf(b)]){
  if(overlaps(h,v))continue;const k=key(h,v);let r=cache.get(k);
  if(!r){r=fastExactHeadsUpEquity(h,v);if(r.total!==BOARDS)throw Error('Incomplete enumeration');cache.set(k,r);unique++;}
  halfPots+=2*r.wins+r.ties;weight++;
 }
 const i=handNames.indexOf(a),j=handNames.indexOf(b);
 if(weight!==matrix.jointWeights[i][j]||halfPots!==matrix.halfPots[i][j])throw Error(`Equity mismatch ${a}/${b}`);
 results.push({a,b,weight,halfPots,unique,boardsPerMatchup:BOARDS,matched:true});console.log(results.at(-1));
}
writeFileSync(new URL('../data/equity-crosscheck.json',import.meta.url),JSON.stringify({matrixSha256:createHash('sha256').update(readFileSync(new URL('../data/equity169.bin',import.meta.url))).digest('hex'),sourceSha256:createHash('sha256').update(readFileSync(new URL('../fast-equity.js',import.meta.url))).update(readFileSync(new URL('../hand-evaluator.js',import.meta.url))).digest('hex'),method:'Poker Lab JavaScript exact board enumeration; independently implemented evaluator and suit permutation cache',results},null,2)+'\n');
