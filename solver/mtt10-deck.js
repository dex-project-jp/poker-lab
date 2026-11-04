// Full 52-card chance and multiway terminal evaluation. No strategy recommendations.
import {parseCard,compare} from './hand-evaluator.js';
import {fastEvaluate7} from './fast-equity.js';
import {distribute} from './multiplayer-pots.js';
import {initial,legal,transition,terminal,SEATS} from './mtt10-game.js';
export const DECK=Array.from({length:52},(_,i)=>'23456789TJQKA'[i>>2]+'cdhs'[i%4]);
export function handClass(hand){const ids=hand.map(c=>parseCard(c).id).sort((a,b)=>b-a);if(ids.length!==2||ids[0]===ids[1])throw Error('Need distinct hole cards');const a=ids[0]>>2,b=ids[1]>>2;return '23456789TJQKA'[a]+'23456789TJQKA'[b]+(a===b?'':ids[0]%4===ids[1]%4?'s':'o');}
export const COMBOS=DECK.flatMap((a,i)=>DECK.slice(i+1).map(b=>({cards:[a,b],hand:handClass([a,b])})));
// Mulberry32, deterministic reproducibility, not a cryptographic or true-IID source.
export function random(seed){if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('32-bit seed required');let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),a|1);t^=t+Math.imul(t^(t>>>7),t|61);return(t^(t>>>14))>>>0;};}
export function uniformIndex(next,n){if(!Number.isInteger(n)||n<1||n>52)throw Error('Invalid draw bound');const limit=Math.floor(4294967296/n)*n;let x;do{x=next();if(!Number.isInteger(x)||x<0||x>0xffffffff)throw Error('Invalid random word');}while(x>=limit);return x%n;}
export function dealer(seed,{knownHands={},boardPrefix=[]}={}){const next=random(seed),hands=Array.from({length:9},()=>null),fixed=[];
 if(!knownHands||typeof knownHands!=='object'||Array.isArray(knownHands)||!Array.isArray(boardPrefix)||boardPrefix.length>5)throw Error('Invalid conditions');
 for(const [seat,h]of Object.entries(knownHands)){if(!/^[0-8]$/.test(seat)||!Array.isArray(h)||h.length!==2)throw Error('Invalid known hand');hands[+seat]=h.map(c=>DECK[parseCard(c).id]);fixed.push(...hands[+seat]);}
 const prefix=boardPrefix.map(c=>DECK[parseCard(c).id]);fixed.push(...prefix);if(new Set(fixed).size!==fixed.length)throw Error('Overlapping known cards');
 const available=DECK.filter(c=>!fixed.includes(c));
 return()=>{const deck=[...available];let cursor=0;function draw(){const j=cursor+uniformIndex(next,deck.length-cursor);[deck[cursor],deck[j]]=[deck[j],deck[cursor]];return deck[cursor++];}
  const holes=hands.map(h=>h?[...h]:[draw(),draw()]),board=[...prefix];while(board.length<5)board.push(draw());return{hands:holes,board};};
}
export function equityAndPots(deal,state){if(deal.hands?.length!==9||deal.board?.length!==5||deal.hands.some(h=>h?.length!==2)||state.live?.length!==9)throw Error('Nine-player deal required');
 const cards=[...deal.hands.flat(),...deal.board].map(parseCard);if(new Set(cards.map(c=>c.id)).size!==23)throw Error('Overlapping cards, including folded players');
 const scores=deal.hands.map(h=>fastEvaluate7([...h,...deal.board])),active=state.folded.map((f,p)=>!f?p:-1).filter(p=>p>=0);if(!active.length)throw Error('No active player');let best=active[0];for(const p of active)if(compare(scores[p],scores[best])>0)best=p;const winners=active.filter(p=>compare(scores[p],scores[best])===0);
 return{shares:SEATS.map((_,p)=>winners.includes(p)?1/winners.length:0),scores,...distribute(state,scores)};
}
// Bounded means: family-wise Hoeffding intervals under an ideal IID uniform-source assumption.
export function simulate({samples,seed,knownHands={},boardPrefix=[],state,alpha=.05}){if(!Number.isInteger(samples)||samples<1||samples>1e6||!Number.isFinite(alpha)||alpha<=0||alpha>=1)throw Error('Invalid sampling settings');
 const draw=dealer(seed,{knownHands,boardPrefix}),sum=Array(9).fill(0),utility=Array(9).fill(0),squares=Array(9).fill(0);let ties=0;const coverage=new Set(),combos=new Set();
 for(let i=0;i<samples;i++){const d=draw(),r=equityAndPots(d,state);if(r.shares.filter(v=>v>0).length>1)ties++;for(const h of d.hands){coverage.add(handClass(h));combos.add(h.map(c=>parseCard(c).id).sort((a,b)=>a-b).join(','));}for(let p=0;p<9;p++){sum[p]+=r.shares[p];squares[p]+=r.shares[p]**2;utility[p]+=r.utility[p];}}
 const radius=Math.sqrt(Math.log(18/alpha)/(2*samples)),total=state.live.reduce((a,b)=>a+b)+state.ante.reduce((a,b)=>a+b),utilityRadius=total*radius;
 return{samples,seed,knownHands,boardPrefix,state,ties,handClassesSeen:coverage.size,physicalCombosSeen:combos.size,alpha,intervalScope:'simultaneous nine equity means; separate simultaneous nine utility means; ideal IID assumption, PRNG not a proof',equity:sum.map((s,p)=>({mean:s/samples,standardError:samples>1?Math.sqrt(Math.max(0,(squares[p]-s*s/samples)/(samples-1))/samples):null,lower:Math.max(0,s/samples-radius),upper:Math.min(1,s/samples+radius)})),utilityBB:utility.map((s,p)=>({mean:s/samples,lower:Math.max(-state.live[p]-state.ante[p],s/samples-utilityRadius),upper:Math.min(total-state.live[p]-state.ante[p],s/samples+utilityRadius)})),equityRadius:radius,utilityRadiusBB:utilityRadius};
}
// Finite empirical chance adapter for the existing N-player CFR+. Hidden board/opponents never in info keys.
// An exact combo can identify a training ticket: severe empirical overfitting, NOT full-deck equilibrium.
export function buildSampledGame({samples=16,seed=1101}={}){if(!Number.isInteger(samples)||samples<1||samples>256)throw Error('Empirical tree limited to 256 deals');const draw=dealer(seed),deals=Array.from({length:samples},draw),nodes=[],infos=[],map=new Map(),roots=[];
 for(let ticket=0;ticket<deals.length;ticket++){const deal=deals[ticket],scores=equityAndPots(deal,{...initial(),folded:Array(9).fill(false)}).scores;
  function add(s){const id=nodes.length;nodes.push(null);if(terminal(s)){nodes[id]={actor:-1,children:[],utility:distribute(s,scores).utility,state:s,ticket};return id;}
   const p=s.actor,combo=deal.hands[p].map(c=>parseCard(c).id).sort((a,b)=>a-b).join(','),key=p+':'+combo+':'+JSON.stringify(s.history);let info=map.get(key);if(info===undefined){info=infos.length;map.set(key,info);infos.push({player:p,combo,history:s.history,actions:legal(s),key,members:[],depth:s.history.length,parentSequence:null});}
   const children=legal(s).map(a=>add(transition(s,a)));nodes[id]={actor:p,info,children,state:s,ticket};infos[info].members.push(id);return id;
  }roots.push(add(initial()));
 }
 return{players:9,nodes,infos,roots,chanceProbability:1/samples,deals,scope:'finite-empirical-full-deck-tickets-only',boardKnownBeforeBetting:false};
}
