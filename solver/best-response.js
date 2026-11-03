// Conditional action EVs using the same validated joint chance model as the solver.
import {prepareGame,validateStrategy} from './game.js';
export function bestResponses(options){
 const game=prepareGame(options),{n,m,weights:w,called:c}=game,{sbShove,bbCall}=options;
 validateStrategy(sbShove,n);validateStrategy(bbCall,m);
 const sbEV=[],bbEV=[],sbBest=[],bbBest=[];
 for(let i=0;i<n;i++){
  let sum=0,weight=0;for(let j=0;j<m;j++){const k=i*m+j;weight+=w[k];sum+=w[k]*(1+bbCall[j]*(c[k]-1));}
  if(weight===0){sbEV.push({shove:null,fold:-.5,advantage:null});sbBest.push(null);continue;}
  const shove=sum/weight;sbEV.push({shove,fold:-.5,advantage:shove+.5});sbBest.push(shove>-.5?1:shove<-.5?0:.5);
 }
 for(let j=0;j<m;j++){
  let sum=0,weight=0;for(let i=0;i<n;i++){const k=i*m+j,v=w[k]*sbShove[i];weight+=v;sum-=v*c[k];}
  if(weight===0){bbEV.push({call:null,fold:-1,advantage:null});bbBest.push(null);continue;}
  const call=sum/weight;bbEV.push({call,fold:-1,advantage:call+1});bbBest.push(call>-1?1:call<-1?0:.5);
 }
 return {sbEV,bbEV,sbBest,bbBest};
}
