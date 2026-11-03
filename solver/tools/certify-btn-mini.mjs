// Release only inside a separately labelled reduced-game laboratory.
import {buildGame,CONFIG} from '../btn-mini-game.js';
import {exploitability} from '../btn-mini-solver.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir=new URL('../data/',import.meta.url),raw=readFileSync(new URL('btn-mini-candidate.json',dir)),c=JSON.parse(raw),ind=JSON.parse(readFileSync(new URL('btn-mini-independent.json',dir))),g=buildGame(),sha=x=>createHash('sha256').update(x).digest('hex');
if(JSON.stringify(c.config)!==JSON.stringify(CONFIG)||ind.candidateSha256!==sha(raw)||ind.treeSha256!==sha(JSON.stringify(g))||!ind.passed||ind.physicalDealsAudited!==5184||ind.toleranceBB!==1e-5||ind.exactRational?.passed!==true)throw Error('Missing independent reduced-game verification');
const rational=ind.exactRational;if(BigInt(rational.epsilonDenominator)<=0n||BigInt(rational.epsilonNumerator)*100000n>BigInt(rational.epsilonDenominator))throw Error('Exact rational bound fails');
const policy=c.solution.policy.map(row=>{const sum=row.reduce((a,b)=>a+b,0);return row.map(x=>x/sum)});
const e=exploitability(g,policy);
if(e.epsilon>1e-5||ind.epsilon>1e-5||Math.max(...e.bestResponses.map((x,p)=>Math.abs(x-ind.bestResponses[p])))>1e-9)throw Error('Unilateral deviation test failed');
function table(history,player){const rows={};for(let type=0;type<4;type++){
 const i=g.infos.findIndex(x=>x.player===player&&x.type===type&&JSON.stringify(x.history)===JSON.stringify(history));if(i<0)throw Error('Missing node');
 const f={'All-in':0,Raise:0,Call:0,Check:0,Fold:0};g.infos[i].actions.forEach((a,k)=>{f[a.kind==='fold'?'Fold':a.kind==='raise'?'Raise':a.kind==='allin'?'All-in':a.kind==='check'?'Check':'Call']+=100*policy[i][k];});rows[CONFIG.labels[type]]=f;
 }return rows;}
const views=[{id:'btn-open',player:0,history:[],label:'BTN：最初の判断'}, {id:'sb-vs-open',player:1,history:[{seat:0,kind:'raise',to:2}],label:'SB：BTNが2BBオープン'}, {id:'bb-vs-open',player:2,history:[{seat:0,kind:'raise',to:2},{seat:1,kind:'fold'}],label:'BB：BTN2BB・SBフォールド'}].map(v=>({...v,hands:table(v.history,v.player)}));
const out={schemaVersion:1,verified:true,scope:'reduced-fixed-board-game-only',fullMTTGTO:false,config:CONFIG,certificate:{epsilonBB:e.epsilon,nashConvBB:e.nashConv,unit:'BB/dealt-hand',toleranceBB:1e-5,exactRationalVerified:true,independentMethod:ind.method,candidateSha256:sha(raw),treeSha256:ind.treeSha256},views};
writeFileSync(new URL('btn-mini-strategy.js',dir),'// Certified finite laboratory game ONLY. Never import into MTT ranges.\nglobalThis.POKER_LAB_BTN_MINI = '+JSON.stringify(out)+';\n');
writeFileSync(new URL('btn-mini-validation.json',dir),JSON.stringify({scope:out.scope,fullMTTGTO:false,config:CONFIG,nodes:g.nodes.length,informationSets:g.infos.length,rankDeals:24,physicalDeals:5184,search:{algorithm:'simultaneous CFR+; empirical convergence tested, no multiplayer convergence theorem assumed',iterations:c.solution.iterations,selectedIteration:c.solution.iteration,selectedPolicy:c.solution.kind,history:c.solution.history.filter((h,i,a)=>i===0||i===a.length-1||h.iteration%10000===0)},...e,independent:ind,verified:true},null,2)+'\n');
console.log({published:'laboratory only',epsilon:e.epsilon,nashConv:e.nashConv,views:views.length});
