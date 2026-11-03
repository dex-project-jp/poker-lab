// Shared validation and chance model. All EVs use stacks before posting blinds.
import {parseCard} from './hand-evaluator.js';
export function prepareGame({sbHands,bbHands,equity,stackBB,jointWeights}) {
 if(!Number.isFinite(stackBB)||stackBB<=1)throw Error('Invalid stack');
 const n=sbHands?.length,m=bbHands?.length;
 if(!n||!m||equity?.length!==n)throw Error('Dimension mismatch');
 for(const hands of [sbHands,bbHands])for(const h of hands){
  if(!Number.isFinite(h.probability)||h.probability<0)throw Error('Invalid hand probability');
  if(h.cards){if(h.cards.length!==2)throw Error('Invalid hand');const ids=h.cards.map(c=>typeof c==='string'?parseCard(c).id:c);
   if(ids.some(c=>!Number.isInteger(c)||c<0||c>=52)||ids[0]===ids[1])throw Error('Invalid cards');}
 }
 if(jointWeights&&(jointWeights.length!==n||jointWeights.some(row=>row.length!==m)))throw Error('Weight dimension mismatch');
 const weights=new Float64Array(n*m),called=new Float64Array(n*m);let norm=0;
 for(let i=0;i<n;i++){
  if(equity[i]?.length!==m)throw Error('Equity dimension mismatch');
  for(let j=0;j<m;j++){
   const e=equity[i][j],a=sbHands[i].cards,b=bbHands[j].cards;
   if(a&&b){const ids=x=>x.map(c=>typeof c==='string'?parseCard(c).id:c);const ai=ids(a),bi=ids(b);const blocked=ai.some(c=>bi.includes(c));
    if(blocked!==(e===null))throw Error('Equity blocker mask mismatch');}
   const w=jointWeights?jointWeights[i][j]:e===null?0:sbHands[i].probability*bbHands[j].probability;
   if(!Number.isFinite(w)||w<0||(e===null&&w!==0))throw Error('Invalid deal weight');
   if(e!==null&&(!Number.isFinite(e)||e<0||e>1))throw Error('Invalid equity');
   weights[i*m+j]=w;called[i*m+j]=e===null?0:(2*e-1)*stackBB;norm+=w;
  }
 }
 if(!(norm>0)||!Number.isFinite(norm))throw Error('No compatible deals');
 for(let k=0;k<weights.length;k++)weights[k]/=norm;
 return {n,m,weights,called};
}
export function validateStrategy(strategy,length){
 if(strategy?.length!==length||!Array.from(strategy).every(p=>Number.isFinite(p)&&p>=0&&p<=1))throw Error('Invalid strategy');
}
export function evaluateGame(game,sbShove,bbCall){
 const {n,m,weights:w,called:c}=game;validateStrategy(sbShove,n);validateStrategy(bbCall,m);
 let value=0,sbBR=0,bbMin=0;
 for(let i=0;i<n;i++){let fold=0,shove=0;for(let j=0;j<m;j++){const k=i*m+j;fold-=0.5*w[k];shove+=w[k]*(1+bbCall[j]*(c[k]-1));}
  value+=(1-sbShove[i])*fold+sbShove[i]*shove;sbBR+=Math.max(fold,shove);}
 for(let j=0;j<m;j++){let fold=0,call=0;for(let i=0;i<n;i++){const k=i*m+j,p=sbShove[i];fold+=w[k]*(-0.5*(1-p)+p);call+=w[k]*(-0.5*(1-p)+p*c[k]);}bbMin+=Math.min(fold,call);}
 const sbGain=Math.max(0,sbBR-value),bbGain=Math.max(0,value-bbMin),nashGap=sbGain+bbGain;
 return {value,sbBestResponse:sbBR,bbBestResponse:-bbMin,sbGain,bbGain,nashGap,exploitability:nashGap/2};
}
