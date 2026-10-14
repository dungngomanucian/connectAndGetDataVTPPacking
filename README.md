# VTP Packing Dashboard

A lightweight dashboard for viewing packing sessions and video evidence from an existing VTP installation. The application provides a focused interface for dashboard and playback workflows; authentication, business data, and access permissions remain managed by the main VTP system.

## Run the application

From the project root, run:

```bash
bash run.sh
```

Open [http://localhost:8099/dashboard](http://localhost:8099/dashboard) and sign in with your existing VTP account. Press **Ctrl+C** in the terminal to stop the application.

On first run, the setup script downloads Node.js 22 and `uv` into `.tools`, creates a Python virtual environment in `.venv`, installs the project dependencies, builds the frontend, and starts the server. An internet connection is required for the initial setup. The provided setup script supports Linux on x86_64 and ARM64 and requires Python 3.10 or later. No system-wide npm, pip, Docker, or FFmpeg installation is required.

## Connect to a running VTP installation

The dashboard connects to an existing VTP API and media service. Configure these environment variables before running `run.sh`:

| Variable | Default | Description |
| --- | --- | --- |
| `VTP_API_URL` | `http://192.168.1.94:18080` | Base URL of the main VTP API. |
| `VTP_MEDIA_URL` | `http://192.168.1.94:18000` | Base URL of the video/media gateway or MinIO service. |
| `VTP_MEDIA_SIGNED_HOST` | `192.168.1.94:18000` | Host and port used in `S3_PUBLIC_ENDPOINT`; must match the host used to sign media URLs. |
| `VTP_BIND_HOST` | `127.0.0.1` | Network interface on which the dashboard server listens. |
| `VTP_PORT` | `8099` | Port on which the dashboard server listens. |

For example:

```bash
VTP_API_URL="http://192.168.1.94:18080" \
VTP_MEDIA_URL="http://192.168.1.94:18000" \
VTP_MEDIA_SIGNED_HOST="192.168.1.94:18000" \
bash run.sh
```

The API and media endpoints must be reachable from the machine running this application. The signed media host must match the host and port configured by the VTP media service so that signed video URLs remain valid.

## Build a release package

To build the distributable package, run:

```bash
bash package.sh
```


The package is written to `releases/dashboard-mini.zip`, with a SHA-256 checksum beside it. It includes the built frontend and Python gateway, without frontend source code or Node.js dependencies.

## Deploy the dashboard

The current application needs both the built frontend and the Python gateway. The gateway serves the UI and forwards `/api` and `/media-proxy` requests to VTP. Uploading only `dist/` to static hosting will not provide these routes.

To run from source on a Linux machine that can reach the VTP server:

```bash
VTP_API_URL="http://192.168.1.94:18080" \
VTP_MEDIA_URL="http://192.168.1.94:18000" \
VTP_MEDIA_SIGNED_HOST="192.168.1.94:18000" \
VTP_BIND_HOST="0.0.0.0" \
bash run.sh
```

Open `http://<dashboard-server-ip>:8099/dashboard` from another machine. Replace the example VTP address with your actual server address. `127.0.0.1` refers to the machine running the dashboard, so use it for upstream URLs only when VTP runs on that same machine.

Alternatively, build the release package, copy and extract it on the deployment machine, then run its `run.sh` with the same environment variables. The release requires Python 3.10+ and either `uv` or working Python venv/pip support; it does not include the source setup script that downloads tools automatically.

For a persistent deployment, manage the gateway with a service manager such as systemd. When serving through a domain, put an HTTPS reverse proxy in front of the gateway and forward UI, API, media, and event-stream requests to it. Keep the gateway bound to `127.0.0.1` when the reverse proxy runs on the same machine.

If you host the frontend separately, serve `dist/` and configure that frontend origin to proxy `/api` and `/media-proxy` to the Python gateway. Serve `/dashboard` using `index.html`. The proxy in `vite.config.ts` applies only to the development server; it is not included in the built frontend.
