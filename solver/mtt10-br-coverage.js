// Counterfactual-reach diagnostics only. Does not fit a response or change a strategy.
import {TREE,CLASSES,validatePolicy} from './mtt10-mccfr.js';
import {dealer} from './mtt10-deck.js';
import {createKernel,ROWS} from './mtt10-kernel.js';
export const DIAGNOSTIC_MODEL='mtt9-10bb-bba1-fold-jam-call-v14';
export const DEFAULT_LOW_ESS=30; // Display heuristic, never a GTO / statistical acceptance threshold.
export function createReachMoments(size){
 if(!Number.isSafeInteger(size)||size<1||size>ROWS)throw Error('Invalid moment size');
 const scale=new Float64Array(size),sum=new Float64Array(size),square=new Float64Array(size),positive=new Uint32Array(size);
 function add(row,weight){
  if(!Number.isInteger(row)||row<0||row>=size||!Number.isFinite(weight)||weight<0||weight>1)throw Error('Invalid counterfactual reach');
  if(weight===0)return;
  if(positive[row]===0xffffffff)throw Error('Moment counter overflow');
  if(weight>scale[row]){const ratio=scale[row]/weight;sum[row]=sum[row]*ratio+1;square[row]=square[row]*ratio*ratio+1;scale[row]=weight;}
  else{const ratio=weight/scale[row];sum[row]+=ratio;square[row]+=ratio*ratio;}
  positive[row]++;
 }
 function at(row){
  if(!Number.isInteger(row)||row<0||row>=size)throw Error('Invalid moment row');
  if(!positive[row])return {nonzeroSamples:0,sumReach:0,sumSquaredReach:0,logSumSquaredReach:null,squaredSumUnderflow:false,effectiveSamples:null};
  const raw=sum[row]*(sum[row]/square[row]),tolerance=1e-10*(positive[row]+1);
  if(raw<1-tolerance||raw>positive[row]+tolerance)throw Error('Inconsistent ESS moments');
  const sumSquaredReach=scale[row]*(scale[row]*square[row]);
  return {nonzeroSamples:positive[row],sumReach:scale[row]*sum[row],sumSquaredReach,logSumSquaredReach:2*Math.log(scale[row])+Math.log(square[row]),squaredSumUnderflow:sumSquaredReach===0,effectiveSamples:Math.min(positive[row],Math.max(1,raw))};
 }
 function snapshot(){return {scale:Array.from(scale),scaledSum:Array.from(sum),scaledSquareSum:Array.from(square),nonzeroSamples:Array.from(positive)};}
 return {add,at,snapshot};
}
export function describeCoverage(observations,moments,lowEssThreshold=DEFAULT_LOW_ESS){
 if(!Number.isSafeInteger(observations)||observations<0||!Number.isFinite(lowEssThreshold)||lowEssThreshold<1)throw Error('Invalid coverage settings');
 if(moments.nonzeroSamples>observations)throw Error('Reach count exceeds class samples');
 const status=observations===0?'no-class-samples':moments.nonzeroSamples===0?'zero-reach':moments.effectiveSamples<lowEssThreshold?'low-ess':'diagnostic-only';
 return {classSamples:observations,...moments,status};
}
export function createCoverageAudit(policy,{lowEssThreshold=DEFAULT_LOW_ESS}={}){
 validatePolicy(policy);for(const q of policy)if(!Number.isFinite(q)||q<0||q>1)throw Error('Fully specified policy required; no missing-row fallback');
 if(!Number.isFinite(lowEssThreshold)||lowEssThreshold<1)throw Error('Invalid ESS threshold');
 const fixed=Float64Array.from(policy),kernel=createKernel(),moments=createReachMoments(ROWS),classSamples=new Uint32Array(9*169);let samples=0;
 function observe(deal){
  if(samples>=1000000)throw Error('Diagnostic sample limit');
  kernel.prepare(deal);kernel.forward(row=>fixed[row]);
  for(let p=0;p<9;p++)classSamples[p*169+kernel.cs[p]]++;
  for(const[n,node]of kernel.decisions)moments.add(node.info*169+kernel.cs[node.actor],kernel.reach[n]);
  samples++;
 }
 function row(info,hand){if(!Number.isInteger(info)||info<0||info>=510||!Number.isInteger(hand)||hand<0||hand>=169)throw Error('Invalid information set');return describeCoverage(classSamples[TREE.infos[info].player*169+hand],moments.at(info*169+hand),lowEssThreshold);}
 function snapshot(){return {samples,lowEssThreshold,classSamples:Array.from(classSamples),moments:moments.snapshot()};}
 return {observe,row,snapshot,get samples(){return samples;},lowEssThreshold};
}
export function diagnoseReach(policy,{samples,seed,lowEssThreshold=DEFAULT_LOW_ESS}){
 if(!Number.isInteger(samples)||samples<1||samples>1000000)throw Error('Invalid sample count');
 const draw=dealer(seed),audit=createCoverageAudit(policy,{lowEssThreshold});for(let i=0;i<samples;i++)audit.observe(draw());return audit;
}
export function summarizeCoverage(audit,{exampleLimit=12}={}){
 if(!Number.isInteger(exampleLimit)||exampleLimit<0||exampleLimit>100)throw Error('Invalid example limit');
 const positions=Array.from({length:9},(_,player)=>({player,rows:0,noClassSamples:0,zeroReach:0,lowEss:0,diagnosticOnly:0,minPositiveESS:null,medianPositiveESS:null})),ess=Array.from({length:9},()=>[]),examples=[];
 for(let i=0;i<TREE.infos.length;i++)for(let h=0;h<169;h++){
  const r=audit.row(i,h),info=TREE.infos[i],p=positions[info.player];p.rows++;
  if(r.status==='no-class-samples')p.noClassSamples++;else if(r.status==='zero-reach')p.zeroReach++;else if(r.status==='low-ess')p.lowEss++;else p.diagnosticOnly++;
  if(r.effectiveSamples!==null)ess[info.player].push(r.effectiveSamples);
  if(r.status!=='diagnostic-only'&&examples.length<exampleLimit)examples.push({info:i,player:info.player,hand:CLASSES[h],history:info.history,...r});
 }
 for(let p=0;p<9;p++)if(ess[p].length){ess[p].sort((a,b)=>a-b);positions[p].minPositiveESS=ess[p][0];const mid=Math.floor(ess[p].length/2);positions[p].medianPositiveESS=ess[p].length%2?ess[p][mid]:(ess[p][mid-1]+ess[p][mid])/2;}
 return {rows:ROWS,lowEssThreshold:audit.lowEssThreshold,positions,totals:{noClassSamples:positions.reduce((s,p)=>s+p.noClassSamples,0),zeroReach:positions.reduce((s,p)=>s+p.zeroReach,0),lowEss:positions.reduce((s,p)=>s+p.lowEss,0),diagnosticOnly:positions.reduce((s,p)=>s+p.diagnosticOnly,0)},examples};
}
