// Full 7-card category histogram, standard combinatorial counts out of C(52,7).
// This is additional evidence, not a replacement for per-hand reference tests.
import {fastEvaluate7} from '../fast-equity.js';
import {parseCard} from '../hand-evaluator.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const deck=[];for(const r of '23456789TJQKA')for(const s of 'cdhs')deck.push(parseCard(r+s));
const counts=Array(9).fill(0),cards=Array(7);
for(let a=0;a<46;a++){cards[0]=deck[a];for(let b=a+1;b<47;b++){cards[1]=deck[b];for(let c=b+1;c<48;c++){cards[2]=deck[c];for(let d=c+1;d<49;d++){cards[3]=deck[d];for(let e=d+1;e<50;e++){cards[4]=deck[e];for(let f=e+1;f<51;f++){cards[5]=deck[f];for(let g=f+1;g<52;g++){cards[6]=deck[g];counts[fastEvaluate7(cards)[0]]++;}}}}}}}
const expected=[23294460,58627800,31433400,6461620,6180020,4047644,3473184,224848,41584];
if(JSON.stringify(counts)!==JSON.stringify(expected))throw Error('7-card histogram mismatch: '+counts);
const sourceSha256=createHash('sha256').update(readFileSync(new URL('../fast-equity.js',import.meta.url))).update(readFileSync(new URL('../hand-evaluator.js',import.meta.url))).digest('hex');
const result={sourceSha256,method:'Enumerate every C(52,7) hand using Poker Lab fastEvaluate7',total:counts.reduce((a,b)=>a+b),categories:['high card','pair','two pair','three of a kind','straight','flush','full house','four of a kind','straight flush'],counts,expected,matched:true};
writeFileSync(new URL('../data/evaluator-exhaustive.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
