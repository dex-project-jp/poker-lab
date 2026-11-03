// Generated rule audit: coverage/counts only, NOT a poker optimality certificate.
import '../practical-ranges.js';
import '../practical-reraises.js';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const p=globalThis.PokerLabPractical;
function summarize(t){return {hero:t.hero,displayHero:p.display(t.hero),opener:t.opener,scenario:t.scenario,actionComboCounts:t.stats,handCount:Object.keys(t.hands).length,actions:Object.fromEntries([...new Set(Object.values(t.hands).map(h=>h.action))].map(a=>[a,p.hands.filter(h=>t.hands[h].action===a)])),math:t.math};}
const opens=p.positions.slice(0,8).map(hero=>summarize(p.table(hero))),responses=[];
for(let hi=1;hi<9;hi++)for(let oi=0;oi<hi;oi++)responses.push(summarize(p.table(p.positions[hi],'vsopen',p.positions[oi])));
const reraises=[];for(let oi=0;oi<8;oi++)for(let ti=oi+1;ti<9;ti++)for(const [hero,scenario,fourBetAllIn]of [[p.positions[oi],'vs3bet',false],[p.positions[ti],'vs4bet',false],[p.positions[ti],'vs4bet',true]]){const t=PokerLabReraises.table(hero,scenario,p.positions[oi],p.positions[ti],{fourBetAllIn});reraises.push({hero,opener:t.opener,threeBettor:t.threeBettor,scenario,fourBetAllIn,handCount:Object.keys(t.hands).length,actionComboCounts:t.stats,money:t.money});}
const out={schemaVersion:1,metadata:p.metadata,sourceSha256:createHash('sha256').update(readFileSync(new URL('../practical-ranges.js',import.meta.url))).digest('hex'),gtoVerified:false,evCalculated:false,mixedFrequenciesCalculated:false,meaning:'Original editorial categorical recommendations. Counts are exact rule coverage, not action frequencies or strategy validation.',opens,responses,reraises,reraiseSourceSha256:createHash('sha256').update(readFileSync(new URL('../practical-reraises.js',import.meta.url))).digest('hex')};
writeFileSync(new URL('../data/practical30-summary.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log({openPositions:opens.length,responseSpots:responses.length,reraiseSpots:reraises.length,handsPerSpot:169,gtoVerified:false});
