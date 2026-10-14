"""Package a deployment allowlist, never the main project or development folders."""
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
export VTP_MEDIA_URL="${VTP_MEDIA_URL:-http://127.0.0.1:18000}"
exec .venv/bin/python -m uvicorn server:app --host "${VTP_BIND_HOST:-127.0.0.1}" --port "${VTP_PORT:-8099}" --no-access-log
'''
README = '''# Dashboard mini — runtime only

Requires Python 3.10+ and either uv or Python venv/pip. No Node.js or FFmpeg required.
Extract and run ./run.sh, then open http://localhost:8099/dashboard.
Configure the main server using environment variables:
VTP_API_URL, VTP_MEDIA_URL, VTP_MEDIA_SIGNED_HOST, VTP_BIND_HOST, VTP_PORT.
VTP_MEDIA_SIGNED_HOST must match the host:port in the main server's S3_PUBLIC_ENDPOINT.
Use a VIEWER account for browsing. The main server must enforce its own permissions;
this gateway cannot restrict a main-system token used directly against the main server.
Only dashboard APIs and the six-layout export are exposed. Export runs on the main server.
Browser UI code is necessarily visible; backend recognition/recording/rendering code is not included.
'''


def package(destination=None):
    if not (ROOT / 'dist/index.html').is_file():
        raise RuntimeError('Build the UI before packaging.')
    files = [ROOT / name for name in ('server.py', 'contracts.py', 'requirements.txt')]
    files += sorted(path for path in (ROOT / 'dist').rglob('*') if path.is_file())
    for path in files:
        if path.is_symlink() or ROOT not in path.resolve().parents:
            raise RuntimeError('Cannot package symlinks or files outside the mini app.')
        allowed = ('.html', '.js', '.css', '.svg', '.jpg', '.png', '.woff', '.woff2', '.ico') if path.relative_to(ROOT).parts[0] == 'dist' else ('.py', '.txt')
        if path.suffix not in allowed:
            raise RuntimeError('Unexpected deployment artifact: ' + path.name)
    destination = destination or ROOT / 'releases/dashboard-mini.zip'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, 'dashboard-mini/' + path.relative_to(ROOT).as_posix())
        info = ZipInfo('dashboard-mini/run.sh')
        info.external_attr = 0o100755 << 16
        archive.writestr(info, LAUNCHER)
        archive.writestr('dashboard-mini/README.md', README)
    checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(checksum + '  ' + destination.name + '\n')
    return destination


if __name__ == '__main__':
    print(package())
