// Allocation-reusing kernel for the unchanged v1.2 public game and settlement.
import {TREE,CLASSES,validatePolicy} from './mtt10-mccfr.js';
import {DECK} from './mtt10-deck.js';
import {parseCard} from './hand-evaluator.js';
import {fastEvaluate7} from './fast-equity.js';
export const ROWS=TREE.infos.length*169;
const cards=DECK.map(parseCard), ids=new Map(DECK.map((c,i)=>[c,i]));
const classIndex=new Map(CLASSES.map((h,i)=>[h,i]));
const combos=Array.from({length:52},(_,a)=>Array.from({length:52},(_,b)=>{
 if(a===b)return -1;const high=Math.max(a>>2,b>>2),low=Math.min(a>>2,b>>2);
 return classIndex.get('23456789TJQKA'[high]+'23456789TJQKA'[low]+(high===low?'':a%4===b%4?'s':'o'));
}));
export function createKernel(){
 const v=new Float64Array(TREE.nodes.length*9),reach=new Float64Array(TREE.nodes.length),q=new Float64Array(TREE.infos.length),cs=new Int16Array(9),scores=new Float64Array(9),winners=new Int16Array(512),counts=new Int8Array(512);
 const holes=Array.from({length:9},()=>Array(7)),terminalNodes=[],decisions=[];
 for(let n=0;n<TREE.nodes.length;n++){const x=TREE.nodes[n];if(x.actor<0)terminalNodes.push([n,x]);else decisions.push([n,x]);}
 function prepare(deal){
  if(deal?.hands?.length!==9||deal.board?.length!==5||deal.hands.some(h=>h?.length!==2))throw Error('Invalid nine-player deal');
  const all=[...deal.hands.flat(),...deal.board].map(c=>{const i=ids.get(c);if(i===undefined)throw Error('Invalid card');return i;});
  if(new Set(all).size!==23)throw Error('Overlapping cards including folded seats');
  for(let p=0;p<9;p++){cs[p]=combos[all[p*2]][all[p*2+1]];const h=holes[p];h[0]=cards[all[p*2]];h[1]=cards[all[p*2+1]];for(let k=0;k<5;k++)h[k+2]=cards[all[18+k]];const s=fastEvaluate7(h);let score=0;for(let k=0;k<6;k++)score=score*15+(s[k]||0);scores[p]=score;}
  for(let mask=1;mask<512;mask++){const bit=mask&-mask,p=31-Math.clz32(bit),rest=mask^bit;if(!rest){winners[mask]=bit;counts[mask]=1;continue;}const best=31-Math.clz32(winners[rest]&-winners[rest]);if(scores[p]>scores[best]){winners[mask]=bit;counts[mask]=1;}else if(scores[p]===scores[best]){winners[mask]=winners[rest]|bit;counts[mask]=counts[rest]+1;}else{winners[mask]=winners[rest];counts[mask]=counts[rest];}}
  for(const[n,x]of terminalNodes){const offset=n*9;for(let p=0;p<9;p++)v[offset+p]=-x.cost[p];for(const pot of x.pots){let mask=winners[pot.mask];const share=pot.amount/counts[pot.mask];while(mask){const bit=mask&-mask,p=31-Math.clz32(bit);v[offset+p]+=share;mask^=bit;}}}
  return v;
 }
 function forward(policy){reach[0]=1;for(const[n,x]of decisions){const prob=policy(x.info*169+cs[x.actor],x);q[x.info]=prob;reach[x.children[0]]=reach[n]*(1-prob);reach[x.children[1]]=reach[n]*prob;}}
 function backward(onRegret=null){for(let i=decisions.length-1;i>=0;i--){const[n,x]=decisions[i],[a,b]=x.children,prob=q[x.info];for(let p=0;p<9;p++)v[n*9+p]=(1-prob)*v[a*9+p]+prob*v[b*9+p];if(onRegret){const p=x.actor;onRegret(x.info*169+cs[p],reach[n]*(v[a*9+p]-v[n*9+p]),reach[n]*(v[b*9+p]-v[n*9+p]));}}return Array.from(v.subarray(0,9));}
 function evaluate(policy,deal,response=null){prepare(deal);forward(row=>policy[row]??.5);backward();
  // Each player acts once: unilateral gain is the baseline reach times its local action-value difference.
  const gains=new Float64Array(9);if(response)for(const[n,x]of decisions){const row=x.info*169+cs[x.actor],p=x.actor;gains[p]+=reach[n]*((response[row]??policy[row]??.5)-q[x.info])*(v[x.children[1]*9+p]-v[x.children[0]*9+p]);}
  return {values:Array.from(v.subarray(0,9)),gains:Array.from(gains)};
 }
 return {prepare,forward,backward,evaluate,v,reach,q,cs,decisions};
}
export function evaluateOne(policy,deal,response=null){validatePolicy(policy);if(response)validatePolicy(response);return createKernel().evaluate(policy,deal,response);}
