import {buildGame} from '../btn-mini-game.js';
import {writeFileSync} from 'node:fs';
writeFileSync(process.argv[2]||'/tmp/poker-btn-mini-tree.json',JSON.stringify(buildGame()));
