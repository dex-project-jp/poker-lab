// Pure browser/Node matching for certified HU no-ante push/fold strategies.
(function(root){
 function effectiveStack(spot){
  const a=spot?.heroBB,b=spot?.villainBB;
  return [a,b].every(v=>Number.isFinite(v)&&v>=.5&&v<=500)?Math.min(a,b):null;
 }
 function match(data,spot){
  const S=effectiveStack(spot),g=data?.game;
  return !!(data&&data.verified===true&&Number.isFinite(S)&&S>1&&data.players===2&&data.heroBB===S&&data.villainBB===S&&data.ante==='なし'&&g?.variant==='NLHE'&&g.model==='chipEV'&&g.players===2&&g.stackBB===S&&g.sbBlind===.5&&g.bbBlind===1&&g.ante===0&&g.rake===0&&g.actions?.SB?.join(',')==='shove,fold'&&g.actions?.BB?.join(',')==='call,fold'&&Number.isFinite(data.certificate?.nashGap)&&data.certificate.nashGap>=0&&data.certificate.nashGap<=1e-10&&data.model==='chipEV'&&spot.model==='chipEV'&&spot.players===2&&spot.ante==='なし'&&spot.hero===data.hero&&spot.villain===data.villain&&spot.scenario===data.scenario);
 }
 function frequencies(data,hand){const f=data?.hands?.[hand],keys=['All-in','Raise','Call','Check','Fold'];return f&&keys.every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=100)&&Math.abs(keys.reduce((a,k)=>a+f[k],0)-100)<1e-8?f:null;}
 root.PokerLabView={match,frequencies,effectiveStack};
})(globalThis);
