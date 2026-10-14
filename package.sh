#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 bootstrap.py
export PATH="$PWD/.tools/node/bin:$PATH"
npm ci
npm run build
python3 package_release.py
