import{buildGame}from'../mtt10-game.js';import{writeFileSync}from'node:fs';writeFileSync('/tmp/mtt10-tree.json',JSON.stringify(buildGame()));
