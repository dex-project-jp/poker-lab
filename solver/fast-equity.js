// Fast seven-card Texas Hold'em evaluator. Returns same score vector as evaluate().
// Validated against the exhaustive five-card-subset reference evaluator.
import {parseCard,compare,normalizeCard} from './hand-evaluator.js';
function straight(mask){for(let h=14;h>=5;h--){let ok=true;for(let j=0;j<5;j++){let r=h-j;if(r===1)r=14;if(!(mask&(1<<r))){ok=false;break}}if(ok)return h}return 0}
export function fastEvaluate7(cards){
 if(cards.length!==7)throw Error('Expected 7 cards');
 const c=cards.map(normalizeCard);
 if(new Set(c.map(x=>x.id)).size!==7)throw Error('Duplicate cards');
 const counts=new Int8Array(15),suitCounts=new Int8Array(4),suitMasks=new Int32Array(4);let mask=0;
 for(const x of c){counts[x.rank]++;suitCounts[x.suit]++;mask|=1<<x.rank;suitMasks[x.suit]|=1<<x.rank}
 for(let s=0;s<4;s++)if(suitCounts[s]>=5){const sf=straight(suitMasks[s]);if(sf)return [8,sf]}
 for(let r=14;r>=2;r--)if(counts[r]===4){for(let k=14;k>=2;k--)if(k!==r&&counts[k])return [7,r,k]}
 let trips=0;for(let r=14;r>=2;r--)if(counts[r]>=3){trips=r;break}
 if(trips){for(let r=14;r>=2;r--)if(r!==trips&&counts[r]>=2)return [6,trips,r]}
 for(let s=0;s<4;s++)if(suitCounts[s]>=5){const res=[5];for(let r=14;r>=2&&res.length<6;r--)if(suitMasks[s]&(1<<r))res.push(r);return res}
 const st=straight(mask);if(st)return [4,st];
 if(trips){const res=[3,trips];for(let r=14;r>=2&&res.length<4;r--)if(r!==trips&&counts[r])res.push(r);return res}
 let pair1=0,pair2=0;for(let r=14;r>=2;r--)if(counts[r]>=2){if(!pair1)pair1=r;else if(!pair2)pair2=r}
 if(pair2){for(let r=14;r>=2;r--)if(r!==pair1&&r!==pair2&&counts[r])return [2,pair1,pair2,r]}
 if(pair1){const res=[1,pair1];for(let r=14;r>=2&&res.length<5;r--)if(r!==pair1&&counts[r])res.push(r);return res}
 const res=[0];for(let r=14;r>=2&&res.length<6;r--)if(counts[r])res.push(r);return res;
}
export function fastExactHeadsUpEquity(hero,villain){
 if(hero.length!==2||villain.length!==2)throw Error('Need two cards per hand');
 const used=[...hero,...villain].map(parseCard);
 if(new Set(used.map(x=>x.id)).size!==4)throw Error('Duplicate cards');
 const deck=[];for(const r of '23456789TJQKA')for(const s of 'cdhs'){const c=parseCard(r+s);if(!used.some(x=>x.id===c.id))deck.push(c)}
 const h=[...used.slice(0,2),null,null,null,null,null],v=[...used.slice(2),null,null,null,null,null];
 let wins=0,ties=0,total=0;
 for(let a=0;a<44;a++)for(let b=a+1;b<45;b++)for(let c=b+1;c<46;c++)for(let d=c+1;d<47;d++)for(let e=d+1;e<48;e++){
 h[2]=v[2]=deck[a];h[3]=v[3]=deck[b];h[4]=v[4]=deck[c];h[5]=v[5]=deck[d];h[6]=v[6]=deck[e];
 const x=compare(fastEvaluate7(h),fastEvaluate7(v));wins+=x>0;ties+=x===0;total++;
 }
 return {wins,ties,losses:total-wins-ties,total,equity:(wins+ties/2)/total};
}
