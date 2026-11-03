// Independent JS evaluator + physical card dealing; checks native exact matrix aggregation.
// This is a reproducible numerical sanity check, not a poker strategy proof.
import '../practical-ranges.js';import '../data/practical-audit-equities.js';
import {fastEvaluate7}from'../fast-equity.js';import {compare}from'../hand-evaluator.js';
import {readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const deck=[...'23456789TJQKA'].flatMap(r=>[...'cdhs'].map(s=>r+s)),ranks='23456789TJQKA';
const name=(a,b)=>{const ra=ranks.indexOf(a[0]),rb=ranks.indexOf(b[0]);return ra===rb?a[0]+b[0]:ra>rb?a[0]+b[0]+(a[1]===b[1]?'s':'o'):b[0]+a[0]+(a[1]===b[1]?'s':'o');};
let seed=0x591a8e31;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const N=60000,cases=[...['QQ','AKo','AQs','JJ','22','A5s','KQo','KJs','QJs'].map(h=>[h,'value']),['AKs','tight']],results=[];
for(const [hand,model]of cases){
 const hero=hand.length===2?[hand[0]+'c',hand[0]+'d']:[hand[0]+'c',hand[1]+(hand.endsWith('s')?'c':'d')],remaining=deck.filter(c=>!hero.includes(c)),allowed=new Set(POKER_LAB_AUDIT_EQUITIES.models[model].range),villains=[];
 for(let i=0;i<remaining.length;i++)for(let j=i+1;j<remaining.length;j++)if(allowed.has(name(remaining[i],remaining[j])))villains.push([remaining[i],remaining[j]]);
 const pools=villains.map(v=>remaining.filter(c=>!v.includes(c)));let halfPots=0;
 for(let n=0;n<N;n++){const vi=Math.floor(random()*villains.length),v=villains[vi],pool=pools[vi],chosen=[];while(chosen.length<5){const k=Math.floor(random()*48);if(!chosen.includes(k))chosen.push(k);}const board=chosen.map(k=>pool[k]);const d=compare(fastEvaluate7([...hero,...board]),fastEvaluate7([...v,...board]));halfPots+=d>0?2:d===0?1:0;}
 const e=POKER_LAB_AUDIT_EQUITIES.models[model].hands[hand],exact=e.halfPots/(2*1712304*e.compatibleDeals),sample=halfPots/(2*N),tolerance=Math.sqrt(Math.log(2*cases.length/.001)/(2*N));
 const row={hand,model,hero,compatibleVillainCombos:villains.length,samples:N,sampleEquity:sample,exactEquity:exact,absoluteError:Math.abs(sample-exact),nominalSimultaneousErrorBound:tolerance,passed:Math.abs(sample-exact)<=tolerance};
 if(!row.passed)throw Error('Independent sampling discrepancy '+JSON.stringify(row));results.push(row);console.log({hand,model,exact,sample,error:row.absoluteError});
}
const sourceSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const out={method:'Independent physical combo rejection sampling and JS evaluator vs native exhaustive matrix counts',seedHex:'591a8e31',sourceSha256,matrixSha256:POKER_LAB_AUDIT_EQUITIES.matrixSha256,warning:'Monte Carlo check only. Error bound assumes independent uniform samples; seeded PRNG is used. Exact actions use integer enumeration counts, never the samples.',results};
const path=new URL('../data/practical-audit-monte-carlo.json',import.meta.url),content=JSON.stringify(out,null,2)+'\n';if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==content)throw Error('Stale independent check');}else writeFileSync(path,content);
