#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 bootstrap.py
export PATH="$PWD/.tools/node/bin:$PWD/.tools/uv:$PATH"
# uv tạo venv mà không yêu cầu gói python3-venv hoặc pip của hệ điều hành.
if [ ! -f .venv/pyvenv.cfg ] || [ ! -x .venv/bin/python ]; then
  uv venv --clear --python python3 .venv
fi
uv pip install --python .venv/bin/python -r requirements.txt
# Chỉ cài lại khi package-lock.json thay đổi.
if [ ! -f node_modules/.vtp-packing-lock ] || ! cmp -s package-lock.json node_modules/.vtp-packing-lock; then
  npm ci
  cp package-lock.json node_modules/.vtp-packing-lock
fi
npm run build
export VTP_API_URL="${VTP_API_URL:-http://192.168.1.94:18080}"
export VTP_MEDIA_URL="${VTP_MEDIA_URL:-http://192.168.1.94:18000}"
export VTP_MEDIA_SIGNED_HOST="${VTP_MEDIA_SIGNED_HOST:-192.168.1.94:18000}"
echo "Mở http://localhost:${VTP_PORT:-8099} — nhấn Ctrl+C để dừng."
exec .venv/bin/python -m uvicorn server:app --host "${VTP_BIND_HOST:-127.0.0.1}" --port "${VTP_PORT:-8099}" --no-access-log
