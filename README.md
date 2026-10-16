# VTP Packing

An application for monitoring packing operations, looking up orders, reviewing image/video evidence, and reporting operational activity.

## Features

- **Dashboard** (`/dashboard`): monitor packing station activity and access related sessions.
- **Warehouses** (`/warehouse`): search and filter warehouses, browse pages, view details, and create, edit, or delete warehouses with confirmation. The station list shows operational information and links to orders and playback. Station and camera configuration is not available on this page.
- **Live** (`/live`): view live station cameras, filter by warehouse/station/type, switch camera angles, expand the player, and open recent order evidence. Order and station deletion actions are available in the detail panel; deletion requires confirmation and API permission. Station information and camera configuration actions are not shown.
- **Orders** (`/packing`): search by order or session code; filter by time, station type, station, and status; browse pages and refresh data.
- **Playback**: view images and videos, switch camera angles, control playback, and download videos in supported layouts.
- **Settings** (`/settings`): view and update the global session duration; preview, upload, replace, and reset start/end audio notifications. ADMIN and OPERATOR accounts can edit, subject to API permissions. Audio validation, storage and configuration updates run on the API service.
- **Reports** (`/reports`): filter by warehouse, station, time, and keyword; view daily output, station performance, and charts; sort, browse pages, and export to Excel.

Use the sidebar to switch pages, or the menu button on mobile devices. Reports refresh automatically every 15 seconds while the tab is visible.

## Run from source

From the application directory:

```bash
bash run.sh
```

Open [http://localhost:8099/dashboard](http://localhost:8099/dashboard) and sign in with your assigned account. You can also open `/warehouse`, `/live`, `/packing`, `/reports`, or `/settings` directly. Press **Ctrl+C** to stop.

The script supports Linux x86_64/ARM64 and prepares Node.js, uv, and the required dependencies. Python 3.10+ and network access are required for the initial dependency installation.

## Service configuration

Set the environment variables before starting the application:

| Variable | Default | Description |
| --- | --- | --- |
| `VTP_API_URL` | `http://192.168.1.94:18080` | VTP API service URL. |
| `VTP_MEDIA_URL` | `http://192.168.1.94:18000` | Media service URL. |
| `VTP_MEDIA_SIGNED_HOST` | `192.168.1.94:18000` | Host and port used to sign media URLs; must match `S3_PUBLIC_ENDPOINT`. |
| `VTP_BIND_HOST` | `127.0.0.1` | Network interface on which the application listens. |
| `VTP_HLS_URL` | `http://192.168.1.94:18888` | HLS service URL, reachable from the application server. |
| `VTP_WHEP_URL` | `http://192.168.1.94:18889` | WebRTC/WHEP service URL, reachable from the application server. |
| `VTP_LIVE_AUTHORIZATION` | Empty | Optional server-side Authorization header for the live media service. Do not use frontend environment variables for media credentials. |
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

Accounts, access permissions, and data scope are managed by the API service. Warehouse management requires an account with the permissions required by that service (ADMIN for the current warehouse API). Do not share credentials, tokens, or signed media URLs.

## Deploy from Git

Clone the repository onto a Linux host, open the repository directory, configure
the service environment variables or a local `.env` file, and run:

```bash
bash run.sh
```

The script installs dependencies, builds the frontend, and starts the Python gateway.
The application needs both the built frontend and the gateway to serve API and media
routes. Do not deploy `dist/` alone to static hosting.

Keep `.env`, credentials, runtime logs, and generated files out of Git. The repository's
`.gitignore` excludes these local files. Provision deployment credentials separately.

## Validation

In a development environment with dependencies installed:

```bash
npm run build
.venv/bin/python -m unittest discover -s tests -v
```

Automated checks use a simulated service. Before production use, verify sign-in, data access, video playback/downloads, and Excel exports against the configured services.

Live playback uses WebRTC with HLS fallback. WebRTC also requires the media server's advertised ICE addresses/ports to be reachable from the browser. Live media requests validate access through the API dashboard and do not expose RTSP sources or camera credentials.

The server reads service settings from `.env` in the application directory. You can set
`VTP_LIVE_USERNAME` and `VTP_LIVE_PASSWORD` there for media viewer authentication,
or supply `VTP_LIVE_AUTHORIZATION` explicitly. Process environment variables take
precedence. These credentials stay on the server; the local `.env` file is excluded from Git.
Restart the application after changing service settings.

Excel exports use `/api/v1/ui/reports/export-public`. The API service must support
this endpoint. The workbook contains totals, daily output and station performance
only. If the endpoint is unavailable, the application displays an export error.
