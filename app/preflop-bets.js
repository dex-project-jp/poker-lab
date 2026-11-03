// Chip accounting only. Arbitrary legal sizes do not imply a corresponding strategy dataset.
(function(root){
 const positions=['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'];
 const alias=x=>x==='MP'?'UTG+2':x,index=x=>positions.indexOf(alias(x));
 function allowedHeroes(scenario){return positions.slice(scenario==='vsopen'||scenario==='vs4bet'?1:scenario==='cold4bet'?2:0,scenario==='vs3bet'?8:9);}
 function defaults(opener,bettor){return {openTo:opener==='SB'?2.5:2,threeTo:opener==='SB'?8:['SB','BB'].includes(bettor)?7:6,fourTo:14};}
 function units(n){if(typeof n!=='number'||!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>1e-7)throw Error('金額は0.01BB単位の数値で入力してください。');return Math.round(n*100);}
 function calculate(input){try{return run(input);}catch(e){return {ok:false,error:e.message};}}
 function run({scenario,hero,opener,bettor,stacks,ante={type:'big-blind',amountBB:1},openTo,threeTo,fourTo}){
  hero=alias(hero);opener=alias(opener);bettor=alias(bettor);
  if(!allowedHeroes(scenario).includes(hero)||!['open','vsopen','vs3bet','vs4bet','cold4bet'].includes(scenario))throw Error('このポジション・シナリオの行動順は成立しません。');
  if(scenario==='open')opener=hero;
  if(['vs3bet','vs4bet','cold4bet'].includes(scenario)&&!(index(opener)>=0&&index(bettor)>index(opener)))throw Error('オープナーより後ろの3-bettorを選択してください。');
  if(scenario==='vsopen'&&!(index(opener)>=0&&index(opener)<index(hero)))throw Error('自分より先にオープンする位置を選択してください。');
  if(scenario==='vs3bet'&&hero!==opener||scenario==='vs4bet'&&hero!==bettor||scenario==='cold4bet'&&!(index(opener)<index(bettor)&&index(bettor)<index(hero)))throw Error('自分の役割と行動順が一致しません。');
  const start={},remaining={},live={},contributions={},antePaid={};let pot=0;
  const pay=(seat,n)=>{if(n<0||n>remaining[seat])throw Error('ベット額が残りスタックを超えています。');remaining[seat]-=n;contributions[seat]+=n;pot+=n;};
  for(const seat of positions){const s=units(stacks?.[seat]);if(s<50||s>50000)throw Error('全員のスタックを0.5〜500BBで入力してください。');start[seat]=remaining[seat]=s;live[seat]=contributions[seat]=antePaid[seat]=0;}
  const anteUnits=units(ante.amountBB);
  if(!['none','big-blind','per-player'].includes(ante.type))throw Error('アンティ形式が不正です。');
  if(ante.type!=='none')for(const seat of positions)if(ante.type==='per-player'||seat==='BB'){const n=Math.min(remaining[seat],anteUnits);pay(seat,n);antePaid[seat]=n;}
  for(const [seat,n]of [['SB',50],['BB',100]]){const posted=Math.min(remaining[seat],n);pay(seat,posted);live[seat]=posted;}
  if(positions.some(s=>remaining[s]===0))throw Error('強制ベットだけでAll-inになるスタックは、この2人続行計算では未対応です。');
  const postedPot=pot,caps=Object.fromEntries(positions.map(s=>[s,start[s]-antePaid[s]]));let maximum=100,lastFullRaise=100,opponent=null,opponentAllIn=false,lastShort=false;
  const history=[];
  function raise(seat,value){const target=units(value),minimum=maximum+lastFullRaise;
   if(remaining[seat]===0||target<=maximum||target>caps[seat])throw Error('レイズは現在のベット額を超え、本人のライブ上限以下にしてください。');
   if(opponentAllIn||lastShort)throw Error('相手のAll-in後は再レイズできません（2人の続行局面）。');
   const allIn=target===caps[seat],full=target>=minimum;
   if(!full&&!allIn)throw Error('最小レイズは合計'+(minimum/100)+'BBです。');
   pay(seat,target-live[seat]);live[seat]=target;
   if(full)lastFullRaise=target-maximum;maximum=target;lastShort=!full;opponent=seat;opponentAllIn=allIn;
   history.push({seat,toBB:target/100,allIn,fullRaise:full});
  }
  const walk=scenario==='open'&&hero==='BB';
  if(!walk&&scenario!=='open')raise(opener,openTo);
  if(['vs3bet','vs4bet','cold4bet'].includes(scenario))raise(bettor,threeTo);
  if(scenario==='vs4bet')raise(opener,fourTo);
  // Others folded; before they have acted in an unopened pot, only the posting pot is shown.
  const callTo=walk?live[hero]:Math.min(maximum,caps[hero]),additional=Math.max(0,callTo-live[hero]);
  const refund=opponent?Math.max(0,maximum-caps[hero]):0,afterCall=pot+additional-refund;
  const minimum=maximum+lastFullRaise,canRaise=!walk&&!opponentAllIn&&!lastShort&&caps[hero]>maximum;
  let projection=null,projectionError=null;
  const proposed=scenario==='open'?openTo:scenario==='vsopen'?threeTo:scenario==='vs3bet'?fourTo:null;
  if(!walk&&proposed!==null&&canRaise){try{
   const target=units(proposed);
   if(!canRaise)throw Error('この局面では再レイズできません。Call/Foldのみです。');
   if(target<=maximum||target>caps[hero]||target<minimum&&target!==caps[hero])throw Error('フルレイズ最小'+minimum/100+'BB、本人の上限'+caps[hero]/100+'BBです。上限が最小額より小さい場合は上限へのAll-inだけが可能です。');
   projection={toBB:target/100,additionalBB:(target-live[hero])/100,potAfterBB:(pot+target-live[hero])/100,remainingBB:(caps[hero]-target)/100,allIn:target===caps[hero]};
  }catch(e){projectionError=e.message;}}
  return {ok:true,hero,opener,bettor,scenario,walk,history,postedPotBB:postedPot/100,potBeforeActionBB:pot/100,heroLiveBB:live[hero]/100,heroRemainingBB:remaining[hero]/100,heroLiveCapBB:caps[hero]/100,
   call:{additionalBB:additional/100,toBB:callTo/100,uncalledReturnBB:refund/100,potAfterCallBB:afterCall/100,remainingBB:(caps[hero]-callTo)/100,rawEquityThreshold:afterCall?additional/afterCall:null},minimumRaiseToBB:minimum/100,canRaise,fullRaiseAvailable:canRaise&&caps[hero]>=minimum,onlyShortAllIn:canRaise&&caps[hero]<minimum,opponentAllIn,shortAllIn:lastShort,projection,projectionError,
   remainingBB:Object.fromEntries(positions.map(s=>[s,remaining[s]/100])),contributionsBB:Object.fromEntries(positions.map(s=>[s,contributions[s]/100]))};
 }
 function matchesReference(input,result){if(!result?.ok||result.projectionError)return false;const d=defaults(result.opener,result.bettor);
  const same=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-9;
  if(result.walk)return true;
  if(!same(input.openTo,d.openTo))return false;
  if(input.scenario!=='open'&&!same(input.threeTo,d.threeTo))return false;
  if(input.scenario==='vs3bet'&&!same(input.fourTo,14))return false;
  if(input.scenario==='vs4bet'&&!same(input.fourTo,input.fourBetAllIn?result.history[0].seat==='BB'?29:30:14))return false;
  return input.scenario!=='cold4bet';
 }
 root.PokerLabBets={positions,allowedHeroes,defaults,calculate,matchesReference};
})(globalThis);
