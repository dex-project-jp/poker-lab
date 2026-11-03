// Alternating CFR+, with linear averaging. A numerical convergence flag is not
// permission to publish: equity provenance and independent validation are separate.
import {prepareGame,evaluateGame} from './game.js';
export function solvePushFold(options){
 const {iterations=10000,targetGap=0,checkEvery=50}=options;
 if(!Number.isInteger(iterations)||iterations<1||iterations>1000000)throw Error('Invalid iterations');
 if(!Number.isFinite(targetGap)||targetGap<0||!Number.isInteger(checkEvery)||checkEvery<1)throw Error('Invalid convergence options');
 const game=prepareGame(options),{n,m,weights:w,called:c}=game;
 const p=new Float64Array(n).fill(.5),q=new Float64Array(m).fill(.5),rp=new Float64Array(n),rf=new Float64Array(n),rq=new Float64Array(m),rs=new Float64Array(m),sp=new Float64Array(n),sq=new Float64Array(m);
 let total=0,result,t=0;const history=[];
 for(t=1;t<=iterations;t++){
  for(let i=0;i<n;i++){
   let advantage=0;for(let j=0;j<m;j++){const k=i*m+j;advantage+=w[k]*(1.5+q[j]*(c[k]-1));}
   rp[i]=Math.max(0,rp[i]+(1-p[i])*advantage);rf[i]=Math.max(0,rf[i]-p[i]*advantage);
   p[i]=rp[i]+rf[i]>0?rp[i]/(rp[i]+rf[i]):.5;
  }
  for(let j=0;j<m;j++){
   let advantage=0;for(let i=0;i<n;i++){const k=i*m+j;advantage+=w[k]*p[i]*(1-c[k]);}
   rq[j]=Math.max(0,rq[j]+(1-q[j])*advantage);rs[j]=Math.max(0,rs[j]-q[j]*advantage);
   q[j]=rq[j]+rs[j]>0?rq[j]/(rq[j]+rs[j]):.5;
  }
  total+=t;for(let i=0;i<n;i++)sp[i]+=t*p[i];for(let j=0;j<m;j++)sq[j]+=t*q[j];
  if(t%checkEvery===0||t===iterations){
   const sbShove=Array.from(sp,x=>x/total),bbCall=Array.from(sq,x=>x/total);
   result={sbShove,bbCall,...evaluateGame(game,sbShove,bbCall)};
   history.push({iterations:t,nashGap:result.nashGap});
   if(targetGap>0&&result.nashGap<=targetGap)break;
  }
 }
 return {...result,iterations:Math.min(t,iterations),converged:targetGap>0&&result.nashGap<=targetGap,history,verified:false};
}
