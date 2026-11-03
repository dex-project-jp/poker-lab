// Heads-up push/fold approximate Nash solver by full-information regret matching.
// Requires an externally validated exact combo-vs-combo equity matrix.
// Input probabilities are unconditional combo deal weights; incompatible pairs use null.
// The solver never labels output verified GTO: check exploitability and independent reference.
import {bestResponses} from './best-response.js';
export function solvePushFold({sbHands,bbHands,equity,stackBB,iterations=10000}){
 if(!Number.isFinite(stackBB)||stackBB<=1)throw Error('Invalid stack');
 const n=sbHands.length,m=bbHands.length;
 if(!Number.isInteger(iterations)||iterations<1||iterations>1000000)throw Error('Invalid iterations');
 if(!n||!m||equity.length!==n)throw Error('Invalid matrix');
 const p=new Float64Array(n).fill(0.5),q=new Float64Array(m).fill(0.5);
 const rp=new Float64Array(n),rq=new Float64Array(m),sumP=new Float64Array(n),sumQ=new Float64Array(m);
 const weights=Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>{
  if(equity[i].length!==m)throw Error('Invalid matrix row');
  const e=equity[i][j];if(e===null)return 0;
  if(!Number.isFinite(e)||e<0||e>1)throw Error('Invalid equity');
  const w=sbHands[i].probability*bbHands[j].probability;
  if(!Number.isFinite(w)||w<0)throw Error('Invalid deal weight');
  return w;
 }));
 let norm=0;for(const row of weights)for(const w of row)norm+=w;
 if(norm<=0)throw Error('No compatible deals');
 for(let t=0;t<iterations;t++){
  const dP=new Float64Array(n),dQ=new Float64Array(m);
  for(let i=0;i<n;i++)for(let j=0;j<m;j++){
   const w=weights[i][j]/norm;if(!w)continue;
   const showdown=(2*equity[i][j]-1)*stackBB;
   // SB payoff: fold=-0.5; shove vs BB fold=+1; shove vs BB call=showdown.
   const sbShove=(1-q[j])*1+q[j]*showdown;
   dP[i]+=w*(sbShove+0.5);
   // BB minimizes SB payoff: compare call vs fold, conditional on SB shove.
   dQ[j]+=w*p[i]*(1-showdown);
  }
  // Positive regret means favor action 1 (SB shove / BB call).
  for(let i=0;i<n;i++){rp[i]+=dP[i];sumP[i]+=p[i]}
  for(let j=0;j<m;j++){rq[j]+=dQ[j];sumQ[j]+=q[j]}
  for(let i=0;i<n;i++)p[i]=rp[i]>0?1:rp[i]<0?0:0.5;
  for(let j=0;j<m;j++)q[j]=rq[j]>0?1:rq[j]<0?0:0.5;
 }
 const sbShove=Array.from(sumP,x=>x/iterations),bbCall=Array.from(sumQ,x=>x/iterations);
 // Nash gap: SB best response gain + BB best response gain, in BB per dealt hand.
 let value=0,sbBR=0,bbBR=0;
 for(let i=0;i<n;i++){
  let fold=0,shove=0;
  for(let j=0;j<m;j++){const w=weights[i][j]/norm;if(!w)continue;
   fold+=w*(-0.5);
   shove+=w*((1-bbCall[j])+bbCall[j]*(2*equity[i][j]-1)*stackBB);
  }
  value+=sbShove[i]*shove+(1-sbShove[i])*fold;
  sbBR+=Math.max(fold,shove);
 }
 for(let j=0;j<m;j++){
  let fold=0,call=0;
  for(let i=0;i<n;i++){const w=weights[i][j]/norm;if(!w)continue;
   const sh=sbShove[i],showdown=(2*equity[i][j]-1)*stackBB;
   fold+=w*((1-sh)*(-0.5)+sh*1);
   call+=w*((1-sh)*(-0.5)+sh*showdown);
  }
  bbBR+=Math.min(fold,call);
 }
 return {sbShove,bbCall,value,nashGap:sbBR-bbBR,iterations,verified:false};
}
