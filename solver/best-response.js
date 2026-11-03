// Exact best-response EVs for a heads-up push/fold game with combo-specific
// equity. This is a building block, NOT a converged Nash solver.
// hands: [{cards:[0,1], probability: 1/1326}, ...] for each player.
// equity[i][j] = SB showdown equity against BB combo; null for overlaps.
// strategies: SB shove[i], BB call[j] probabilities in [0,1].
export function bestResponses({sbHands,bbHands,equity,stackBB,sbShove,bbCall}){
 if(!Number.isFinite(stackBB)||stackBB<=1)throw Error('Invalid stack');
 if(sbHands.length!==sbShove.length||bbHands.length!==bbCall.length||equity.length!==sbHands.length)throw Error('Dimension mismatch');
 const valid=(p)=>Number.isFinite(p)&&p>=0&&p<=1;
 if(![...sbShove,...bbCall].every(valid))throw Error('Invalid strategy');
 const sbEV=[],bbEV=[],sbBest=[],bbBest=[];
 for(let i=0;i<sbHands.length;i++){
  if(equity[i].length!==bbHands.length)throw Error('Equity dimension mismatch');
  let shoveSum=0,foldSum=0,weight=0;
  for(let j=0;j<bbHands.length;j++){
   const e=equity[i][j];if(e===null)continue;
   if(!valid(e))throw Error('Invalid equity');
   const w=bbHands[j].probability;
   if(!Number.isFinite(w)||w<0)throw Error('Invalid BB probability');
   weight+=w;shoveSum+=w*((1-bbCall[j])*1+bbCall[j]*(2*e-1)*stackBB);
   foldSum+=w*(-0.5);
  }
  if(weight<=0)throw Error('No compatible BB combos');
  const shove=shoveSum/weight,fold=foldSum/weight;
  sbEV.push({shove,fold,advantage:shove-fold});sbBest.push(shove>fold?1:shove<fold?0:0.5);
 }
 for(let j=0;j<bbHands.length;j++){
  let callSum=0,foldSum=0,weight=0;
  for(let i=0;i<sbHands.length;i++){
   const e=equity[i][j];if(e===null)continue;
   const w=sbHands[i].probability*sbShove[i];
   if(!Number.isFinite(w)||w<0)throw Error('Invalid SB probability');
   weight+=w;callSum+=w*(1-2*e)*stackBB;foldSum+=w*(-1);
  }
  if(weight<=0){bbEV.push({call:null,fold:-1,advantage:null});bbBest.push(null);continue}
  const call=callSum/weight,fold=foldSum/weight;
  bbEV.push({call,fold,advantage:call-fold});bbBest.push(call>fold?1:call<fold?0:0.5);
 }
 return {sbEV,bbEV,sbBest,bbBest};
}
