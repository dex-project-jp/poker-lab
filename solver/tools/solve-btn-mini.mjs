import {buildGame} from '../btn-mini-game.js';
import {solve,exploitability} from '../btn-mini-solver.js';
import {writeFileSync} from 'node:fs';
const g=buildGame(),start=Date.now();console.log({nodes:g.nodes.length,infosets:g.infos.length});
const r=solve(g,{iterations:1000000,target:1e-5,checkEvery:1000});
writeFileSync(new URL('../data/btn-mini-candidate.json',import.meta.url),JSON.stringify({config:g.config,solution:r,verified:false},null,2)+'\n');
console.log({seconds:(Date.now()-start)/1000,converged:r.converged,iterations:r.iterations,epsilon:r.epsilon,values:r.values,kind:r.kind});
writeFileSync('/tmp/poker-btn-mini-tree.json',JSON.stringify(g));
