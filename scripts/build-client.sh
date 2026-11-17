#!/bin/sh
# 由两个切片重新拼出 client.js，并做语法检查。
set -eu
cd "$(dirname "$0")/.."
cat .client-part1 .client-part2 > client.js
node --check client.js
echo "client.js rebuilt: $(wc -l < client.js) lines"
