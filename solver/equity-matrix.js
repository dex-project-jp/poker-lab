// Build blocker-aware combo matchups for the HU push/fold solver.
// Full 1326x1326 exact equity is a large offline computation; this function
// supports incremental batches and never marks incomplete output as verified.
import {fastExactHeadsUpEquity} from './fast-equity.js';
const R='23456789TJQKA',S='cdhs';
export function allCombos(){
 const deck=[];for(const r of R)for(const s of S)deck.push(r+s);
 const combos=[];for(let i=0;i<52;i++)for(let j=i+1;j<52;j++)combos.push([deck[i],deck[j]]);
 return combos;
}
export function overlaps(a,b){return a[0]===b[0]||a[0]===b[1]||a[1]===b[0]||a[1]===b[1]}
export function buildEquityBatch({sbHands,bbHands,start=0,count=1}){
 if(!Array.isArray(sbHands)||!Array.isArray(bbHands))throw Error('Hands must be arrays');
 if(!Number.isInteger(start)||start<0||start>sbHands.length)throw Error('Invalid start');
 if(!Number.isInteger(count)||count<0||start+count>sbHands.length)throw Error('Invalid count');
 const rows=[];
 for(let i=start;i<start+count;i++){
  const row=[];
  for(let j=0;j<bbHands.length;j++){
   if(overlaps(sbHands[i],bbHands[j])){row.push(null);continue}
   row.push(fastExactHeadsUpEquity(sbHands[i],bbHands[j]).equity);
  }
  rows.push(row);
 }
 return {start,rows,complete:start===0&&count===sbHands.length,verified:false};
}
