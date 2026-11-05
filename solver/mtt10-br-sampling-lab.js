// Finite sampling experiment ONLY. Never imported by the application or live fitter.
import {distribute} from './multiplayer-pots.js';
import {random} from './mtt10-deck.js';
export const CONFIG=Object.freeze({id:'three-seat-four-pairs-10bb-sampling-lab-v1',seats:['BTN','SB','BB'],stacksBeforePostsBB:[10,10,10],sbBB:.5,bbBB:1,bbAnteBB:1,chipEV:true,icm:false,rake:0,actions:['fold','allin','call'],board:['2c','3d','4h','8c','9d'],boardKnownBeforeBetting:true,handLabels:['AA','KK','QQ','JJ'],rankDeals:24,physicalDeals:5184,scope:'three distinct pair ranks without replacement; six suit combinations each; six early seats and their cards NOT modeled; not full-deck or nine-player MTT'});
export const WORLDS=[];for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++)if(new Set([a,b,c]).size===3)WORLDS.push([a,b,c]);
export const NODES=[],INFOS=[];
function build(s){const n=NODES.length;NODES.push(null);if(s.actor===3||s.folded.filter(x=>!x).length===1){NODES[n]={...s,actor:-1};return n;}const info=INFOS.length;INFOS.push({actor:s.actor,history:s.history,node:n});const children=[0,1].map(action=>{const p=s.actor,live=s.live.slice(),folded=s.folded.slice();if(!action)folded[p]=true;else live[p]=s.jammed?Math.min(Math.max(...live),p===2?9:10):p===2?9:10;return build({actor:p+1,live,folded,jammed:s.jammed||!!action,history:[...s.history,action]});});NODES[n]={...s,info,children};return n;}
build({actor:0,live:[0,.5,1],folded:[false,false,false],jammed:false,history:[]});
export const ROWS=INFOS.length*4;
// INFOS only stores public history; first aggressive action marks an existing jam.
export function fixedPolicy(){return INFOS.flatMap(x=>x.actor===0?[.95,.04,.002,.0001]:x.history.includes(1)?[.8,.03,.001,.0001]:[.9,.08,.003,.0002]);}
function validate(p){if(!Array.isArray(p)||p.length!==ROWS||[...p].some(x=>!Number.isFinite(x)||x<0||x>1||Math.round(x*10000)/10000!==x))throw Error('Complete finite policy on the 1/10000 grid required');}
export function makeTable(policy=fixedPolicy()){
 validate(policy);const frozen=policy.slice();const worlds=WORLDS.map((hand,index)=>{
  const reach=Array(NODES.length).fill(0),values=Array(NODES.length);reach[0]=1;
  for(let n=0;n<NODES.length;n++){const x=NODES[n];if(x.actor<0)continue;const q=frozen[x.info*4+hand[x.actor]];reach[x.children[0]]=reach[n]*(1-q);reach[x.children[1]]=reach[n]*q;}
  for(let n=NODES.length-1;n>=0;n--){const x=NODES[n];if(x.actor<0){values[n]=distribute({live:x.live,ante:[0,0,1],folded:x.folded},hand.map(t=>[1,14-t])).utility;continue;}const [a,b]=x.children,q=frozen[x.info*4+hand[x.actor]];values[n]=values[a].map((v,p)=>(1-q)*v+q*values[b][p]);}
  return {index,hand,values:values[0],rows:INFOS.map((x,info)=>{const n=NODES[x.node];return {row:info*4+hand[x.actor],reach:reach[x.node],delta:values[n.children[1]][x.actor]-values[n.children[0]][x.actor]};})};
 });
 return {policy:frozen,worlds};
}
export function conditionalProposal(table,row){
 if(!Number.isInteger(row)||row<0||row>=ROWS)throw Error('Invalid finite row');const info=Math.floor(row/4),hand=row%4;
 const divisor=10000**INFOS[info].history.length;
 // All supported policies lie on a 1/10000 grid and paths have at most two
 // decisions: exact integer tickets avoid floating CDF quantization bias.
 const entries=table.worlds.filter(w=>w.hand[INFOS[info].actor]===hand).map(w=>({world:w.index,tickets:Math.round(w.rows[info].reach*divisor)}));
 const tickets=entries.reduce((s,e)=>s+e.tickets,0),mass=tickets/(24*divisor);
 return {mass,entries:tickets?entries.filter(e=>e.tickets>0).map(e=>({...e,mass:e.tickets/(24*divisor),probability:e.tickets/tickets})):[]};
}
export function uniformIndex(word,limit){
 if(!Number.isSafeInteger(limit)||limit<1||limit>4294967296)throw Error('Invalid integer lottery');const cutoff=Math.floor(4294967296/limit)*limit;let u;do{u=word();}while(u>=cutoff);return u%limit;
}
function categorical(entries,word){const total=entries.reduce((s,e)=>s+e.tickets,0),u=uniformIndex(word,total);let s=0;for(const e of entries){s+=e.tickets;if(u<s)return e.world;}throw Error('Integer lottery support mismatch');}
export function exactOracle(table){
 const mass=Array(ROWS).fill(0),advantage=Array(ROWS).fill(0);for(const w of table.worlds)for(const r of w.rows){mass[r.row]+=r.reach/24;advantage[r.row]+=r.reach*r.delta/24;}
 const response=advantage.map((a,r)=>mass[r]===0?table.policy[r]:a>0?1:0);return {mass,advantage,response,gains:scoreExact(table,response)};
}
export function scoreWorld(table,response,world){validate(response);const w=table.worlds[world];if(!w)throw Error('Invalid world');const gains=[0,0,0];for(const r of w.rows){const p=INFOS[Math.floor(r.row/4)].actor;gains[p]+=r.reach*(response[r.row]-table.policy[r.row])*r.delta;}return gains;}
export function scoreExact(table,response){const out=[0,0,0];for(const w of table.worlds)scoreWorld(table,response,w.index).forEach((x,p)=>out[p]+=x/24);return out;}
// Both methods spend samples*informationSets row-value lookups; proposal construction
// enumerates known finite chance support and is explicitly NOT a live-game speed claim.
export function fitFinite(table,{method,samples,seed}){
 if(!['joint','conditional'].includes(method)||!Number.isInteger(samples)||samples<4||samples%4!==0)throw Error('Fit samples must be a positive multiple of four');const word=random(seed),sum=Array(ROWS).fill(0),counts=Array(ROWS).fill(0),weights=Array(ROWS).fill(0),squares=Array(ROWS).fill(0);
 if(method==='joint')for(let i=0;i<samples;i++){
  // Rejection avoids modulo bias for the 24 equiprobable rank deals.
  const w=table.worlds[uniformIndex(word,24)];for(const r of w.rows){sum[r.row]+=r.reach*r.delta;weights[r.row]+=r.reach;squares[r.row]+=r.reach*r.reach;counts[r.row]++;}
 }else for(let row=0;row<ROWS;row++){
  const q=conditionalProposal(table,row);if(!q.mass)continue;for(let i=0;i<samples/4;i++){const w=table.worlds[categorical(q.entries,word)],r=w.rows[Math.floor(row/4)];sum[row]+=q.mass*r.delta;counts[row]++;weights[row]+=q.mass;squares[row]+=q.mass*q.mass;}
 }
 const response=sum.map((s,r)=>!counts[r]||!weights[r]?table.policy[r]:s>0?1:0),estimate=sum.map((s,r)=>method==='joint'?s/samples:counts[r]?s/counts[r]:0);
 return {method,samples,seed,rowValueLookups:counts.reduce((a,b)=>a+b),proposalReachLookups:method==='conditional'?24*INFOS.length:0,response,estimate,counts,effectiveSamples:weights.map((s,r)=>squares[r]?s*s/squares[r]:null)};
}
export function evaluateFinite(table,a,b,{samples,seed,alpha=.05}){
 validate(a);validate(b);if(!Number.isInteger(samples)||samples<2||!(alpha>0&&alpha<1))throw Error('Invalid evaluation');const word=random(seed),sum=[0,0,0],square=[0,0,0];
 for(let i=0;i<samples;i++){const w=uniformIndex(word,24),x=scoreWorld(table,a,w),y=scoreWorld(table,b,w);for(let p=0;p<3;p++){const d=x[p]-y[p];sum[p]+=d;square[p]+=d*d;}}
 // Two policies differ in utility by at most 30BB for a single deviating player.
 // Simultaneous two-sided Hoeffding intervals across three seats, ideal IID only.
 const radius=60*Math.sqrt(Math.log(6/alpha)/(2*samples));return {samples,seed,alpha,radiusBB:radius,contrasts:sum.map((s,p)=>({player:p,meanBB:s/samples,standardErrorBB:Math.sqrt(Math.max(0,(square[p]-s*s/samples)/(samples-1))/samples),lowerBB:s/samples-radius,upperBB:s/samples+radius})),scope:'fixed finite-game responses; paired ideal-IID Hoeffding intervals, PRNG is reproducible not true IID; no MTT exploitability bound'};
}
export function selectFinite(table,candidate,selection){if(selection.contrasts?.length!==3)throw Error('Three seats required');const selectedSeats=selection.contrasts.map(x=>x.lowerBB>0);return {response:table.policy.map((q,r)=>selectedSeats[INFOS[Math.floor(r/4)].actor]?candidate[r]:q),selectedSeats};}
export function exactEstimatorVariance(table,row,samples){
 if(!Number.isInteger(samples)||samples<4||samples%4!==0)throw Error('Invalid variance budget');const info=Math.floor(row/4),q=conditionalProposal(table,row);let mean=0,second=0;
 for(const w of table.worlds){const r=w.rows[info];if(r.row===row){mean+=r.reach*r.delta/24;second+=(r.reach*r.delta)**2/24;}}
 if(!q.mass)return {mean,jointVariance:0,conditionalVariance:0};const conditionalSecond=q.entries.reduce((s,e)=>s+e.probability*table.worlds[e.world].rows[info].delta**2,0);
 return {mean,jointVariance:Math.max(0,second-mean*mean)/samples,conditionalVariance:Math.max(0,q.mass*q.mass*conditionalSecond-mean*mean)/(samples/4)};
}
