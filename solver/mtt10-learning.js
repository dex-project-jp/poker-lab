import {TREE} from './mtt10-mccfr.js';
import {DECK,random,uniformIndex} from './mtt10-deck.js';
import {createKernel,ROWS} from './mtt10-kernel.js';
export const MODEL='mtt9-10bb-bba1-fold-jam-call-v14';
export const MODES=['uniform','linear'];
// Mulberry32 state is exactly one 32-bit word advanced per consumed random word.
export function resumableDealer(seed,state=seed){random(seed);random(state);let rngState=state;const next=()=>{rngState=(rngState+0x6D2B79F5)>>>0;let t=Math.imul(rngState^(rngState>>>15),rngState|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};return {draw(){const deck=DECK.slice();let cursor=0;const draw=()=>{const j=cursor+uniformIndex(next,52-cursor);[deck[cursor],deck[j]]=[deck[j],deck[cursor]];return deck[cursor++];};return {hands:Array.from({length:9},()=>[draw(),draw()]),board:Array.from({length:5},draw)};},get state(){return rngState;}};}
const fields=['regret0','regret1','rawRegret0','rawRegret1','sums','mass'];
function validateState(s){if(s?.schemaVersion!==1||s.model!==MODEL||!MODES.includes(s.mode)||!Number.isSafeInteger(s.iterations)||s.iterations<0||s.iterations>1e8)throw Error('Incompatible checkpoint');random(s.seed);random(s.rngState);for(const f of fields){if(!Array.isArray(s[f])||s[f].length!==ROWS)throw Error('Checkpoint shape');for(const n of s[f])if(!Number.isFinite(n)||(['mass','sums'].includes(f)&&n<0))throw Error('Nonfinite checkpoint');}if(!Array.isArray(s.visits)||s.visits.length!==1521||s.visits.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Invalid visits');for(let p=0;p<9;p++)if(s.visits.slice(p*169,(p+1)*169).reduce((a,b)=>a+b)!==s.iterations)throw Error('Visit total mismatch');for(let i=0;i<ROWS;i++){if(s.sums[i]>s.mass[i]+1e-8)throw Error('Invalid average mass');const visits=s.visits[TREE.infos[Math.floor(i/169)].player*169+i%169];if((visits===0)!==(s.mass[i]===0))throw Error('Unseen row was filled');}}
export function createTrainer(seed,{mode='linear',checkpoint=null,profile=false}={}){
 if(!MODES.includes(mode))throw Error('Unknown learning mode');random(seed);if(checkpoint){validateState(checkpoint);if(checkpoint.seed!==seed||checkpoint.mode!==mode)throw Error('Seed/mode mismatch');}
 const state=Object.fromEntries(fields.map(f=>[f,new Float64Array(checkpoint?checkpoint[f]:ROWS)])),visits=new Uint32Array(checkpoint?checkpoint.visits:1521),draw=resumableDealer(seed,checkpoint?.rngState??seed),kernel=createKernel();let iterations=checkpoint?.iterations??0,injected=false;
 const timing={dealsMs:0,payoffsMs:0,forwardMs:0,backwardMs:0,steps:0};
 function step(deal){if(iterations>=1e8)throw Error('Iteration limit');if(deal||injected)throw Error('Injected audits cannot continue resumable training');const t=profile?performance.now():0,d=draw.draw();if(profile)timing.dealsMs+=performance.now()-t;return advance(d);}
 function advance(deal){let t=profile?performance.now():0;kernel.prepare(deal);if(profile){timing.payoffsMs+=performance.now()-t;t=performance.now();}
  const weight=mode==='linear'?iterations+1:1;
  kernel.forward(row=>{const a=Math.max(0,state.regret0[row]),b=Math.max(0,state.regret1[row]),q=a+b?b/(a+b):.5;state.sums[row]+=weight*q;state.mass[row]+=weight;return q;});if(profile){timing.forwardMs+=performance.now()-t;t=performance.now();}
  const values=kernel.backward((row,a,b)=>{state.regret0[row]+=weight*a;state.regret1[row]+=weight*b;state.rawRegret0[row]+=a;state.rawRegret1[row]+=b;});if(profile){timing.backwardMs+=performance.now()-t;timing.steps++;}
  for(let p=0;p<9;p++)visits[p*169+kernel.cs[p]]++;iterations++;return values;
 }
 function snapshot(){const regret=Array(9).fill(0);for(let i=0;i<TREE.infos.length;i++)for(let h=0;h<169;h++)regret[TREE.infos[i].player]+=Math.max(0,state.rawRegret0[i*169+h],state.rawRegret1[i*169+h]);return {iteration:iterations,rows:ROWS,denominator:1e6,aggressiveWeights:Array.from(state.sums,(n,i)=>state.mass[i]?Math.round(n/state.mass[i]*1e6):null),visits:Array.from(visits),sampledPositiveCounterfactualRegretPerIteration:regret.map(x=>iterations?x/iterations:null)};}
 function save(){if(injected)throw Error('Injected audits cannot be resumed');return {schemaVersion:1,model:MODEL,seed,mode,rngState:draw.state,iterations,...Object.fromEntries(fields.map(f=>[f,Array.from(state[f])])),visits:Array.from(visits)};}
 return {step,snapshot,save,get iterations(){return iterations;},timing,auditStep:deal=>{injected=true;return advance(deal);}};
}
