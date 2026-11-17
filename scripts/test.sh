#!/bin/sh
# 运行宿主单测 + 客户端 jsdom 测试（需 tests/node_modules：cd tests && npm i）。
set -eu
cd "$(dirname "$0")/.."
if [ ! -d tests/node_modules ]; then
  echo "缺少测试依赖：先运行 (cd tests && npm install)" >&2
  exit 1
fi
node --test tests/host.test.mjs tests/client.test.mjs
