// Structural audit ONLY. This command never publishes or changes strategy data.
import '../mtt-model.js';
import {readFileSync} from 'node:fs';
if(process.argv.length!==3)throw Error('Usage: node tools/check-mtt-bundle.mjs dataset.json');
const d=JSON.parse(readFileSync(process.argv[2],'utf8')),m=globalThis.PokerLabMTT;
const result=m.inspect(d,m.defaults(),d.node?.hero);
console.log(JSON.stringify({structuralChecksPassed:result.ok,reasons:result.reasons,mathematicallyVerified:false,published:false,note:'Metadata is not mathematical proof. Independently check original solver artifacts and full-game best-response bounds before adding a release dataset.'},null,2));
if(!result.ok)process.exitCode=1;
