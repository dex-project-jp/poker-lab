// Frozen archived research policy; never fills missing live range rows.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {decodePolicy} from '../mtt10-mccfr.js';
import {diagnoseReach,summarizeCoverage,DIAGNOSTIC_MODEL} from '../mtt10-br-coverage.js';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),hash=x=>createHash('sha256').update(x).digest('hex');
const source='data/mccfr-accuracy.json',data=JSON.parse(read(source)),point=data.points.find(p=>p.iterations===1000000||p.iteration===1000000)||data.points.at(-1);
const snapshot=JSON.parse(gunzipSync(Buffer.from(point.averagePolicy.payload,'base64'))),policy=decodePolicy(snapshot);
if(snapshot.iteration!==1000000||data.trainingSeed!==130101)throw Error('Unexpected archived policy');
const sources=Object.fromEntries(['mtt10-br-coverage.js','mtt10-mccfr.js','mtt10-kernel.js','mtt10-deck.js','mtt10-game.js','multiplayer-pots.js','hand-evaluator.js','fast-equity.js','exact-matrix.js','equity-matrix.js','tools/run-mtt10-br-coverage.mjs',source].map(p=>[p,hash(read(p))]));
const query=process.argv.find(x=>x.startsWith('--row='))?.slice(6).split(':').map(Number);
if(query&&(query.length!==2||!query.every(Number.isInteger)))throw Error('Use --row=infoIndex:handClassIndex');
const runs=[160201,160202].map(seed=>{const audit=diagnoseReach(policy,{samples:10000,seed});if(query)console.log(JSON.stringify({seed,info:query[0],handClassIndex:query[1],...audit.row(...query)}));return {seed,samples:10000,...summarizeCoverage(audit)};});
const report={schemaVersion:1,model:DIAGNOSTIC_MODEL,purpose:'counterfactual-reach diagnostics only',gtoVerified:false,exactBestResponse:false,policy:{source,trainingSeed:130101,iterations:snapshot.iteration,sha256:hash(JSON.stringify(policy)),scope:'archived v1.3 research policy; not published v1.5 ranges'},sources,formula:'ESS=(sum w)^2 / sum(w^2); w=counterfactual reach conditional on sampled player hand class',lowEssThresholdMeaning:'30 is a triage heuristic, not a confidence bound or certification threshold',limitations:['No response fitted; no EV, exploitability or convergence improvement claimed.','Each player acts once, so pre-action own reach is one.','ESS measures weight concentration, not outcome variance, absolute reach mass, or unseen rare events.','Floating-point reach underflow is indistinguishable from zero; positive squared weights use scaled moments.','Two independent diagnostic seeds do not prove coverage of all deals.','Normal raises, limps, postflop and ICM excluded.'],runs};
const path=new URL('data/mtt10-br-coverage.json',root),content=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==content)throw Error('Coverage report replay/source mismatch');console.log('Coverage report: both seeds, summaries and source fingerprints match');}else{writeFileSync(path,content);console.log(fileURLToPath(path));}
console.log(JSON.stringify(runs.map(({seed,totals})=>({seed,totals}))));
