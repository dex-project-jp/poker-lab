// One reference recommendation OR validated model-specific numeric data; never invent a mix.
(function(root){
 const colors={'All-in':'#9457d5','4-bet All-in':'#9457d5','5-bet All-in':'#9457d5',Raise:'#e9a53d','3-bet':'#e9a53d','4-bet':'#e9a53d',Call:'#399dd5',Check:'#36b9a5',Limp:'#36b9a5',Fold:'#a7afba'};
 function view(row){
  if(!row)return null;
  if(row.kind==='reference')return colors[row.action]?{kind:'reference',background:colors[row.action],label:row.action,segments:[{action:row.action,color:colors[row.action],fraction:null}]}:null;
  const v=row.provenance;
  if(row.kind!=='computed'||!v||!['method','modelId','source'].every(k=>typeof v[k]==='string'&&v[k].trim())||v.validation?.status!=='verified'||typeof v.validation.scope!=='string'||!v.validation.scope.trim())return null;
  const entries=Object.entries(row.frequencies||{});
  if(!entries.length||entries.some(([a,n])=>!colors[a]||!Number.isFinite(n)||n<0||n>1)||Math.abs(entries.reduce((s,[,n])=>s+n,0)-1)>1e-9)return null;
  let x=0;const stops=[],segments=[];for(const [action,fraction]of entries){if(!fraction)continue;const start=x;x+=fraction*100;stops.push(`${colors[action]} ${start}%`,`${colors[action]} ${x}%`);segments.push({action,color:colors[action],fraction});}
  return {kind:'computed',background:'linear-gradient(to right,'+stops.join(',')+')',segments,label:segments.map(s=>s.action+' '+(s.fraction*100).toFixed(1)+'%').join(' / '),provenance:v};
 }
 root.PokerLabRangeView={colors,view};
})(globalThis);
