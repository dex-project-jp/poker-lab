// Nine-player finite laboratory game. NOT full-deck 10BB MTT GTO.
import{distribute}from'./multiplayer-pots.js';
import {fastEvaluate7}from'./fast-equity.js';import{compare}from'./hand-evaluator.js';
export const SEATS=['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'];
export const LABELS=['AA','KK','QQ','JJ','TT','99','88','77','66','55'];
export const CONFIG=Object.freeze({id:'mtt9-10bb-known-board-drop-one-v1',players:9,seats:SEATS,stacksBeforePostsBB:Array(9).fill(10),sbBlind:.5,bbBlind:1,bbAnte:1,model:'chipEV',rake:0,icm:false,bounty:false,
 board:['2c','2d','2h','3c','3d'],boardKnownBeforeBetting:true,privateHandModel:'18 equiprobable chance tickets over 10 distinct rank worlds: world 0 (UTG has 55) has 9 tickets, worlds 1..9 one ticket each. In world w<9 seat w has 55 instead of its base pair; world 9 is the base AA..66 allocation. Each pair has six equally weighted suit combos.',rankWorlds:10,chanceTickets:18,physicalDeals:'100776960',chanceReduction:'10 distinct worlds * 6^9; chance weights 9:1:1:1:1:1:1:1:1:1; pair ranks across seats and board are disjoint, suits have identical showdown order',actions:['fold','allin','call'],overcalls:true,postflop:'none; known board showdown',fullDeckGTO:false});
export function pairCombos(type){if(!Number.isInteger(type)||type<0||type>=10)throw Error('Invalid hand type');const rank=LABELS[type][0],s='cdhs',out=[];for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)out.push([rank+s[a],rank+s[b]]);return out;}
export function worlds(){return Array.from({length:10},(_,w)=>Array.from({length:9},(_,p)=>w===p?9:p));}
const scores=LABELS.map((_,t)=>fastEvaluate7([...pairCombos(t)[0],...CONFIG.board]));
export function initial(stacks=CONFIG.stacksBeforePostsBB){if(stacks.length!==9||stacks.some((s,p)=>!Number.isFinite(s)||s<=(p===8?2:p===7?.5:0)))throw Error('Stacks must cover forced bets');return {stacks:[...stacks],live:[0,0,0,0,0,0,0,.5,1],ante:[0,0,0,0,0,0,0,0,1],folded:Array(9).fill(false),actor:0,jammer:null,history:[]};}
export const remaining=(s,p)=>s.stacks[p]-s.ante[p]-s.live[p];
export function terminal(s){return s.actor===null;}
export function legal(s){if(terminal(s))return[];const p=s.actor,cap=s.stacks[p]-s.ante[p];return s.jammer===null?[{kind:'fold'},{kind:'allin',to:cap}]:[{kind:'fold'},{kind:'call',to:Math.min(Math.max(...s.live),cap)}];}
export function transition(s,action){const p=s.actor,a=legal(s).find(x=>x.kind===action.kind&&x.to===action.to);if(!a)throw Error('Illegal action');const n={...s,live:[...s.live],ante:[...s.ante],stacks:[...s.stacks],folded:[...s.folded],history:[...s.history,{seat:p,...a}]};
 if(a.kind==='fold')n.folded[p]=true;else{n.live[p]=a.to;if(a.kind==='allin')n.jammer=p;}
 n.actor=p===8?null:p+1;
 if(n.folded.filter(x=>!x).length<=1)n.actor=null;
 return n;
}
export function settlement(s,deal){if(!terminal(s)||deal?.length!==9||new Set(deal).size!==9||deal.some(t=>!Number.isInteger(t)||t<0||t>=10))throw Error('Invalid terminal/deal');
 return distribute(s,deal.map(t=>scores[t]));
}

export function buildGame(){const nodes=[],infos=[],map=new Map(),roots=[];
 function add(s,d){const id=nodes.length;nodes.push(null);if(terminal(s)){nodes[id]={actor:-1,children:[],utility:settlement(s,d).utility,state:s,deal:d};return id;}
 const p=s.actor,key=p+':'+d[p]+':'+JSON.stringify(s.history),actions=legal(s);let info=map.get(key);if(info===undefined){info=infos.length;map.set(key,info);infos.push({player:p,type:d[p],history:s.history,actions,key,members:[],depth:s.history.length,parentSequence:null});}
 const children=actions.map(a=>add(transition(s,a),d));nodes[id]={actor:p,info,children,state:s,deal:d};infos[info].members.push(id);return id;}
 const chance=worlds();for(const w of [...Array(9).fill(0),1,2,3,4,5,6,7,8,9])roots.push(add(initial(),chance[w]));return{config:CONFIG,players:9,nodes,infos,roots,chanceProbability:1/18};}
