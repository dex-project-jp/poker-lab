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
// Interpret finite Number inputs as their round-trippable decimal representation.
// Compare exact integer ratios; convert to floating point only for display.
function decimal(value){
 const [mantissa,exponent='0']=String(value).toLowerCase().split('e'),fraction=(mantissa.split('.')[1]||'').length,places=fraction-Number(exponent);
 const digits=BigInt(mantissa.replace('.',''));return places<0?{units:digits*10n**BigInt(-places),places:0}:{units:digits,places};
}
function commonDecimals(values){const parts=values.map(decimal),places=Math.max(...parts.map(p=>p.places));return {units:parts.map(p=>p.units*10n**BigInt(places-p.places)),places};}
function ratioNumber(numerator,denominator){
 if(numerator===0n)return 0;const negative=numerator<0n,n=negative?-numerator:numerator;
 const shift=Math.max(0,17+denominator.toString().length-n.toString().length),rounded=(n*10n**BigInt(shift)+denominator/2n)/denominator;
 return Number((negative?'-':'')+rounded.toString()+'e-'+shift);
}
export function decision(equity,pot,bet,exactShare=null){
 if(!Number.isFinite(equity)||equity<0||equity>1||!Number.isFinite(pot)||pot<=0||!Number.isFinite(bet)||bet<0||!Number.isFinite(pot+2*bet))throw Error('計算条件が不正です');
 const share=exactShare||(()=>{const d=decimal(equity);return {numerator:d.units,denominator:10n**BigInt(d.places)};})();
 const {units:[p,b],places}=commonDecimals([pot,bet]),final=p+2n*b,advantage=share.numerator*final-b*share.denominator;
 const comparison=advantage>0n?'call':advantage<0n?'fold':'equal';
 return {required:ratioNumber(b,final),callEV:ratioNumber(advantage,share.denominator*10n**BigInt(places)),foldEV:0,favorable:comparison==='call',comparison,odds:b===0n?null:ratioNumber(p+b,b)};
}
// Exact enumeration: each surviving physical combo carries its class frequency.
// Each combo has the same number of possible runouts; ties receive half the pot.
export function* enumerateAnalysis(input,batch=256){
 const combos=validate(input),{hero,board,pot,bet}=input;
 const missing=5-board.length,n=52-hero.length-board.length-2;
 const per=missing===2?n*(n-1)/2:missing===1?n:1,total=combos.length*per;
 let done=0,won=0n,tied=0n,mass=0n;
 const weights=commonDecimals(combos.map(c=>c.weight)).units;
 const parsed=new Map(deck.map(c=>[c,parseCard(c)]));
 const h=hero.map(c=>parsed.get(c)),b=board.map(c=>parsed.get(c));
 for(const [comboIndex,{cards}] of combos.entries()){
  const weight=weights[comboIndex];let comboWon=0,comboTied=0;
  const used=new Set([...hero,...board,...cards]);
  const remaining=deck.filter(c=>!used.has(c)).map(c=>parsed.get(c));
  const v=cards.map(c=>parsed.get(c));
  const score=extra=>{
   const full=[...b,...extra],outcome=compare(evaluate([...h,...full]),evaluate([...v,...full]));
   if(outcome>0)comboWon++;else if(outcome===0)comboTied++;
   done++;
  };
  if(missing===0){score([]);if(done%batch===0)yield {done,total};}
  else for(let i=0;i<remaining.length;i++){
   if(missing===1){score([remaining[i]]);if(done%batch===0)yield {done,total};}
   else for(let j=i+1;j<remaining.length;j++){score([remaining[i],remaining[j]]);if(done%batch===0)yield {done,total};}
  }
  won+=BigInt(comboWon)*weight;tied+=BigInt(comboTied)*weight;mass+=BigInt(per)*weight;
 }
 const numerator=2n*won+tied,denominator=2n*mass,equity=ratioNumber(numerator,denominator);
 return {equity,win:ratioNumber(won,mass),tie:ratioNumber(tied,mass),done,total,combos:combos.length,method:'exact',...decision(equity,pot,bet,{numerator,denominator})};
}
export function analyze(input){const g=enumerateAnalysis(input);let r;do{r=g.next()}while(!r.done);return r.value;}
