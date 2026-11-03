// Exact suit-symmetric reduction, NOT independent 169-class deal probabilities.
// Every non-overlapping one of the 1326 x 1225 ordered deals is counted once.
import {allCombos,overlaps} from './equity-matrix.js';
export const BOARDS=1712304,DEALS=1326*1225;
const ranks='AKQJT98765432';
export const handNames=Array.from({length:169},(_,k)=>{const i=Math.floor(k/13),j=k%13;return i===j?ranks[i]+ranks[j]:i<j?ranks[i]+ranks[j]+'s':ranks[j]+ranks[i]+'o';});
export function classIndex(cards){const a=ranks.indexOf(cards[0][0]),b=ranks.indexOf(cards[1][0]);if(a<0||b<0)throw Error('Invalid ranks');return a===b?13*a+a:cards[0][1]===cards[1][1]?13*Math.min(a,b)+Math.max(a,b):13*Math.max(a,b)+Math.min(a,b);}
export function classCombos(){const groups=Array.from({length:169},()=>[]);for(const c of allCombos())groups[classIndex(c)].push(c);return groups;}
export function countDeals(){const combos=allCombos(),indices=combos.map(classIndex),weights=Array.from({length:169},()=>Array(169).fill(0));for(let i=0;i<1326;i++)for(let j=0;j<1326;j++)if(!overlaps(combos[i],combos[j]))weights[indices[i]][indices[j]]++;return weights;}
export function loadExactMatrix(bytes){
 const buffer=bytes.buffer??bytes,offset=bytes.byteOffset??0,length=bytes.byteLength;
 if(length!==228504)throw Error('Invalid matrix size');const v=new DataView(buffer,offset,length);
 if(String.fromCharCode(...new Uint8Array(buffer,offset,8))!=='NUTSE169'||v.getUint32(8,true)!==169||v.getUint32(12,true)!==BOARDS)throw Error('Invalid matrix header');
 const jointWeights=countDeals(),equity=jointWeights.map(row=>row.map(()=>0)),halfPots=jointWeights.map(row=>row.map(()=>0));
 for(let i=0;i<169;i++)for(let j=0;j<169;j++){const k=i*169+j,w=v.getUint32(16+k*4,true),h=v.getUint32(114260+k*4,true);
  if(w!==jointWeights[i][j]||h>2*BOARDS*w)throw Error('Invalid matrix counts');halfPots[i][j]=h;equity[i][j]=h/(2*BOARDS*w);}
 for(let i=0;i<169;i++)for(let j=0;j<169;j++)if(halfPots[i][j]+halfPots[j][i]!==2*BOARDS*jointWeights[i][j])throw Error('Non-complementary matrix');
 const groups=classCombos(),hands=groups.map((combos,i)=>({name:handNames[i],probability:combos.length/1326}));
 return {sbHands:hands,bbHands:hands,jointWeights,equity,halfPots};
}
