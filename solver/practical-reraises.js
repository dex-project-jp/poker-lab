// Original conditional reference rules. This is not a solved game or frequency dataset.
(function(root){
 const p=root.PokerLabPractical;if(!p)return;
 const positions=p.positions,index=x=>positions.indexOf(p.alias(x));
 const blind=x=>x==='SB'?.5:x==='BB'?1:0,ante=x=>x==='BB'?1:0,cap=x=>30-ante(x);
 const metadata={id:'poker-lab-original-reraises-30bb-v1',kind:'original-strategy-design',gtoVerified:false,frequencyModel:'none',license:'Original Poker Lab rules; no third-party chart or frequency data copied'};
 function roles(hero,scenario,opener){hero=p.alias(hero);opener=p.alias(opener);const hi=index(hero);
  if(hi<0)return {openers:[],threeBettors:[]};
  if(scenario==='vs3bet')return {openers:hi<8?[hero]:[],threeBettors:positions.slice(hi+1)};
  if(scenario==='vs4bet')return {openers:positions.slice(0,hi),threeBettors:hi>0?[hero]:[]};
  if(scenario==='cold4bet'){const openers=positions.slice(0,Math.max(0,hi-1));return {openers,threeBettors:openers.includes(opener)?positions.slice(index(opener)+1,hi):[]};}
  return {openers:[],threeBettors:[]};
 }
 function validPair(opener,bettor){return index(opener)>=0&&index(bettor)>index(opener);}
 // Heads-up continuation of a nine-seat hand: all uninvolved players have folded.
 // Ante is dead money, not part of any player's live bet or call contribution.
 function ledger(opener,bettor,stage=3,fourBetAllIn=false){
  opener=p.alias(opener);bettor=p.alias(bettor);if(!validPair(opener,bettor)||![3,4].includes(stage))return null;
  const openTo=opener==='SB'?2.5:2,threeTo=opener==='SB'?8:['SB','BB'].includes(bettor)?7:6;
  const fourTo=fourBetAllIn?cap(opener):14;
  const bets={[opener]:stage===3?openTo:fourTo,[bettor]:threeTo};
  const dead=2.5-blind(opener)-blind(bettor),pot=dead+bets[opener]+bets[bettor];
  const hero=stage===3?opener:bettor,opponent=stage===3?bettor:opener;
  const maximum=bets[opponent],lastRaise=stage===3?threeTo-openTo:fourTo-threeTo;
  const callTo=Math.min(maximum,cap(hero)),additional=callTo-bets[hero],returned=Math.max(0,maximum-cap(hero));
  return {opener,threeBettor:bettor,hero,opponent,stage,openToBB:openTo,threeBetToBB:threeTo,fourBetToBB:fourTo,
   liveBetsBB:bets,liveCapsBB:{[opener]:cap(opener),[bettor]:cap(bettor)},deadMoneyBB:dead,potBeforeActionBB:pot,
   remainingBB:{[opener]:cap(opener)-bets[opener],[bettor]:cap(bettor)-bets[bettor]},
   minimumRaiseToBB:maximum+lastRaise,opponentAllIn:maximum===cap(opponent),
   call:{toBB:callTo,additionalBB:additional,uncalledReturnBB:returned,potAfterCallBB:pot+additional-returned,remainingBB:cap(hero)-callTo,rawEquityThreshold:additional/(pot+additional-returned)}};
 }
 function outcome(l,action,toBB=null){
  if(!l||!['Fold','Call','4-bet','4-bet All-in','5-bet All-in'].includes(action))throw Error('Unsupported action');
  const hero=l.hero,opp=l.opponent,before=l.liveBetsBB[hero],target=action==='Fold'?before:action==='Call'?l.call.toBB:toBB;
  if(!Number.isFinite(target)||target<before||target>cap(hero))throw Error('Invalid total bet');
  if(action.includes('bet')){
   if(l.opponentAllIn||target<l.minimumRaiseToBB)throw Error('Illegal raise');
   if(action.includes('All-in')&&target!==cap(hero))throw Error('Not all-in');
   if(action==='4-bet'&&(l.stage!==3||target===cap(hero)))throw Error('Wrong raise type');
   if(action==='4-bet All-in'&&l.stage!==3||action==='5-bet All-in'&&l.stage!==4)throw Error('Wrong action stage');
  }
  const additional=target-before,rawPot=l.potBeforeActionBB+additional;
  // Call closes the action. Fold returns the opponent's unmatched live excess.
  const returned=action==='Call'?l.call.uncalledReturnBB:action==='Fold'?Math.max(0,l.liveBetsBB[opp]-before):0;
  return {toBB:target,additionalBB:additional,heroRemainingBB:cap(hero)-target,potAfterActionBB:rawPot-returned,uncalledReturnBB:returned,
   closesAction:action==='Call'||action==='Fold',allIn:target===cap(hero),
   // If a shove is called, match only the smaller live cap and return any excess.
   ifCalled:action.includes('All-in')?{matchedLiveBB:Math.min(target,cap(opp)),uncalledReturnBB:Math.max(0,target-cap(opp)),potBB:l.deadMoneyBB+2*Math.min(target,cap(opp))}:null};
 }
 function policy(opener,bettor,scenario,jam){
  const oi=index(opener),early=oi<=2,middle=oi<=4,inBlind=['SB','BB'].includes(bettor);
  if(scenario==='vs3bet')return {
   raise:p.expand('KK+'),jam:p.expand(early?'AKs AKo':middle?'QQ AKs AKo':inBlind?'QQ JJ AKs AKo AQs':'QQ AKs AKo'),
   call:p.expand(early?'QQ JJ AQs':middle?(inBlind?'JJ TT AQs AJs KQs AQo':'JJ TT AQs KQs'):(inBlind?'TT 99 88 AJs ATs KQs KJs QJs AQo':'JJ TT 99 AQs AJs KQs AQo'))};
  return jam?{raise:new Set(),jam:new Set(),call:p.expand(early?'KK+ AKs':middle?'QQ+ AKs AKo':'JJ+ AQs+ AKo')}:
   {raise:new Set(),jam:p.expand('KK+'),call:p.expand(!early&&!middle&&inBlind?'QQ JJ AKs AKo AQs':'QQ AKs AKo')};
 }
 function table(hero,scenario,opener,bettor,{fourBetAllIn=false}={}){
  hero=p.alias(hero);opener=p.alias(opener);bettor=p.alias(bettor);
  if(!['vs3bet','vs4bet'].includes(scenario)||!validPair(opener,bettor)||hero!==(scenario==='vs3bet'?opener:bettor))return null;
  const l=ledger(opener,bettor,scenario==='vs3bet'?3:4,fourBetAllIn),sets=policy(opener,bettor,scenario,fourBetAllIn);
  const prior=scenario==='vs3bet'?p.table(hero):p.table(hero,'vsopen',opener),expected=scenario==='vs3bet'?'Raise':'3-bet';
  const rows={},stats={};
  for(const h of p.hands){const eligible=prior.hands[h].action===expected;let action=eligible?'Fold':null;
   if(eligible){if(sets.raise.has(h))action='4-bet';else if(sets.jam.has(h))action=scenario==='vs3bet'?'4-bet All-in':'5-bet All-in';else if(sets.call.has(h))action='Call';}
   const to=action==='4-bet'?14:action?.includes('All-in')?cap(hero):null;
   const money=action?outcome(l,action,to):null;
   const reason=!eligible?'既存の基本表では、この手で先のオープン／3betを選ばないため履歴対象外です。Foldの推奨や0%ではありません。':action==='Fold'?'この相手位置とレイズ段階では続行を絞る独自基準です。マイナスEVを計算した判定ではありません。':action==='Call'?'強いカード・ペアを中心にCallへ残す独自基準です。非オールインではポストフロップの対応が必要で、ポットオッズだけで利益は証明できません。':action==='4-bet'?'AA・KKを合計14BBの価値4betへ置く基本設計です。残り16BB。相手の5betジャムにはCallを予定する枝で、最適頻度ではありません。':'強いペア・高いカードを中心に、30BBでのコミットを明確にするオールイン枠です。最適なジャム頻度・勝率は未計算です。';
   rows[h]={kind:'reference',action,historyEligible:eligible,sizeBB:money&&action!=='Fold'?money.toBB:null,money,reason,basis:'独自参考戦略。均衡計算・EV・最適混合頻度は未検証。'};
   const key=action||'Outside history';stats[key]=(stats[key]||0)+p.comboCount(h);
  }
  return {state:'reference',hero,opener,threeBettor:bettor,scenario,fourBetAllIn,metadata,hands:rows,stats,money:l,totalCombos:1326,
   note:'全員30BBは強制ベット支払い前。BBはアンティ1BBによりライブ上限29BB。参加者は2人、他は全員Fold。コールド4bet・スクイーズ・別サイズ・ICMは未対応。参考表同士の自己対戦均衡ではありません。'};
 }
 root.PokerLabReraises={metadata,roles,ledger,outcome,table};
})(globalThis);
