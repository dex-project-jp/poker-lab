import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './updates.js';
const {validate,reloadURL,create}=globalThis.PokerLabUpdates;
const current={schema:1,revision:6,version:'0.6.0',build:'mobile-6'},newer={schema:1,revision:7,version:'0.7.0',build:'mobile-7'};
const response=value=>({ok:true,json:async()=>value});
const baseURL='https://example.test/poker-lab/?old=1#hand';
test('release schema rejects malformed responses and strips unknown remote navigation fields',()=>{
 for(const value of [null,{}, {...current,revision:NaN},{...current,revision:1.5},{...current,build:'../evil'},{...current,version:'<script>'},{...current,schema:2}])assert.throws(()=>validate(value));
 assert.deepEqual(validate({...current,url:'https://evil.test'}),current);
});
test('checks bypass HTTP cache and show new releases without navigating or changing study state',async()=>{
 const states=[],calls=[],navigation=[];let now=100;const api=create({current,baseURL,now:()=>now,fetch:async(...args)=>{calls.push(args);return response(newer)},notify:s=>states.push(s),navigate:u=>navigation.push(u)});
 await api.check();assert.equal(calls[0][1].cache,'no-store');assert.equal(calls[0][1].credentials,'same-origin');assert.match(calls[0][0],/version.json\?_check=100/);assert.equal(states.at(-1).state,'available');assert.deepEqual(navigation,[]);
 now=200;await api.check();assert.equal(calls.length,1);await api.check(true);assert.equal(calls.length,2);
});
test('concurrent lifecycle signals coalesce and stale server responses never downgrade known updates',async()=>{
 let resolve;let calls=0,states=[];const api=create({current,baseURL,fetch:()=>{calls++;return new Promise(r=>resolve=r)},notify:s=>states.push(s)});
 const a=api.check(true),b=api.check(true);assert.equal(calls,1);resolve(response(newer));await Promise.all([a,b]);const c=api.check(true);resolve(response(current));await c;assert.equal(states.at(-1).state,'available');assert.equal(states.at(-1).latest.revision,7);
});
test('manual reload checks availability before unique same-origin navigation, even if already latest',async()=>{
 const urls=[];let now=10;const api=create({current,baseURL,now:()=>++now,fetch:async()=>response(current),navigate:u=>urls.push(u)});
 assert.equal(await api.refresh(),true);assert.equal(await api.refresh(),true);assert.notEqual(urls[0],urls[1]);const u=new URL(urls[0]);assert.equal(u.origin,'https://example.test');assert.equal(u.pathname,'/poker-lab/');assert.equal(u.searchParams.get('v'),current.build);assert.equal(u.searchParams.get('old'),'1');assert.equal(u.hash,'');
 assert.equal(new URL(reloadURL('https://example.test/poker-lab/index.html',newer,123)).pathname,'/poker-lab/index.html');
});
test('offline, HTTP errors and invalid releases preserve loaded app and allow subsequent retry',async()=>{
 let mode=0;const urls=[],states=[];const api=create({current,baseURL,fetch:async()=>{if(mode===0)throw Error('offline');return mode===1?{ok:false}:mode===2?response({}):response(newer)},notify:s=>states.push(s),navigate:u=>urls.push(u)});
 for(mode=0;mode<3;mode++){assert.equal(await api.refresh(),false);assert.equal(states.at(-1).state,'offline');assert.deepEqual(urls,[]);}
 assert.equal(await api.refresh(),true);assert.equal(states.at(-1).state,'reloading');assert.equal(urls.length,1);
});
test('timeout aborts a stalled request and restores retry availability',async()=>{
 const states=[];const api=create({current,baseURL,timeoutMs:5,fetch:(_,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')))),notify:s=>states.push(s)});
 assert.equal(await api.check(true),null);assert.equal(states.at(-1).state,'offline');assert.equal(await api.check(true),null);
});
test('HTML release stamp, manifest and every versioned script agree for atomic static deployment',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),manifest=JSON.parse(readFileSync(new URL('../version.json',import.meta.url),'utf8'));
 const embedded=JSON.parse(html.match(/<script id="appRelease" type="application\/json">([^<]+)<\/script>/)[1]);assert.deepEqual(embedded,manifest);validate(manifest);
 const assets=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);assert.ok(assets.length>=8);assert.ok(assets.every(src=>new URL(src,baseURL).searchParams.get('v')===manifest.build));
});
