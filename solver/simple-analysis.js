import {parseCard, evaluate, compare} from './hand-evaluator.js';
export const ranks='AKQJT98765432', suits='cdhs';
export const deck=[...ranks].flatMap(r=>[...suits].map(s=>r+s));
export const classes=[...ranks].flatMap((r,i)=>[...ranks].map((s,j)=>i===j?r+s:i<j?r+s+'s':s+r+'o'));
export function expandRange(range,used=[]){
 const blocked=new Set(used);const combos=[];
 if(!range||typeof range!=='object'||Array.isArray(range))throw Error('相手レンジを指定してください');
 for(const [hand,weight] of Object.entries(range)){
  if(!classes.includes(hand)||!Number.isFinite(weight)||weight<0||weight>1)throw Error('レンジ頻度が不正です');
  if(!weight)continue;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
   if(hand.length===2&&i>=j)continue;
   if(hand[2]==='s'&&i!==j||hand[2]==='o'&&i===j)continue;
   const cards=[hand[0]+suits[i],hand[1]+suits[j]];
   if(cards.some(c=>blocked.has(c)))continue;
   combos.push({cards,weight});
  }
 }
 if(!combos.length)throw Error('カード除外後の相手レンジが空です');
 return combos;
}
export function validate({hero,board,range,pot,bet}){
 if(!Array.isArray(hero)||hero.length!==2||!Array.isArray(board)||![3,4,5].includes(board.length))throw Error('自分の2枚とフロップ3枚を指定してください');
 if([...hero,...board].some(c=>!deck.includes(c)))throw Error('カード表記が不正です');
 const all=[...hero,...board].map(c=>parseCard(c).id);
 if(new Set(all).size!==all.length)throw Error('カードが重複しています');
 if(!Number.isFinite(pot)||pot<=0||!Number.isFinite(bet)||bet<0||!Number.isFinite(pot+2*bet))throw Error('ポットは正の数、ベットは0以上を入力してください');
 return expandRange(range,[...hero,...board]);
}
export function decision(equity,pot,bet){
 const finalPot=pot+2*bet,required=bet/finalPot,callEV=equity*finalPot-bet;
 return {required,callEV,foldEV:0,favorable:equity>required,odds:bet===0?null:(pot+bet)/bet};
}
// Exact enumeration: each surviving physical combo carries its class frequency.
// Each combo has the same number of possible runouts; ties receive half the pot.
export function* enumerateAnalysis(input,batch=256){
 const combos=validate(input),{hero,board,pot,bet}=input;
 const missing=5-board.length,n=52-hero.length-board.length-2;
 const per=missing===2?n*(n-1)/2:missing===1?n:1,total=combos.length*per;
 let done=0,won=0,tied=0,mass=0;
 const parsed=new Map(deck.map(c=>[c,parseCard(c)]));
 const h=hero.map(c=>parsed.get(c)),b=board.map(c=>parsed.get(c));
 for(const {cards,weight} of combos){
  const used=new Set([...hero,...board,...cards]);
  const remaining=deck.filter(c=>!used.has(c)).map(c=>parsed.get(c));
  const v=cards.map(c=>parsed.get(c));
  const score=extra=>{
   const full=[...b,...extra],outcome=compare(evaluate([...h,...full]),evaluate([...v,...full]));
   if(outcome>0)won+=weight;else if(outcome===0)tied+=weight;
   mass+=weight;done++;
  };
  if(missing===0){score([]);if(done%batch===0)yield {done,total};}
  else for(let i=0;i<remaining.length;i++){
   if(missing===1){score([remaining[i]]);if(done%batch===0)yield {done,total};}
   else for(let j=i+1;j<remaining.length;j++){score([remaining[i],remaining[j]]);if(done%batch===0)yield {done,total};}
  }
 }
 const equity=(won+tied/2)/mass;
 return {equity,win:won/mass,tie:tied/mass,done,total,combos:combos.length,method:'exact',...decision(equity,pot,bet)};
}
export function analyze(input){const g=enumerateAnalysis(input);let r;do{r=g.next()}while(!r.done);return r.value;}
