// Browser/Node-compatible pure matching; only the certified restricted game.
(function(root){
 function match(data,spot){return !!(data&&data.verified===true&&data.players===2&&data.heroBB===10&&data.villainBB===10&&data.ante==='なし'&&data.game?.variant==='NLHE'&&data.game.model==='chipEV'&&data.game.players===2&&data.game.stackBB===10&&data.game.sbBlind===.5&&data.game.bbBlind===1&&data.game.ante===0&&data.game.rake===0&&data.game.actions?.SB?.join(',')==='shove,fold'&&data.game.actions?.BB?.join(',')==='call,fold'&&data.certificate?.nashGap>=0&&data.certificate.nashGap<=1e-10&&data.model==='chipEV'&&spot.model==='chipEV'&&spot.players===2&&spot.heroBB===10&&spot.villainBB===10&&spot.ante==='なし'&&spot.hero===data.hero&&spot.villain===data.villain&&spot.scenario===data.scenario);}
 function frequencies(data,hand){const f=data?.hands?.[hand],keys=['All-in','Raise','Call','Check','Fold'];return f&&keys.every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=100)&&Math.abs(keys.reduce((a,k)=>a+f[k],0)-100)<1e-8?f:null;}
 root.PokerLabView={match,frequencies};
})(globalThis);
