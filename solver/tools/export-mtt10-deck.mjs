import{buildSampledGame}from'../mtt10-deck.js';import{writeFileSync}from'node:fs';writeFileSync('/tmp/mtt10-deck-tree.json',JSON.stringify(buildSampledGame({samples:16,seed:110104})));
