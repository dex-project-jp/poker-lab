// Poker Lab: deterministic Texas Hold'em hand evaluator.
// Card notation: As Kh Td 9c; ranks 2..A, suits c/d/h/s.
// Exact ranking for a specified 5-7-card showdown. No strategy frequencies.
const RANKS='23456789TJQKA', SUITS='cdhs';
export function parseCard(card){
 if(typeof card!=='string'||card.length!==2)throw Error('Invalid card');
 const r=RANKS.indexOf(card[0].toUpperCase()),s=SUITS.indexOf(card[1].toLowerCase());
 if(r<0||s<0)throw Error('Invalid card: '+card);
 return {id:r*4+s,rank:r+2,suit:s};
}
// Parsed card objects are public inputs too: never trust a forged id/rank/suit.
export function normalizeCard(card){
 if(typeof card==='string')return parseCard(card);
 if(!card||!Number.isInteger(card.id)||card.id<0||card.id>=52||card.rank!==Math.floor(card.id/4)+2||card.suit!==card.id%4)throw Error('Invalid parsed card');
 return card;
}
export function evaluate(cards){
 if(!Array.isArray(cards)||cards.length<5||cards.length>7)throw Error('Expected 5-7 cards');
 const c=cards.map(normalizeCard);
 if(new Set(c.map(x=>x.id)).size!==c.length)throw Error('Duplicate cards');
 let best=null;
 for(let a=0;a<c.length-4;a++)for(let b=a+1;b<c.length-3;b++)for(let d=b+1;d<c.length-2;d++)for(let e=d+1;e<c.length-1;e++)for(let f=e+1;f<c.length;f++){
  const v=score5([c[a],c[b],c[d],c[e],c[f]]);
  if(best===null||compare(v,best)>0)best=v;
 }
 return best;
}
function straightHigh(ranks){
 const set=new Set(ranks);if(set.has(14))set.add(1);
 for(let high=14;high>=5;high--)if([0,1,2,3,4].every(i=>set.has(high-i)))return high;
 return 0;
}
function score5(cards){
 const counts=new Map();for(const c of cards)counts.set(c.rank,(counts.get(c.rank)||0)+1);
 const groups=[...counts].map(([rank,count])=>({rank,count})).sort((a,b)=>b.count-a.count||b.rank-a.rank);
 const desc=cards.map(c=>c.rank).sort((a,b)=>b-a);
 const flush=cards.every(c=>c.suit===cards[0].suit),straight=straightHigh(desc);
 if(flush&&straight)return [8,straight];
 if(groups[0].count===4)return [7,groups[0].rank,groups[1].rank];
 if(groups[0].count===3&&groups[1].count===2)return [6,groups[0].rank,groups[1].rank];
 if(flush)return [5,...desc];
 if(straight)return [4,straight];
 if(groups[0].count===3)return [3,groups[0].rank,...groups.slice(1).map(g=>g.rank).sort((a,b)=>b-a)];
 if(groups[0].count===2&&groups[1].count===2)return [2,Math.max(groups[0].rank,groups[1].rank),Math.min(groups[0].rank,groups[1].rank),groups[2].rank];
 if(groups[0].count===2)return [1,groups[0].rank,...groups.slice(1).map(g=>g.rank).sort((a,b)=>b-a)];
 return [0,...desc];
}
export function compare(a,b){
 for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]??0)-(b[i]??0);if(diff)return Math.sign(diff)}return 0;
}
export function showdown(hero,villain,board){
 if(hero.length!==2||villain.length!==2||board.length!==5)throw Error('Need 2+2+5 cards');
 const all=[...hero,...villain,...board].map(parseCard);
 if(new Set(all.map(x=>x.id)).size!==9)throw Error('Duplicate cards');
 return compare(evaluate([...hero,...board]),evaluate([...villain,...board]));
}
// Enumerates all possible boards for one fixed two-hand matchup.
// Exact, but computationally costly (~1.7m boards per matchup).
export function exactHeadsUpEquity(hero,villain){
 if(hero.length!==2||villain.length!==2)throw Error('Need two cards per hand');
 const used=[...hero,...villain].map(parseCard);
 if(new Set(used.map(x=>x.id)).size!==4)throw Error('Duplicate cards');
 const deck=[];for(const r of RANKS)for(const s of SUITS){const card=r+s;if(!used.some(x=>x.id===parseCard(card).id))deck.push(card)}
 let wins=0,ties=0,total=0;
 for(let a=0;a<44;a++)for(let b=a+1;b<45;b++)for(let c=b+1;c<46;c++)for(let d=c+1;d<47;d++)for(let e=d+1;e<48;e++){
  const board=[deck[a],deck[b],deck[c],deck[d],deck[e]];
  const outcome=compare(evaluate([...hero,...board]),evaluate([...villain,...board]));
  if(outcome>0)wins++;else if(outcome===0)ties++;total++;
 }
 return {wins,ties,losses:total-wins-ties,total,equity:(wins+ties/2)/total};
}
