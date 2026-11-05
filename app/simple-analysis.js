import {deck,classes,validate} from '../solver/simple-analysis.js?v=analysis-19';
const $=id=>document.getElementById(id),range={};let worker;
function invalidate(message='入力後に「厳密計算する」を押してください'){
 worker?.terminate();worker=null;$('result').hidden=true;$('output').textContent='';$('progress').hidden=true;$('cancel').disabled=true;$('status').textContent=message;
}
const names=['自分1','自分2','フロップ1','フロップ2','フロップ3','ターン','リバー'];
const selects=names.map((name,i)=>{
 const label=document.createElement('label');label.textContent=name;
 const select=document.createElement('select');select.id='card'+i;select.setAttribute('aria-label',name);select.add(new Option('未選択',''));
 for(const card of deck)select.add(new Option(card[0]+({c:'♣',d:'♦',h:'♥',s:'♠'}[card[1]]),card));
 label.append(select);$('cards').append(label);return select;
});
function cardOptions(){for(const select of selects)for(const option of select.options)option.disabled=!!option.value&&selects.some(s=>s!==select&&s.value===option.value);}
for(const select of selects)select.onchange=()=>{invalidate();cardOptions();};
function renderRange(){
 for(const button of $('range').children){const weight=range[button.dataset.hand]||0;button.setAttribute('aria-pressed',String(weight>0));button.title=button.dataset.hand+' '+Math.round(weight*100)+'%';}
 $('selectionSummary').textContent='選択したハンド：'+Object.keys(range).length;
 $('selected').replaceChildren();
 for(const hand of classes.filter(h=>range[h])){
  const row=document.createElement('div');row.className='range-row';const label=document.createElement('label');label.textContent=hand+' 頻度（%）';const input=document.createElement('input');input.type='number';input.inputMode='decimal';input.min='0';input.max='100';input.step='1';input.value=range[hand]*100;input.setAttribute('aria-label',hand+' 頻度');
  input.oninput=()=>{invalidate();};
  input.onchange=()=>{const n=Number(input.value);if(input.value===''||!Number.isInteger(n)||n<0||n>100){input.value=range[hand]*100;$('status').textContent='頻度は0〜100の整数で入力してください';return;}if(n===0)delete range[hand];else range[hand]=n/100;renderRange();};
  label.append(input);row.append(label);$('selected').append(row);
 }
}
for(const hand of classes){const button=document.createElement('button');button.type='button';button.textContent=hand;button.dataset.hand=hand;button.onclick=()=>{invalidate();if(range[hand])delete range[hand];else range[hand]=Number($('frequency').value);renderRange();};$('range').append(button);}
$('all').onclick=()=>{invalidate();for(const hand of classes)range[hand]=Number($('frequency').value);renderRange();};
$('clear').onclick=()=>{invalidate();for(const hand of Object.keys(range))delete range[hand];renderRange();};
for(const id of ['pot','bet'])$(id).oninput=()=>invalidate();
$('cancel').onclick=()=>invalidate('計算を中止しました。結果は未算出です。');
$('calculate').onclick=()=>{
 invalidate();
 try{
  if(selects[6].value&&!selects[5].value)throw Error('リバーを指定する場合はターンも指定してください');
  const input={hero:selects.slice(0,2).map(s=>s.value),board:selects.slice(2).filter(s=>s.value).map(s=>s.value),range:{...range},pot:$('pot').value===''?NaN:Number($('pot').value),bet:$('bet').value===''?NaN:Number($('bet').value)};
  if(selects.slice(0,5).some(s=>!s.value))throw Error('自分の2枚とフロップ3枚を指定してください');
  validate(input);worker=new Worker(new URL('./simple-analysis-worker.js?v=analysis-19',import.meta.url),{type:'module'});const current=worker;
  $('cancel').disabled=false;$('progress').hidden=false;$('progress').removeAttribute('value');$('status').textContent='全組み合わせを厳密計算中…';
  worker.onmessage=({data})=>{
   if(worker!==current)return;
   if(data.error){invalidate(data.error);return;}
   if(data.progress){const {done,total}=data.progress;$('progress').max=total;$('progress').value=done;$('status').textContent=`厳密計算中：${done.toLocaleString()} / ${total.toLocaleString()}（${(done/total*100).toFixed(1)}%）`;}
   if(data.result){const r=data.result;current.terminate();worker=null;$('cancel').disabled=true;$('progress').hidden=true;$('status').textContent='計算完了';const pct=n=>(n*100).toFixed(3)+'%';
    const lines=[`エクイティ（引き分け込み）：${pct(r.equity)}`,`勝ち：${pct(r.win)} ／ 引き分け：${pct(r.tie)}`,`ポットオッズ（獲得可能額：コール額）：${r.odds===null?'ベット0・コール費用なし':r.odds.toFixed(3)+'：1'}`,`必要エクイティ：${pct(r.required)}`,`コールEV：${r.callEV.toFixed(4)} ／ フォールドEV：0（入力と同じ単位）`,r.favorable?'この計算条件下ではコール有利':r.comparison==='equal'?'この計算条件下ではコールとフォールドは同EV':'この計算条件下ではフォールド有利',`厳密列挙：${r.total.toLocaleString()}通り ／ 除外後${r.combos}コンボ`,`GTO推奨ではありません。表示値は丸めています。`];
    $('output').replaceChildren(...lines.map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));$('result').hidden=false;
   }
  };
  worker.onerror=()=>invalidate('計算に失敗しました。再実行してください。');worker.postMessage(input);
 }catch(error){invalidate(error.message);}
};
renderRange();invalidate();
