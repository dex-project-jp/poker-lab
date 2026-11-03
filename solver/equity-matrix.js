// Build blocker-aware combo matchups for the HU push/fold solver.
// Full 1326x1326 exact equity is a large offline computation; this function
// supports incremental batches and never marks incomplete output as verified.
import {parseCard} from './hand-evaluator.js';
import {fastExactHeadsUpEquity} from './fast-equity.js';
const R='23456789TJQKA',S='cdhs';
export function allCombos(){
 const deck=[];for(const r of R)for(const s of S)deck.push(r+s);
 const combos=[];for(let i=0;i<52;i++)for(let j=i+1;j<52;j++)combos.push([deck[i],deck[j]]);
 return combos;
}
export function validateHand(hand){
 if(!Array.isArray(hand)||hand.length!==2)throw Error('Need two cards per hand');
 const ids=hand.map(c=>parseCard(c).id);if(ids[0]===ids[1])throw Error('Duplicate cards');return ids;
}
export function overlaps(a,b){const x=validateHand(a),y=validateHand(b);return x.some(c=>y.includes(c));}
export function buildEquityBatch({sbHands,bbHands,start=0,count=1}){
 if(!Array.isArray(sbHands)||!Array.isArray(bbHands))throw Error('Hands must be arrays');
 for(const h of [...sbHands,...bbHands])validateHand(h);
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
