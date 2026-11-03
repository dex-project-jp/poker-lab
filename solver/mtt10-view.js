(function(root){
 const seats=['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'],actions=['All-in','Raise','Call','Check','Fold'];
 function matches(data,spot){const c=data?.certificate,g=data?.config;
  if(data?.schemaVersion!==1||data.quality!=='approximate-computation'||data.scope!=='nine-player-restricted-known-board-only'||data.fullMTTGTO!==false||g?.id!=='mtt9-10bb-known-board-drop-one-v1'||g.players!==9||g.model!=='chipEV'||g.rake!==0||g.icm!==false||g.bounty!==false||g.sbBlind!==.5||g.bbBlind!==1||g.bbAnte!==1||g.chanceTickets!==18||g.rankWorlds!==10||g.boardKnownBeforeBetting!==true||g.actions?.join(',')!=='fold,allin,call'||g.board?.join(',')!=='2c,2d,2h,3c,3d'||g.stacksBeforePostsBB?.some(s=>s!==10)||g.stacksBeforePostsBB?.length!==9||g.seats?.join(',')!==seats.join(',')||!c?.boundVerified||!c.exactRationalVerified||c.unit!=='BB/model-dealt-hand'||c.toleranceBB!==.002||!Number.isFinite(c.epsilonBB)||c.epsilonBB<0||c.epsilonBB>.002)return false;
  try{if(BigInt(c.epsilonDenominator)<=0n||BigInt(c.epsilonNumerator)<0n||BigInt(c.epsilonNumerator)*500n>BigInt(c.epsilonDenominator))return false;}catch{return false;}
  return spot?.players===9&&spot.anteType==='big-blind'&&spot.anteBB===1&&seats.every(p=>spot.stacks?.[p]===10)&&spot.openTo===2&&spot.sbOpenTo===2.5;
 }
 function history(player,scenario,opener=null,caller=null){if(!Number.isInteger(player)||player<0||player>8)return null;
  if(scenario==='open')return Array.from({length:player},(_,seat)=>({seat,kind:'fold'}));
  if(scenario!=='vsshove'||!Number.isInteger(opener)||opener<0||opener>=player||caller!==null&&(!Number.isInteger(caller)||caller<=opener||caller>=player))return null;
  return Array.from({length:player},(_,seat)=>seat===opener?{seat,kind:'allin',to:10}:seat===caller?{seat,kind:'call',to:10}:{seat,kind:'fold'});
 }
 function view(data,spot,player,scenario,opener=null,caller=null){if(!matches(data,spot))return null;const h=history(player,scenario,opener,caller);if(!h)return null;if(scenario==='open'&&player===8)return{state:'walk',history:h,hands:null};const v=data.views?.[player+':'+JSON.stringify(h)];if(!v)return null;
  if(v.player!==player||JSON.stringify(v.history)!==JSON.stringify(h)||Object.values(v.hands||{}).some(r=>!['computed','unreached'].includes(r.status)||!Number.isFinite(r.reachProbability)||r.reachProbability<0||r.reachProbability>1||r.status==='unreached'&&(r.frequencies!==null||r.evBB!==null)))return null;
  if(Object.values(v.hands||{}).some(r=>r.status==='computed'&&(!r.frequencies||!actions.every(a=>Number.isFinite(r.frequencies[a])&&r.frequencies[a]>=0&&r.frequencies[a]<=100)||Math.abs(actions.reduce((s,a)=>s+r.frequencies[a],0)-100)>1e-7||!Number.isFinite(r.evBB))))return null;
  return{...v,state:'approximate'};
 }
 root.PokerLabTenView={seats,matches,history,view};
})(globalThis);
