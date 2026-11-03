// Release checks work independently of the poker datasets. No service worker/cache deletion.
(function(root){
 'use strict';
 function validate(value){
  if(!value||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.version!=='string'||!/^\d+\.\d+\.\d+$/.test(value.version)||typeof value.build!=='string'||! /^[a-zA-Z0-9._-]{1,80}$/.test(value.build))throw Error('Invalid release manifest');
  return {schema:1,revision:value.revision,version:value.version,build:value.build};
 }
 function reloadURL(base,release,nonce){const u=new URL(base);u.searchParams.set('refresh',String(nonce));u.searchParams.set('v',release.build);u.hash='';return u.href;}
 function create({current,baseURL,fetch:request,now=Date.now,notify=()=>{},navigate=()=>{},timeoutMs=8000}){
  current=validate(current);let pending=null,lastStart=-Infinity,latest=current;
  async function check(force=false){
   if(pending)return pending;
   if(!force&&now()-lastStart<30000)return null;
   lastStart=now();notify({state:'checking',current,latest});
   pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{const url=new URL('version.json',baseURL);url.searchParams.set('_check',String(now()));
     const response=await request(url.href,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
     if(!response.ok)throw Error('Release request failed');
     const found=validate(await response.json());
     // A stale CDN response must never trigger a downgrade or hide an already detected update.
     if(found.revision>latest.revision)latest=found;
     notify({state:latest.revision>current.revision?'available':'current',current,latest});return latest;
    }catch{notify({state:'offline',current,latest});return null;}
    finally{clearTimeout(timer);pending=null;}
   })();return pending;
  }
  async function refresh(){const found=await check(true);if(!found)return false;notify({state:'reloading',current,latest});navigate(reloadURL(baseURL,latest,now()));return true;}
  return {check,refresh};
 }
 function init(win){
  const doc=win.document,config=doc.getElementById('appRelease');if(!config)return;
  const current=validate(JSON.parse(config.textContent)),status=doc.getElementById('updateStatus'),panel=doc.getElementById('updatePanel'),checkButton=doc.getElementById('checkUpdate'),refreshButton=doc.getElementById('refreshApp');
  doc.getElementById('installedVersion').textContent='Poker Lab v'+current.version;
  const api=create({current,baseURL:win.location.href,fetch:win.fetch.bind(win),navigate:url=>win.location.replace(url),notify:s=>{
   panel.dataset.state=s.state;const newer=s.latest.revision>s.current.revision;
   const texts={checking:'更新を確認中…',current:'最新版です。',available:'新しい版 v'+s.latest.version+' があります。更新ボタンで読み込めます。',offline:newer?'新しい版があります。通信できません。接続後に更新してください。':'更新を確認できません。通信を確認して再試行してください。',reloading:'最新版を読み込んでいます…'};
   status.textContent=texts[s.state];checkButton.disabled=s.state==='checking'||s.state==='reloading';refreshButton.disabled=s.state==='reloading';refreshButton.textContent=newer?'↻ v'+s.latest.version+' に更新':'↻ 最新版を読み込む';
  }});
  checkButton.onclick=()=>api.check(true);refreshButton.onclick=()=>api.refresh();
  win.addEventListener('pageshow',e=>{if(e.persisted)api.check(true);});
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')api.check();});
  win.addEventListener('focus',()=>api.check());win.addEventListener('online',()=>api.check(true));
  // No automatic reload: the learner keeps the currently selected hand until tapping Update.
  api.check(true);return api;
 }
 root.PokerLabUpdates={validate,reloadURL,create,init};
 if(typeof window!=='undefined'&&window.document)init(window);
})(globalThis);
