// EXACT finite 3-player test game, NOT the full NLHE/9-max MTT game.
// Private pair RANKS are dealt without replacement from AA/KK/QQ/JJ.
// Each rank has all six equally likely suit combos; identical fixed-board payoffs
// and independent suits allow exact reduction from 5,184 deals to 24 rank deals.
// The fixed board is known before betting. After preflop all hands check down.
import {fastEvaluate7} from './fast-equity.js';
import {compare} from './hand-evaluator.js';
export const CONFIG=Object.freeze({id:'btn-sb-bb-fixed-board-v1',privateHandModel:'Three distinct pair ranks out of AA/KK/QQ/JJ; all six suit combos per pair, independent and uniform',physicalDeals:5184,rankDeals:24,earlyFolds:'Six prior seats are forced folds; their cards and bunching are not modeled',stackBB:30,sbBlind:.5,bbBlind:1,bbAnte:1,maxRaises:2,openToBB:2,sbOpenToBB:2.5,bbVsLimpToBB:3,threeBetToBB:7,board:['2c','3d','4h','8c','9d'],hands:[['As','Ah'],['Ks','Kh'],['Qs','Qh'],['Js','Jh']],labels:['AA','KK','QQ','JJ'],seats:['BTN','SB','BB']});
export function pairCombos(type){const rank='AKQJ'[type],suits='cdhs',out=[];if(!Number.isInteger(type)||type<0||type>3)throw Error('Invalid hand type');for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)out.push([rank+suits[a],rank+suits[b]]);return out;}
export function initial(){return {live:[0,.5,1],ante:[0,0,1],folded:[false,false,false],pending:[true,true,true],canRaise:[true,true,true],actor:0,raises:0,lastFullRaise:1,history:[]};}
const remaining=(s,p)=>30-s.ante[p]-s.live[p];
export function terminal(s){return s.folded.filter(f=>!f).length<=1||s.actor===null;}
export function legal(s){
 if(terminal(s))return [];
 const p=s.actor,high=Math.max(...s.live),call=high-s.live[p],out=[];
 if(call>0)out.push({kind:'fold'});
 // BTN open limping is excluded; a check or response call is allowed elsewhere.
 if(!(s.history.length===0&&p===0))out.push({kind:call>0?'call':'check',to:Math.min(high,30-s.ante[p])});
 const can=s.canRaise[p]&&s.raises<2&&s.folded.some((f,q)=>q!==p&&!f&&remaining(s,q)>0);
 if(can){
  const size=s.raises===0?(p===0?2:p===1?2.5:3):7;
  if(size>=high+s.lastFullRaise&&size<30-s.ante[p])out.push({kind:'raise',to:size});
  const cap=30-s.ante[p];if(cap>high)out.push({kind:'allin',to:cap});
 }
 return out;
}
export function transition(s,action){
 const a=legal(s).find(a=>a.kind===action.kind&&a.to===action.to);if(!a)throw Error('Illegal action');
 const n={...s,live:[...s.live],ante:[...s.ante],folded:[...s.folded],pending:[...s.pending],canRaise:[...s.canRaise],history:[...s.history,{seat:s.actor,...a}]},p=s.actor,high=Math.max(...s.live);
 n.pending[p]=false;n.canRaise[p]=false;
 if(a.kind==='fold')n.folded[p]=true;
 else {n.live[p]=a.to;
  if(a.to>high){const delta=a.to-high,full=delta>=s.lastFullRaise;n.raises++;if(full)n.lastFullRaise=delta;
   for(let q=0;q<3;q++)if(q!==p&&!n.folded[q]&&remaining(n,q)>0){n.pending[q]=true;if(full)n.canRaise[q]=true;}
  }
 }
 const active=n.folded.map((f,q)=>!f?q:-1).filter(q=>q>=0);
 if(active.length<=1){n.actor=null;return n;}
 for(let q=0;q<3;q++)if(n.folded[q]||remaining(n,q)<=0)n.pending[q]=false;
 // A lone player with chips and nothing to call has no opponent to bet into.
 const movable=active.filter(q=>remaining(n,q)>0),newHigh=Math.max(...n.live);
 if(movable.length===1&&n.live[movable[0]]===newHigh)n.pending[movable[0]]=false;
 n.actor=null;for(let k=1;k<=3;k++){const q=(p+k)%3;if(n.pending[q]){n.actor=q;break;}}
 return n;
}
export function deals(){const out=[];for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++)if(a!==b&&a!==c&&b!==c)out.push([a,b,c]);return out;}
const scores=CONFIG.hands.map(h=>fastEvaluate7([...h,...CONFIG.board]));
export function settlement(s,deal){
 if(!terminal(s))throw Error('Nonterminal state');
 if(deal.length!==3||new Set(deal).size!==3||deal.some(d=>!Number.isInteger(d)||d<0||d>3))throw Error('Invalid deal');
 const active=s.folded.map((f,p)=>!f?p:-1).filter(p=>p>=0),awards=[0,0,0],pots=[];
 const winners=eligible=>{let best=eligible[0];for(const p of eligible)if(compare(scores[deal[p]],scores[deal[best]])>0)best=p;return eligible.filter(p=>compare(scores[deal[p]],scores[deal[best]])===0);};
 // Antes are dead money, NOT part of a player's live all-in cap.
 const dead=s.ante.reduce((a,b)=>a+b,0);
 const levels=[...new Set(s.live.filter(x=>x>0))].sort((a,b)=>a-b);let prev=0;
 for(const level of levels){const payers=s.live.map((x,p)=>x>=level?p:-1).filter(p=>p>=0),eligible=payers.filter(p=>!s.folded[p]);
  if(!eligible.length)throw Error('Unclaimable side pot');const amount=(level-prev)*payers.length+(prev===0?dead:0),win=active.length===1?active:winners(eligible);
  for(const p of win)awards[p]+=amount/win.length;pots.push({amount,eligible,winners:win,uncalled:payers.length===1});prev=level;
 }
 const utility=awards.map((x,p)=>x-s.live[p]-s.ante[p]);
 if(Math.abs(utility.reduce((a,b)=>a+b,0))>1e-10)throw Error('Chip conservation failure');
 return {awards,utility,pots};
}
export function buildGame(){
 const chance=deals(),nodes=[],infos=[],map=new Map(),roots=[];
 function add(s,d,ownSequence){
  const id=nodes.length;nodes.push(null);
  if(terminal(s)){nodes[id]={actor:-1,children:[],utility:settlement(s,d).utility,state:s,deal:d};return id;}
  const p=s.actor,key=p+':'+d[p]+':'+JSON.stringify(s.history),actions=legal(s);
  let info=map.get(key);if(info===undefined){info=infos.length;map.set(key,info);infos.push({player:p,type:d[p],history:s.history,actions,key,members:[],depth:s.history.length,parentSequence:ownSequence[p]});}
  const children=actions.map((a,k)=>{const seq=[...ownSequence];seq[p]=[info,k];return add(transition(s,a),d,seq);});
  nodes[id]={actor:p,info,children,state:s,deal:d};infos[info].members.push(id);return id;
 }
 for(const d of chance)roots.push(add(initial(),d,[null,null,null]));
 return {config:CONFIG,nodes,infos,roots,chanceProbability:1/chance.length};
}
