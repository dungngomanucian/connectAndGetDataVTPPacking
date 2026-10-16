"""Build the VTP Packing deployment package."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib

ROOT = Path(__file__).resolve().parent
LAUNCHER = '''#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if command -v uv >/dev/null; then
  if [ ! -x .venv/bin/python ]; then uv venv --python python3 .venv; fi
  uv pip install --python .venv/bin/python -r requirements.txt
else
  if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
  .venv/bin/python -m pip install -r requirements.txt
fi
export VTP_API_URL="${VTP_API_URL:-http://192.168.1.94:18080}"
export VTP_MEDIA_SIGNED_HOST="${VTP_MEDIA_SIGNED_HOST:-192.168.1.94:18000}"
export VTP_MEDIA_URL="${VTP_MEDIA_URL:-http://192.168.1.94:18000}"
exec .venv/bin/python -m uvicorn server:app --host "${VTP_BIND_HOST:-127.0.0.1}" --port "${VTP_PORT:-8099}" --no-access-log
'''
README = """# VTP Packing

Ứng dụng giám sát đóng gói, tra cứu đơn hàng và báo cáo hoạt động.

Yêu cầu Python 3.10+ cùng uv hoặc Python venv/pip. Kết nối mạng cần thiết
để cài dependencies lần đầu. Giải nén và chạy: bash run.sh

Truy cập http://localhost:8099/dashboard, /packing hoặc /reports.
Đăng nhập bằng tài khoản được cấp. Nhấn Ctrl+C để dừng ứng dụng.

Cấu hình bằng biến môi trường:
- VTP_API_URL: địa chỉ dịch vụ API.
- VTP_MEDIA_URL: địa chỉ dịch vụ media.
- VTP_MEDIA_SIGNED_HOST: host:port dùng để ký URL media, khớp S3_PUBLIC_ENDPOINT.
- VTP_BIND_HOST: địa chỉ lắng nghe, mặc định 127.0.0.1.
- VTP_PORT: cổng ứng dụng, mặc định 8099.

API và media phải truy cập được từ máy chạy ứng dụng. Tài khoản và quyền
truy cập được quản lý tại dịch vụ API. Không chia sẻ thông tin đăng nhập,
token hoặc URL media đã ký. Chạy đầy đủ gói ứng dụng để phục vụ giao diện,
API và media; không triển khai riêng thư mục dist lên static hosting.
"""


def package(destination=None):
    if not (ROOT / 'dist/index.html').is_file():
        raise RuntimeError('Build the UI before packaging.')
    files = [ROOT / name for name in ('server.py', 'contracts.py', 'requirements.txt')]
    files += sorted(path for path in (ROOT / 'dist').rglob('*') if path.is_file())
    for path in files:
        if path.is_symlink() or ROOT not in path.resolve().parents:
            raise RuntimeError('Cannot package symlinks or files outside the application.')
        allowed = ('.html', '.js', '.css', '.svg', '.jpg', '.png', '.woff', '.woff2', '.ico') if path.relative_to(ROOT).parts[0] == 'dist' else ('.py', '.txt')
        if path.suffix not in allowed:
            raise RuntimeError('Unexpected deployment artifact: ' + path.name)
    destination = destination or ROOT / 'releases/vtp-packing.zip'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, 'vtp-packing/' + path.relative_to(ROOT).as_posix())
        info = ZipInfo('vtp-packing/run.sh')
        info.external_attr = 0o100755 << 16
        archive.writestr(info, LAUNCHER)
        archive.writestr('vtp-packing/README.md', README)
    checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(checksum + '  ' + destination.name + '\n')
    return destination


if __name__ == '__main__':
    print(package())
