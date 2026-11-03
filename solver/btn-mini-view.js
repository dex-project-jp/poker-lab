// Separate namespace and scope: reduced-game data can never become MTT data.
(function(root){
 function view(data,player){
  const c=data?.certificate,labels=['AA','KK','QQ','JJ'],actions=['All-in','Raise','Call','Check','Fold'];
  if(data?.verified!==true||data.scope!=='reduced-fixed-board-game-only'||data.fullMTTGTO!==false||data.config?.id!=='btn-sb-bb-fixed-board-v1'||data.config.stackBB!==30||!Number.isFinite(c?.epsilonBB)||c.epsilonBB<0||c.epsilonBB>1e-5||c.toleranceBB!==1e-5||c.unit!=='BB/dealt-hand'||c.exactRationalVerified!==true)return null;
  const v=data.views?.find(v=>v.player===player);if(!v||Object.keys(v.hands||{}).length!==4)return null;
  if(labels.some(h=>!v.hands[h]||!actions.every(a=>Number.isFinite(v.hands[h][a])&&v.hands[h][a]>=0&&v.hands[h][a]<=100)||Math.abs(actions.reduce((s,a)=>s+v.hands[h][a],0)-100)>1e-8))return null;
  return v;
 }
 root.PokerLabMiniView={view};
})(globalThis);
