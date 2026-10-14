# VTP Packing Dashboard

A lightweight dashboard for viewing packing sessions and video evidence from an existing VTP installation. The application provides a focused interface for dashboard and playback workflows; authentication, business data, and access permissions remain managed by the main VTP system.

## Run the application

From the project root, run:

```bash
bash run.sh
```

Open [http://localhost:8099/dashboard](http://localhost:8099/dashboard) and sign in with your existing VTP account. Press **Ctrl+C** in the terminal to stop the application.
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

Open `http://<dashboard-server-ip>:8099/dashboard`.

