
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent / '.tools'
ROOT.mkdir(exist_ok=True)
ARCH = {'x86_64': ('x64', 'x86_64'), 'aarch64': ('arm64', 'aarch64')}.get(platform.machine())
if platform.system() != 'Linux' or ARCH is None:
    raise SystemExit('Automatic setup supports Linux x86_64/ARM64. Install Node.js 22+ and uv for this machine.')


def download(url, path):
    with urllib.request.urlopen(url, timeout=120) as response, open(path, 'wb') as target:
        shutil.copyfileobj(response, target)


def extract(archive, target):

    with tarfile.open(archive) as bundle:
        for member in bundle.getmembers():
            resolved = (target / member.name).resolve()
            if target.resolve() not in resolved.parents:
                raise RuntimeError('Invalid path in the tool archive.')
            if not (member.isfile() or member.isdir()):
                continue
            bundle.extract(member, target)


node = ROOT / 'node' / 'bin' / 'node'
node_cmd = str(node) if node.exists() else shutil.which('node')
node_ok = False
if node_cmd and shutil.which('npm', path=str(ROOT / 'node' / 'bin') + os.pathsep + os.environ['PATH']):
    version = subprocess.check_output([node_cmd, '-p', 'process.versions.node'], text=True).strip()
    major, minor, *_ = map(int, version.split('.'))
    node_ok = (major == 22 and minor >= 12) or major >= 24
if not node_ok:
    print('Preparing Node.js 22 in vtp-packing/.tools…', flush=True)
    base = 'https://nodejs.org/dist/latest-v22.x/'
    with urllib.request.urlopen(base + 'SHASUMS256.txt', timeout=120) as response:
        lines = response.read().decode().splitlines()
    checksum, filename = next(line.split() for line in lines if line.endswith(f'-linux-{ARCH[0]}.tar.xz'))
    with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
        temp = Path(temporary)
        archive = temp / filename
        download(base + filename, archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
            raise RuntimeError('Node.js checksum mismatch.')
        extract(archive, temp)
        destination = ROOT / 'node'
        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(str(temp / filename.removesuffix('.tar.xz')), destination)
        for command in ('npm', 'npx'):
            (destination / 'bin' / command).symlink_to(f'../lib/node_modules/npm/bin/{command}-cli.js')

if not (ROOT / 'uv' / 'uv').exists() and not shutil.which('uv'):
    print('Preparing uv in vtp-packing/.tools…', flush=True)
    package = f'uv-{ARCH[1]}-unknown-linux-gnu'
    with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
        temp = Path(temporary)
        archive = temp / 'uv.tar.gz'
        download(f'https://github.com/astral-sh/uv/releases/latest/download/{package}.tar.gz', archive)
        extract(archive, temp)
        shutil.move(str(temp / package), ROOT / 'uv')
