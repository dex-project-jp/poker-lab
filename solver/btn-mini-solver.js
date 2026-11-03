// Multiplayer CFR+ is a search procedure, NOT a convergence theorem here.
// Certification uses explicit information-set best responses for all players.
export function checkPolicy(g,policy){if(policy?.length!==g.infos.length)throw Error('Policy dimensions');for(let i=0;i<policy.length;i++){const p=policy[i];if(p.length!==g.infos[i].actions.length||p.some(x=>!Number.isFinite(x)||x<0||x>1)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>1e-10)throw Error('Invalid probabilities');}}
export function evaluate(g,policy){
 checkPolicy(g,policy);const v=new Float64Array(g.nodes.length*3);
 for(let n=g.nodes.length-1;n>=0;n--){const node=g.nodes[n];if(node.actor<0){v.set(node.utility,n*3);continue;}for(let k=0;k<node.children.length;k++)for(let p=0;p<3;p++)v[n*3+p]+=policy[node.info][k]*v[node.children[k]*3+p];}
 return Array.from({length:3},(_,p)=>g.roots.reduce((s,n)=>s+g.chanceProbability*v[n*3+p],0));
}
export function bestResponse(g,policy,player){
 checkPolicy(g,policy);if(![0,1,2].includes(player))throw Error('Invalid player');
 const cf=new Float64Array(g.nodes.length),v=new Float64Array(g.nodes.length),choices={};
 for(const n of g.roots)cf[n]=g.chanceProbability;
 for(let n=0;n<g.nodes.length;n++){const x=g.nodes[n];if(x.actor<0){v[n]=x.utility[player];continue;}for(let k=0;k<x.children.length;k++)cf[x.children[k]]=cf[n]*(x.actor===player?1:policy[x.info][k]);}
 const order=g.infos.map((x,i)=>i).sort((a,b)=>g.infos[b].depth-g.infos[a].depth);
 for(const i of order){const info=g.infos[i];if(info.player===player){
   const a=info.actions.map((_,k)=>info.members.reduce((s,n)=>s+cf[n]*v[g.nodes[n].children[k]],0));let best=0;for(let k=1;k<a.length;k++)if(a[k]>a[best])best=k;choices[i]=best;
   for(const n of info.members)v[n]=v[g.nodes[n].children[best]];
  }else for(const n of info.members){const x=g.nodes[n];v[n]=x.children.reduce((s,c,k)=>s+policy[i][k]*v[c],0);}}
 return {value:g.roots.reduce((s,n)=>s+g.chanceProbability*v[n],0),choices};
}
export function exploitability(g,policy){const values=evaluate(g,policy),responses=[0,1,2].map(p=>bestResponse(g,policy,p).value),gains=responses.map((r,p)=>Math.max(0,r-values[p]));return {values,bestResponses:responses,gains,nashConv:gains.reduce((a,b)=>a+b,0),epsilon:Math.max(...gains),unit:'BB/dealt-hand'};}
export function solve(g,{iterations=200000,target=1e-5,checkEvery=1000}={}){
 if(!Number.isInteger(iterations)||iterations<1||!Number.isInteger(checkEvery)||checkEvery<1||!Number.isFinite(target)||target<=0)throw Error('Invalid solver settings');
 let policy=g.infos.map(x=>Array(x.actions.length).fill(1/x.actions.length));
 const regrets=policy.map(p=>new Float64Array(p.length)),sums=policy.map(p=>new Float64Array(p.length)),den=new Float64Array(policy.length),reach=new Float64Array(g.nodes.length*3),v=new Float64Array(g.nodes.length*3),delta=policy.map(p=>new Float64Array(p.length));
 let best=null;const history=[];
 for(let t=1;t<=iterations;t++){
  for(const n of g.roots){reach[n*3]=reach[n*3+1]=reach[n*3+2]=1;}
  for(let n=0;n<g.nodes.length;n++){const x=g.nodes[n];if(x.actor<0)continue;for(let k=0;k<x.children.length;k++)for(let p=0;p<3;p++)reach[x.children[k]*3+p]=reach[n*3+p]*(p===x.actor?policy[x.info][k]:1);}
  for(const d of delta)d.fill(0);
  for(let n=g.nodes.length-1;n>=0;n--){const x=g.nodes[n];if(x.actor<0){v.set(x.utility,n*3);continue;}v[n*3]=v[n*3+1]=v[n*3+2]=0;
   for(let k=0;k<x.children.length;k++)for(let p=0;p<3;p++)v[n*3+p]+=policy[x.info][k]*v[x.children[k]*3+p];
   const p=x.actor,w=g.chanceProbability*reach[n*3+(p+1)%3]*reach[n*3+(p+2)%3];
   for(let k=0;k<x.children.length;k++)delta[x.info][k]+=w*(v[x.children[k]*3+p]-v[n*3+p]);
  }
  for(let i=0;i<policy.length;i++){const info=g.infos[i],own=reach[info.members[0]*3+info.player],weight=t*own;den[i]+=weight;
   for(let k=0;k<policy[i].length;k++){sums[i][k]+=weight*policy[i][k];regrets[i][k]=Math.max(0,regrets[i][k]+delta[i][k]);}
   const total=regrets[i].reduce((a,b)=>a+b,0);policy[i]=Array.from(regrets[i],x=>total>0?x/total:1/regrets[i].length);
  }
  if(t%checkEvery===0||t===iterations){
   const average=sums.map((s,i)=>Array.from(s,x=>den[i]>0?x/den[i]:1/s.length));
   for(const [kind,p] of [['linear-average',average],['current',policy]]){const ev=exploitability(g,p);if(!best||ev.epsilon<best.epsilon)best={policy:p.map(x=>[...x]),...ev,iteration:t,kind};}
   history.push({iteration:t,epsilon:best.epsilon,nashConv:best.nashConv});
   if(best.epsilon<=target)return {...best,iterations:t,converged:true,history};
  }
 }
 return {...best,iterations,converged:best.epsilon<=target,history};
}
