// Original editorial strategy, not solver output and not copied third-party charts.
// Categorical recommendations are NOT GTO action frequencies or EV estimates.
(function(root){
 const ranks='23456789TJQKA',chartRanks='AKQJT98765432';
 const positions=['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'];
 const hands=Array.from({length:169},(_,k)=>{const a=Math.floor(k/13),b=k%13;return a===b?chartRanks[a]+chartRanks[b]:a<b?chartRanks[a]+chartRanks[b]+'s':chartRanks[b]+chartRanks[a]+'o';});
 const alias=p=>p==='MP'?'UTG+2':p,display=p=>alias(p)==='UTG+2'?'MP':p;
 function expand(text){const out=new Set();for(const token of text.trim().split(/\s+/).filter(Boolean)){
  if(token==='all-suited'){for(const h of hands)if(h.endsWith('s'))out.add(h);continue;}
  const m=token.match(/^([2-9TJQKA])([2-9TJQKA])(s|o)?(\+)?$/);if(!m)throw Error('Invalid range token '+token);
  const a=ranks.indexOf(m[1]),b=ranks.indexOf(m[2]);if(a<b||a===b&&m[3]||a!==b&&!m[3])throw Error('Ambiguous range token '+token);
  if(a===b){for(let r=a;r<(m[4]?13:a+1);r++)out.add(ranks[r]+ranks[r]);}
  else for(let r=b;r<(m[4]?a:b+1);r++)out.add(ranks[a]+ranks[r]+m[3]);
 }return out;}
 const add=(base,more)=>new Set([...base,...expand(more)]);
 const opens={};
 opens.UTG=expand('55+ A5s+ KTs+ QTs+ JTs T9s 98s AJo+ KQo');
 opens['UTG+1']=add(opens.UTG,'44 A4s A3s Q9s J9s T8s ATo');
 opens['UTG+2']=add(opens['UTG+1'],'33 A2s K9s 87s 97s KJo QJo');
 opens.LJ=add(opens['UTG+2'],'22 K8s Q8s J8s 76s 86s A9o KTo');
 opens.HJ=add(opens.LJ,'K7s Q7s T7s 65s 75s A8o QTo JTo');
 opens.CO=add(opens.HJ,'K6s K5s Q6s J7s T6s 96s 54s A7o K9o Q9o');
 opens.BTN=add(opens.CO,'K4s K3s K2s Q5s Q4s J6s J5s T5s 95s 85s 64s A6o A5o A4o K8o K7o Q8o J9o J8o T9o 98o');
 const sbRaise=expand('55+ A8s+ ATo+ KTs+ KJo+ QTs+ QJo JTs T9s A5s A4s K5s Q5s');
 const sbPlay=expand('22+ all-suited A2o+ K2o+ Q6o+ J7o+ T7o+ 98o 87o 76o 65o 54o 97o 86o 75o 64o');
 const metadata=Object.freeze({id:'poker-lab-original-30bb-v1',kind:'original-strategy-design',label:'実戦参考 · 独自設計',gtoVerified:false,frequencyModel:'none',license:'Original Poker Lab range rules and original explanations; no third-party range files, images or frequency tables included',scope:'9-max MTT, all 30BB before blinds/antes, BB ante 1BB, Chip EV orientation, no rake/ICM/bounty',sources:[{url:'https://www.pokerstars.com/poker/learn/lesson/position/',use:'Position and early/late range-width principles only; no chart imported'},{url:'https://blog.gtowizard.com/is-limping-pimping/',use:'Small-blind limping concept only; no solution frequencies imported'},{url:'https://www.pokerstrategy.com/strategy/sit-and-go/playing-preflop-open-raising/',use:'General small-raise/stack-depth principles only; no chart imported'}]});
 const comboCount=h=>h.length===2?6:h.endsWith('s')?4:12;
 const attributes=h=>({pair:h.length===2,suited:h.endsWith('s'),high:ranks.indexOf(h[0])+2,low:ranks.indexOf(h[1])+2});
 function explanation(h,action,hero,scenario){
  const f=attributes(h);let reason;
  if(action==='Fold')reason='この独自基本表では参加条件を満たさないためFold。数学的にマイナスEVと計算した、という意味ではありません。';
  else if(action==='Limp')reason='SBで追加0.5BBのコンプリートを選ぶ基本方針です。BBからレイズされた後も自動的にコールする指示ではありません。';
  else if(action==='Call')reason='この相手位置に対し、3betではなくポットを抑えて参加する独自の基準です。相手が非常にタイト、または後ろのスクイーズが多い場合は狭めます。';
  else if(action==='3-bet')reason=!(f.high===14&&!f.pair&&f.low<=5)?'強いペア・高いカードの価値を重視した3bet枠です。4betへの応答や30BBのオールインへのコール可否は別判断です。':'Aのブロッカーとスートを評価して採用した3bet枠です。ブラフの最適頻度を計算したものではなく、4betへ自動的に続行しません。';
  else if(f.pair)reason=f.high>=10?'強いペアを価値レイズに使う基本設計です。相手の3bet・オールインに対する続行範囲は別に判断します。':'中小ペアの参加枠です。30BBではセット完成だけを前提にせず、後ろの3betやフロップへの対応も考慮します。';
  else if(f.suited&&f.high===14)reason=f.low>=10?'高いカードとスートのプレイしやすさを評価した参加枠です。':'Aのブロッカーとスートを評価した参加枠です。低いキッカーによる不利に注意し、強い再レイズに機械的に続行しません。';
  else if(f.high>=11&&f.low>=10)reason='高いカードの組み合わせを評価した参加枠です。強い相手レンジとのキッカー負けには注意します。';
  else if(f.suited)reason='スート・連結性とポジションを評価した参加枠です。コールが多い卓や後ろの強い3betには、周辺の手を狭める余地があります。';
  else reason='後ろに残る人数とポジションを重視して採用した参加枠です。オフスートの弱いキッカーは特に相手次第で調整します。';
  return {reason,basis:'独自の戦略設計。ソルバー計算・GTOの混合頻度・利益保証ではありません。',context:display(hero)+(scenario==='open'?' 未オープン':' 対オープン')};
 }
 function responseSets(hero,opener){
  const oi=positions.indexOf(opener),zone=oi<=2?'early':oi<=4?'middle':'late';let raise,call;
  if(hero==='SB'){
   raise=expand(zone==='early'?'JJ+ AQs+ AKo':zone==='middle'?'TT+ AJs+ AQo+ KQs A5s':'99+ ATs+ AJo+ KQs KJs QJs A5s A4s');call=new Set();
  }else{
   raise=expand(zone==='early'?'QQ+ AKs AKo':zone==='middle'?'JJ+ AQs+ AKo A5s':'TT+ AJs+ AQo+ KQs A5s A4s');
   if(hero==='BB'){
    if(opener==='SB')raise=expand('99+ ATs+ AJo+ KQs KJs QJs A5s A4s');
    call=expand(zone==='early'?'22+ A2s+ KTs+ QTs+ JTs T9s 98s 87s 76s AJo+ KQo':zone==='middle'?'22+ A2s+ K8s+ Q9s+ J9s+ T8s+ 98s 87s 76s 65s ATo+ KJo+ QJo':'22+ all-suited A2o+ K7o+ Q8o+ J8o+ T8o+ 98o 87o 76o');
    if(zone==='late')for(const h of ['32s','42s','52s','62s','72s'])call.delete(h);
   }else call=expand(zone==='early'?'77+ AJs AQs KQs QJs JTs':zone==='middle'?'66+ ATs AJs KJs KQs QJs JTs T9s AQo':'55+ A9s+ KTs+ QTs+ JTs T9s 98s AJo+ KQo');
  }
  for(const h of raise)call.delete(h);return {raise,call,zone};
 }
 function table(hero,scenario='open',opener=null){
  hero=alias(hero);opener=alias(opener);if(!positions.includes(hero))return null;
  if(scenario==='open'&&hero==='BB')return {state:'walk',hands:null,note:'全員フォールドならBBはウォーク。Checkの判断ではありません。'};
  if(!['open','vsopen'].includes(scenario))return null;
  let response;
  if(scenario==='vsopen'){
   if(!positions.includes(opener)||positions.indexOf(opener)>=positions.indexOf(hero)||opener==='BB')return null;
   response=responseSets(hero,opener);
  }
  const rows={};for(const h of hands){let action='Fold',sizeBB=null;
   if(scenario==='open'){
    if(hero==='SB'){if(sbRaise.has(h))action='Raise';else if(sbPlay.has(h))action='Limp';}
    else if(opens[hero].has(h))action='Raise';
    if(action==='Raise')sizeBB=hero==='SB'?2.5:2;if(action==='Limp')sizeBB=1;
   }else{if(response.raise.has(h)){action='3-bet';sizeBB=opener==='SB'?8:(hero==='SB'||hero==='BB')?7:6;}else if(response.call.has(h)){action='Call';sizeBB=opener==='SB'?2.5:2;}}
   rows[h]={action,sizeBB,sizeMeaning:'total live bet including any posted blind; ante excluded',...explanation(h,action,hero,scenario)};
  }
  const stats={};for(const h of hands){const a=rows[h].action;stats[a]=(stats[a]||0)+comboCount(h);}
  const heroBlind=hero==='BB'?1:hero==='SB'?.5:0,openerTo=opener==='SB'?2.5:2,openerBlind=opener==='SB'?.5:0;
  const math=scenario==='vsopen'?{potBeforeCallBB:2.5+openerTo-openerBlind,additionalCallBB:openerTo-heroBlind,definition:'Immediate pot odds only; ignores equity realization and future actions'}:null;
  if(math)math.rawCallEquityThreshold=math.additionalCallBB/(math.potBeforeCallBB+math.additionalCallBB);
  return {state:'reference',hero,opener:scenario==='vsopen'?opener:null,scenario,metadata,hands:rows,stats,math,totalCombos:1326,note:scenario==='open'?(hero==='SB'?'SBは簡略化した価値レイズ＋リンプ。強い手のトラップやBBの頻繁なアイソレイズへの対抗は未計算。':'全員フォールド時の保守的な基本表。30BBのオープンジャムは本設計では採用しません。'):'単独オープンのみ・間のプレイヤーは全員フォールド。コールドコール、スクイーズ、ICMは対象外。3bet後の応答は別シナリオで選択します。'};
 }
 root.PokerLabPractical={metadata,positions,hands,display,alias,expand,comboCount,table};
})(globalThis);
