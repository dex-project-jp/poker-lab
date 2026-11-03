#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
c++ -std=c++20 -O3 -DNDEBUG -pthread -I vendor/nuts/include vendor/nuts/src/{card,evaluator,range,equity,pushfold}.cpp vendor/nuts/tools/gen_equity169.cpp -o "$build/gen"
"$build/gen" --threads "${POKER_THREADS:-8}" "$build/equity169.bin"
cmp "$build/equity169.bin" data/equity169.bin
node --input-type=module - "$build/equity169.bin" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const bytes=readFileSync(process.argv[2]);
writeFileSync('data/regeneration.json',JSON.stringify({method:'Complete native exact enumeration, byte-for-byte comparison against pinned matrix',sha256:createHash('sha256').update(bytes).digest('hex'),matchups:47008,boardsPerMatchup:1712304,matched:true},null,2)+'\n');
JS
