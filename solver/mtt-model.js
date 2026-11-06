// 9-max MTT configuration, validation and display gate. No strategy is invented here.
(function(root){
 const positions=['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'];
 const ranks='AKQJT98765432',hands=Array.from({length:169},(_,k)=>{const a=Math.floor(k/13),b=k%13;return a===b?ranks[a]+ranks[b]:a<b?ranks[a]+ranks[b]+'s':ranks[b]+ranks[a]+'o';});
 const actions=['All-in','Raise','Call','Check','Fold'];
 const isHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 function defaults(stackBB=30){return {variant:'NLHE',format:'MTT',model:'chipEV',players:9,positions:[...positions],stacksBeforePostsBB:Object.fromEntries(positions.map(p=>[p,stackBB])),stackBaseline:'before blinds and antes',sbBlind:.5,bbBlind:1,ante:{type:'big-blind',amountBB:1},rake:0,openRaiseToBB:2,sbRaiseToBB:2.5,limps:'SB-only',bounty:false,icm:false};}
 function errors(c){
  const result=[];
  if(!c||c.variant!=='NLHE'||c.format!=='MTT'||c.model!=='chipEV'||c.players!==9||JSON.stringify(c.positions)!==JSON.stringify(positions))return ['Unsupported game'];
  if(!c.stacksBeforePostsBB||positions.some(p=>!Number.isFinite(c.stacksBeforePostsBB[p])||c.stacksBeforePostsBB[p]<10||c.stacksBeforePostsBB[p]>100))result.push('Invalid stacks');
  if(c.stackBaseline!=='before blinds and antes'||c.sbBlind!==.5||c.bbBlind!==1||c.rake!==0||c.bounty!==false||c.icm!==false)result.push('Unsupported payoff conditions');
  if(!['none','big-blind','per-player'].includes(c.ante?.type)||!Number.isFinite(c.ante?.amountBB)||c.ante.amountBB<0||c.ante.amountBB>5||(c.ante.type==='none'&&c.ante.amountBB!==0))result.push('Invalid ante');
  for(const v of [c.openRaiseToBB,c.sbRaiseToBB])if(!Number.isFinite(v)||v<=1||v>=Math.min(...Object.values(c.stacksBeforePostsBB||{invalid:0})))result.push('Invalid raise size');
  if(c.limps!=='SB-only')result.push('Unsupported limp policy');
  return result;
 }
 function posting(c){
  if(errors(c).length)throw Error('Invalid MTT configuration');
  const contributions=Object.fromEntries(positions.map(p=>[p,(p==='SB'?.5:p==='BB'?1:0)+(c.ante.type==='big-blind'?(p==='BB'?c.ante.amountBB:0):c.ante.type==='per-player'?c.ante.amountBB:0)]));
  return {potBB:Object.values(contributions).reduce((s,x)=>s+x,0),contributions,remaining:Object.fromEntries(positions.map(p=>[p,c.stacksBeforePostsBB[p]-contributions[p]]))};
 }
 function node(hero){const i=positions.indexOf(hero);if(i<0||hero==='BB')return null;return {hero,history:positions.slice(0,i).map(p=>({seat:p,action:'fold'})),toAct:positions.slice(i)};}
 // Strict canonical signature: never match only the hero-villain minimum in a nine-player game.
 function signature(c){if(errors(c).length)return null;return JSON.stringify({variant:c.variant,format:c.format,model:c.model,players:c.players,positions,stacks:positions.map(p=>c.stacksBeforePostsBB[p]),stackBaseline:c.stackBaseline,sbBlind:c.sbBlind,bbBlind:c.bbBlind,ante:{type:c.ante.type,amountBB:c.ante.amountBB},rake:c.rake,openRaiseToBB:c.openRaiseToBB,sbRaiseToBB:c.sbRaiseToBB,limps:c.limps,bounty:c.bounty,icm:c.icm});}
 function frequencies(f){return !!(f&&Object.keys(f).length===actions.length&&actions.every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=100)&&Math.abs(actions.reduce((s,k)=>s+f[k],0)-100)<1e-8);}
 function inspect(data,c,hero){
  const reasons=[],n=node(hero),sig=signature(c);
  if(!sig||!n)return {ok:false,reasons:['Unsupported configuration or node']};
  if(!data||data.schemaVersion!==1||data.verified!==true||signature(data.game)!==sig||JSON.stringify(data.node)!==JSON.stringify(n))return {ok:false,reasons:['No exact verified dataset']};
  const v=data.validation,s=data.source;
  if(!s?.name||!/^https:\/\//.test(s.url||'')||!s.solverVersion||!isHash(s.artifactSha256)||s.redistributionAllowed!==true||!s.licenseReference)reasons.push('Missing source or redistribution evidence');
  if(!v||v.method!=='full-game-unilateral-best-response-bounds'||v.unit!=='BB/dealt-hand'||!Number.isFinite(v.toleranceBB)||v.toleranceBB<=0||v.toleranceBB>1e-4||!isHash(v.fullBettingTreeSha256)||v.postflopIncluded!==true||v.fullGameAbstractionErrorIncluded!==true||!isHash(v.evidenceSha256)||!/^https:\/\//.test(v.independentReference||'')||!Number.isFinite(v.independentMaxDifference)||v.independentMaxDifference>.001||v.independentMaxDifference<0)reasons.push('Missing full-game validation');
  if(!v?.bestResponseGainUpperBoundsBB||Object.keys(v.bestResponseGainUpperBoundsBB).length!==9||positions.some(p=>!Number.isFinite(v.bestResponseGainUpperBoundsBB[p])||v.bestResponseGainUpperBoundsBB[p]<0||v.bestResponseGainUpperBoundsBB[p]>v.toleranceBB))reasons.push('Missing nine-player deviation bounds');
  if(!data.hands||Object.keys(data.hands).length!==169||hands.some(h=>!frequencies(data.hands[h])))reasons.push('Incomplete 169-hand frequencies');
  else if(hands.some(h=>data.hands[h].Check!==0||(hero!=='SB'&&data.hands[h].Call!==0)))reasons.push('Illegal unopened-pot action');
  return {ok:reasons.length===0,reasons};
 }
 function status(c,hero,datasets=[]){
  if(errors(c).length)return {state:'unsupported',label:'未対応',note:'入力した人数・スタック・計算条件は未対応です。',dataset:null};
  if(hero==='BB')return {state:'not-applicable',label:'オープン対象外',note:'全員がフォールドするとBBはウォークです。オープン判断やCheckの頻度は表示しません。',dataset:null};
  if(!node(hero))return {state:'unsupported',label:'未対応',note:'このポジションは未対応です。',dataset:null};
  const d=datasets.find(d=>inspect(d,c,hero).ok);
  if(d)return {state:'verified',label:'GTO検証済み · MTT '+c.stacksBeforePostsBB[hero]+'BB',note:'表示中の計算条件に一致した検証済みデータです。',dataset:d};
  const target=signature(c)===signature(defaults(30));
  return {state:target?'pending':'unsupported',label:target?'30BB · 検証待ち':'未対応',note:target?'30BBのポジション別オープンレンジは検証済みデータ未登録です。未計算を0%やFoldとして埋めません。':'このスタック・計算条件の検証済みレンジは未対応です。30BBのオープンレンジを優先しています。',dataset:null};
 }
 root.PokerLabMTT={positions,hands,actions,defaults,errors,posting,node,signature,frequencies,inspect,status};
})(globalThis);
