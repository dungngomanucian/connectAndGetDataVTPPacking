# VTP Packing

An application for monitoring packing operations, looking up orders, reviewing image/video evidence, and reporting operational activity.

## Features

- **Dashboard** (`/dashboard`): monitor packing station activity and access related sessions.
- **Orders** (`/packing`): search by order or session code; filter by time, station type, station, and status; browse pages and refresh data.
- **Playback**: view images and videos, switch camera angles, control playback, and download videos in supported layouts.
- **Reports** (`/reports`): filter by warehouse, station, time, and keyword; view daily output, station performance, and charts; sort, browse pages, and export to Excel.

Use the sidebar to switch pages, or the menu button on mobile devices. Reports refresh automatically every 15 seconds while the tab is visible.

## Run from source

From the application directory:

```bash
bash run.sh
```

Open [http://localhost:8099/dashboard](http://localhost:8099/dashboard) and sign in with your assigned account. You can also open `/packing` or `/reports` directly. Press **Ctrl+C** to stop.

The script supports Linux x86_64/ARM64 and prepares Node.js, uv, and the required dependencies. Python 3.10+ and network access are required for the initial dependency installation.

## Service configuration

Set the environment variables before starting the application:

| Variable | Default | Description |
| --- | --- | --- |
| `VTP_API_URL` | `http://192.168.1.94:18080` | VTP API service URL. |
| `VTP_MEDIA_URL` | `http://192.168.1.94:18000` | Media service URL. |
| `VTP_MEDIA_SIGNED_HOST` | `192.168.1.94:18000` | Host and port used to sign media URLs; must match `S3_PUBLIC_ENDPOINT`. |
| `VTP_BIND_HOST` | `127.0.0.1` | Network interface on which the application listens. |
| `VTP_PORT` | `8099` | Application port. |

Example deployment on a machine that can reach the API and media services:

```bash
VTP_API_URL="http://192.168.1.94:18080" \
VTP_MEDIA_URL="http://192.168.1.94:18000" \
VTP_MEDIA_SIGNED_HOST="192.168.1.94:18000" \
VTP_BIND_HOST="0.0.0.0" \
bash run.sh
```

Open `http://<server-address>:8099/dashboard`. Replace the service addresses with those for your deployment environment. The API and media services must be reachable from the application host. The signed host must match the host and port used to sign URLs for video playback to work correctly.

Accounts, access permissions, and data scope are managed by the API service. Do not share credentials, tokens, or signed media URLs.

## Packaging and deployment

```bash
bash package.sh
```

The deployment package is written to `releases/vtp-packing.zip`, with a SHA-256 checksum file alongside it. Extract the archive, configure the environment variables, and run `bash run.sh` from the `vtp-packing/` directory.

The deployment host requires Python 3.10+ and either uv or venv/pip; Node.js is not required. The application needs both the built frontend and the Python gateway to serve `/api` and `/media-proxy`. Do not deploy `dist/` alone to static hosting.

## Validation

In a development environment with dependencies installed:

```bash
npm run build
.venv/bin/python -m unittest discover -s tests -v
```

Automated checks use a simulated service. Before production use, verify sign-in, data access, video playback/downloads, and Excel exports against the configured services.
