// Exact Call/Fold comparison only after an opponent's all-in; NOT a GTO solver.
(function(root){
 const presets={value:{label:'仮定：QQ+・AKs・AKo',notation:'QQ+ AKs AKo'},tight:{label:'仮定：KK+・AKs',notation:'KK+ AKs'},wide:{label:'仮定：JJ+・AQs+・AKo',notation:'JJ+ AQs+ AKo'}};
 const matrixSha256='9f2a641fbdfde0659533e68e3a38cafde4924d14143f9583978861d3591df40d',boards=1712304;
 function inspect(data){
  if(data?.schema!==1||data.matrixSha256!==matrixSha256||data.method!=='exact-blocker-weighted-showdown')return false;
  for(const [id,model]of Object.entries(presets)){
   const m=data.models?.[id];if(m?.notation!==model.notation||Object.keys(m.hands||{}).length!==169)return false;
   for(const h of root.PokerLabPractical.hands){const e=m.hands[h];if(!e||![e.halfPots,e.compatibleDeals].every(Number.isSafeInteger)||e.compatibleDeals<=0||e.compatibleDeals>1326*1225||!Number.isSafeInteger(2*boards*e.compatibleDeals)||e.halfPots<0||e.halfPots>2*boards*e.compatibleDeals)return false;}
  }return true;
 }
 function evaluate(data,hand,l,id){
  if(!presets[id]||!l?.opponentAllIn||l.stage!==4||!inspect(data))return null;
  const e=data.models[id].hands[hand];if(!e)return null;
  const n=BigInt(e.halfPots),d=BigInt(2*boards*e.compatibleDeals),pot=l.call.potAfterCallBB,cost=l.call.additionalBB;
  if(![pot,cost].every(x=>Number.isFinite(x)&&x>=0&&Number.isSafeInteger(2*x))||pot<=0)return null;
  const delta=n*BigInt(2*pot)-d*BigInt(2*cost),denominator=2n*d;
  return {model:id,assumedRange:presets[id].notation,kind:'conditional-allin-call-fold',action:delta>0n?'Call':'Fold',indifferent:delta===0n,equity:Number(n)/Number(d),requiredEquity:cost/pot,callEVBB:Number(delta)/Number(denominator),evNumerator:delta.toString(),evDenominator:denominator.toString(),compatibleDeals:e.compatibleDeals,
   definition:'Incremental Chip EV of Call relative to Fold=0, after prior chips are sunk; fixed uniform physical-combo opponent range, no ICM/rake, no future betting, no fold-information inference',gtoVerified:false};
 }
 function apply(table,data,id){
  if(!presets[id]||!table?.fourBetAllIn||!table.money?.opponentAllIn||!inspect(data))return null;
  const hands={},stats={};for(const h of root.PokerLabPractical.hands){const old=table.hands[h],evaluation=old.historyEligible?evaluate(data,h,table.money,id):null;if(old.historyEligible&&!evaluation)return null;
   const action=evaluation?.action||old.action;
   hands[h]={...old,action,evaluation,money:action?root.PokerLabReraises.outcome(table.money,action):null,sizeBB:action==='Call'?table.money.call.toBB:null,reason:evaluation?'相手を '+presets[id].notation+' に固定した、全ボード列挙に基づくCall/Fold比較です。相手がこの範囲であること自体は仮定です。':old.reason,basis:evaluation?'条件付き計算。相手の各合法カード組を同じ重みとする仮定。9人卓GTOではありません。':old.basis};
   const key=action||'Outside history';stats[key]=(stats[key]||0)+root.PokerLabPractical.comboCount(h);
  }
  return {...table,hands,stats,metadata:{...table.metadata,kind:'conditional-allin-call-fold',assumption:presets[id].notation,gtoVerified:false},note:'Call EVはこの判断点のFold=0との差。既払チップはサンクコスト。相手範囲の仮定が変われば結果も変わります。ICM・レーキ・他者の再参加・フォールド情報は考慮しません。'};
 }
 root.PokerLabAudit={presets,matrixSha256,boards,inspect,evaluate,apply};
})(globalThis);
