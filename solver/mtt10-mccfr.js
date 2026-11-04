// Chance-sampled MCCFR: fresh joint hole cards and hidden board; all actions traversed.
// Standard cumulative regrets (NOT noisy clipped CFR+); no multiplayer Nash theorem.
import{dealer,handClass,equityAndPots}from'./mtt10-deck.js';
import{initial,legal,transition,terminal,SEATS}from'./mtt10-game.js';
import{distribute}from'./multiplayer-pots.js';import{handNames}from'./exact-matrix.js';
export const CLASSES=handNames,CLASS_COUNT=169;
export function publicTree(){const nodes=[],infos=[];
 function add(s){const n=nodes.length;nodes.push(null);if(terminal(s)){nodes[n]={actor:-1,state:s,children:[]};return n;}const info=infos.length;infos.push({player:s.actor,history:s.history,node:n});const actions=legal(s),children=actions.map(a=>add(transition(s,a)));nodes[n]={actor:s.actor,state:s,info,actions,children};return n;}add(initial());
 // Precompile chip layers, including returns, without changing the certified settlement module.
 for(const node of nodes)if(node.actor<0){const s=node.state;node.cost=s.live.map((x,p)=>x+s.ante[p]);node.pots=[{amount:s.ante.reduce((a,b)=>a+b),mask:s.folded.reduce((m,f,p)=>m|(!f?1<<p:0),0)}];let before=0;for(const level of [...new Set(s.live.filter(x=>x>0))].sort((a,b)=>a-b)){const payers=SEATS.map((_,p)=>p).filter(p=>s.live[p]>=level),eligible=payers.length===1?payers:payers.filter(p=>!s.folded[p]);node.pots.push({amount:(level-before)*payers.length,mask:eligible.reduce((m,p)=>m|(1<<p),0)});before=level;}}
 return{nodes,infos};
}
export const TREE=publicTree();const ROWS=TREE.infos.length*169;
function vector(size){return new Float64Array(size);}
function winnerMasks(scores){const out=new Int16Array(512),count=new Int8Array(512);for(let mask=1;mask<512;mask++){const bit=mask&-mask,p=31-Math.clz32(bit),rest=mask^bit;if(!rest){out[mask]=bit;count[mask]=1;continue;}const q=31-Math.clz32(out[rest]&-out[rest]);let cmp=0;for(let k=0;k<Math.max(scores[p].length,scores[q].length);k++)if((scores[p][k]||0)!==(scores[q][k]||0)){cmp=Math.sign((scores[p][k]||0)-(scores[q][k]||0));break;}out[mask]=cmp>0?bit:cmp===0?out[rest]|bit:out[rest];count[mask]=cmp>0?1:cmp===0?count[rest]+1:count[rest];}return{out,count};}
export function payoffs(deal){const scores=equityAndPots(deal,initial()).scores,{out,count}=winnerMasks(scores),u=vector(TREE.nodes.length*9);for(let n=0;n<TREE.nodes.length;n++){const x=TREE.nodes[n];if(x.actor>=0)continue;for(let p=0;p<9;p++)u[n*9+p]=-x.cost[p];for(const pot of x.pots){const mask=out[pot.mask],share=pot.amount/count[pot.mask];for(let p=0;p<9;p++)if(mask&(1<<p))u[n*9+p]+=share;}}return u;}
function classes(deal){return deal.hands.map(h=>{const i=CLASSES.indexOf(handClass(h));if(i<0)throw Error('Invalid hand class');return i;});}
function rowFor(node,cs){return node.info*169+cs[node.actor];}
export function validatePolicy(policy){if(policy?.length!==ROWS||policy.some(q=>q!==null&&(!Number.isFinite(q)||q<0||q>1)))throw Error('Invalid 169-class policy');}
function probability(policy,row){return policy[row]??.5;} // Research-only fallback, never app recommendations.
export function evaluateDeal(policy,deal,choices=null){validatePolicy(policy);if(choices&&(choices.length!==ROWS||choices.some(x=>x!==0&&x!==1)))throw Error('Invalid deviation');const cs=classes(deal),v=payoffs(deal),reach=vector(TREE.nodes.length),q=vector(TREE.infos.length);reach[0]=1;
 for(let n=0;n<TREE.nodes.length;n++){const x=TREE.nodes[n];if(x.actor<0)continue;const prob=probability(policy,rowFor(x,cs));q[x.info]=prob;reach[x.children[0]]=reach[n]*(1-prob);reach[x.children[1]]=reach[n]*prob;}
 const d=choices?v.slice():null;
 for(let n=TREE.nodes.length-1;n>=0;n--){const x=TREE.nodes[n];if(x.actor<0)continue;const [a,b]=x.children,prob=q[x.info];for(let p=0;p<9;p++){v[n*9+p]=(1-prob)*v[a*9+p]+prob*v[b*9+p];if(d){const r=p===x.actor?choices[rowFor(x,cs)]:prob;d[n*9+p]=(1-r)*d[a*9+p]+r*d[b*9+p];}}}
 return{values:Array.from(v.slice(0,9)),deviations:d?Array.from(d.slice(0,9)):null,v,reach,cs,q};
}
export function createLearner(seed,{observeDeal=()=>{}}={}){const draw=dealer(seed),regret0=vector(ROWS),regret1=vector(ROWS),sums=vector(ROWS),visits=new Uint32Array(9*169);let iterations=0;
 function step(deal=draw()){
  observeDeal(deal);const cs=classes(deal),v=payoffs(deal),reach=vector(TREE.nodes.length),q=vector(TREE.infos.length);reach[0]=1;
  // Freeze all policies for the entire iteration. Joint chance distribution equals sampling distribution.
  for(let n=0;n<TREE.nodes.length;n++){const x=TREE.nodes[n];if(x.actor<0)continue;const row=rowFor(x,cs),r0=Math.max(0,regret0[row]),r1=Math.max(0,regret1[row]),prob=r0+r1>0?r1/(r0+r1):.5;q[x.info]=prob;reach[x.children[0]]=reach[n]*(1-prob);reach[x.children[1]]=reach[n]*prob;sums[row]+=prob;}
  for(let n=TREE.nodes.length-1;n>=0;n--){const x=TREE.nodes[n];if(x.actor<0)continue;const[a,b]=x.children,prob=q[x.info],p=x.actor,row=rowFor(x,cs);for(let r=0;r<9;r++)v[n*9+r]=(1-prob)*v[a*9+r]+prob*v[b*9+r];regret0[row]+=reach[n]*(v[a*9+p]-v[n*9+p]);regret1[row]+=reach[n]*(v[b*9+p]-v[n*9+p]);}
  // Each player acts once: own reach before every information set is 1, hence conditional chance averages.
  for(let p=0;p<9;p++)visits[p*169+cs[p]]++;iterations++;return Array.from(v.slice(0,9));
 }
 function snapshot(){const sampledRegret=Array(9).fill(0);for(let i=0;i<TREE.infos.length;i++)for(let h=0;h<169;h++)sampledRegret[TREE.infos[i].player]+=Math.max(0,regret0[i*169+h],regret1[i*169+h]);const policy=TREE.infos.flatMap((info,i)=>Array.from({length:169},(_,h)=>{const n=visits[info.player*169+h];return n?Math.round(sums[i*169+h]/n*1e6):null;}));return{iteration:iterations,denominator:1e6,aggressiveWeights:policy,visits:Array.from(visits),sampledPositiveCounterfactualRegretPerIteration:sampledRegret.map(x=>iterations?x/iterations:null),rows:ROWS};}
 return{step,snapshot,get iterations(){return iterations;},audit:()=>({regret0:Array.from(regret0),regret1:Array.from(regret1),sums:Array.from(sums),visits:Array.from(visits)})};
}
export function decodePolicy(snapshot){if(snapshot.denominator!==1e6||snapshot.rows!==ROWS||snapshot.aggressiveWeights?.length!==ROWS||snapshot.aggressiveWeights.some(x=>x!==null&&(!Number.isInteger(x)||x<0||x>1e6)))throw Error('Invalid checkpoint');const policy=snapshot.aggressiveWeights.map(x=>x===null?null:x/1e6);validatePolicy(policy);return policy;}
export function fitResponse(policy,{samples,seed,observeDeal=()=>{}}){validatePolicy(policy);if(!Number.isInteger(samples)||samples<1)throw Error('Invalid fit size');const draw=dealer(seed),a=vector(ROWS),b=vector(ROWS);for(let t=0;t<samples;t++){const d=draw();observeDeal(d);const r=evaluateDeal(policy,d);for(const x of TREE.nodes)if(x.actor>=0){const row=rowFor(x,r.cs);a[row]+=r.reach[TREE.infos[x.info].node]*r.v[x.children[0]*9+x.actor];b[row]+=r.reach[TREE.infos[x.info].node]*r.v[x.children[1]*9+x.actor];}}return{samples,seed,choices:Array.from(a,(x,i)=>b[i]>x?1:0),unseenRows:policy.filter(x=>x===null).length};}
export function evaluateHoldout(policy,choices,{samples,seed,alpha=.05,observeDeal=()=>{}}){if(!Number.isInteger(samples)||samples<2||!Number.isFinite(alpha)||alpha<=0||alpha>=1)throw Error('Invalid evaluation settings');const draw=dealer(seed),sum=vector(9),square=vector(9),base=vector(9),deviations=vector(9);let unseen=0;for(let t=0;t<samples;t++){const d=draw();observeDeal(d);const r=evaluateDeal(policy,d,choices);for(const x of TREE.nodes)if(x.actor>=0&&policy[rowFor(x,r.cs)]===null)unseen++;for(let p=0;p<9;p++){const gain=r.deviations[p]-r.values[p];sum[p]+=gain;square[p]+=gain*gain;base[p]+=r.values[p];deviations[p]+=r.deviations[p];}}
 const radius=180*Math.sqrt(Math.log(18/alpha)/(2*samples));return{samples,seed,alpha,unseenInformationSetEvaluations:unseen,meanValuesBB:Array.from(base,x=>x/samples),meanDeviationValuesBB:Array.from(deviations,x=>x/samples),gains:Array.from(sum,(x,p)=>{const mean=x/samples;return{player:p,meanBB:mean,standardErrorBB:Math.sqrt(Math.max(0,(square[p]-x*x/samples)/(samples-1))/samples),lowerBB:Math.max(-90,mean-radius),upperBB:Math.min(90,mean+radius)};}),hoeffdingRadiusBB:radius,scope:'fixed fitted deviations only; NOT an upper bound on true best response',iidAssumption:'ideal independent uniform draws; deterministic PRNG not an IID proof'};}
export function assertDisjointSeeds(training,fit,evaluation){const seeds=[training,fit,...evaluation];if(new Set(seeds).size!==seeds.length)throw Error('Training/fit/evaluation seeds must be disjoint');for(const seed of seeds)if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid seed');}
