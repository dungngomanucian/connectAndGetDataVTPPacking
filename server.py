"""Dashboard-only gateway. All business processing remains on the main VTP server."""
import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask

from contracts import DASHBOARD, LOGIN, NEARBY, OUTPUTS, PAGE, PLAYBACK, REPRESENTATIVE, SESSION, USER, project

API = os.environ.get('VTP_API_URL', 'http://192.168.1.94:18080').rstrip('/')
MEDIA = os.environ.get('VTP_MEDIA_URL', 'http://192.168.1.94:18000').rstrip('/')
MEDIA_HOST = os.environ.get('VTP_MEDIA_SIGNED_HOST', urlsplit(MEDIA).netloc)
UUID = r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
LAYOUTS = {'overview_main', 'detail_main', 'vertical', 'horizontal', 'horizontal_40_60', 'horizontal_60_40'}
SESSION_QUERY = {'q', 'table_type', 'started_from', 'started_before', 'per_table_limit',
                 'group_consecutive', 'limit', 'offset', 'table_id'}
# Exact method + path + query allowlist. No generic forwarding to admin/internal APIs.
ROUTES = [
    ('POST', r'v1/auth/login', set(), LOGIN),
    ('GET', r'v1/auth/me', set(), USER),
    ('GET', r'v1/ui/dashboard', set(), DASHBOARD),
    ('GET', r'v1/ui/events', set(), 'events'),
    ('GET', r'v1/ui/tables', set(), [{'id': None, 'code': None, 'name': None}]),
    ('GET', r'v1/ui/sessions', SESSION_QUERY, [SESSION]),
    ('GET', r'v1/ui/sessions/page', SESSION_QUERY | {'status', 'group', 'tab'}, PAGE),
    ('GET', rf'v1/ui/sessions/{UUID}/playback', set(), PLAYBACK),
    ('GET', rf'v1/ui/sessions/{UUID}/nearby', {'limit', 'offset'}, NEARBY),
    ('GET', r'v1/ui/video-merges/representative', {'session_group_seed_id'}, REPRESENTATIVE),
    ('GET', rf'v1/ui/video-merges/{UUID}/playback', set(), OUTPUTS),
    ('POST', rf'v1/ui/(?:sessions|video-merges)/{UUID}/download-pip', {'layout'}, 'video'),
]


@asynccontextmanager
async def lifespan(app):
    app.state.client = httpx.AsyncClient(timeout=httpx.Timeout(600, connect=10), follow_redirects=False)
    yield
    await app.state.client.aclose()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def route_contract(method, path):
    for allowed_method, pattern, query, schema in ROUTES:
        if method == allowed_method and re.fullmatch(pattern, path):
            return query, schema
    raise HTTPException(403, 'API này không được phép sử dụng trong dashboard mini.')


def check_authorization(request):
    authorization = request.headers.get('authorization', '')
    if not authorization.startswith('Bearer ') or not authorization[7:].strip():
        raise HTTPException(401, 'Vui lòng đăng nhập.')
    return authorization


async def safe_error(upstream):
    status = upstream.status_code
    messages = {401: 'Tên đăng nhập, mật khẩu hoặc phiên đăng nhập không hợp lệ.',
                403: 'Tài khoản không có quyền truy cập.', 404: 'Không tìm thấy dữ liệu.',
                409: 'Video chưa sẵn sàng.', 422: 'Yêu cầu không hợp lệ.',
                429: 'Quá nhiều yêu cầu. Vui lòng thử lại.'}
    detail = messages.get(status, 'Hệ thống chính chưa xử lý được yêu cầu.')
    try:
        payload = json.loads(await upstream.aread())
        code = payload.get('detail', {}).get('code') if isinstance(payload.get('detail'), dict) else None
        if isinstance(code, str) and re.fullmatch(r'[A-Z_]{1,64}', code):
            detail = {'code': code}
    except (ValueError, AttributeError):
        pass
    await upstream.aclose()
    # Never expose an upstream redirect/internal URL or raw exception to the browser.
    return JSONResponse({'detail': detail}, status_code=status if 400 <= status < 600 else 502,
                        headers={'Cache-Control': 'no-store'})


async def public_events(upstream):
    """Only send invalidation type, never node IDs/configuration from event payloads."""
    try:
        async for line in upstream.aiter_lines():
            if line.startswith(':'):
                yield ': keepalive\n\n'
            elif line.startswith('data:'):
                try:
                    event = json.loads(line[5:])
                except ValueError:
                    continue
                kind = event.get('type') if isinstance(event, dict) else None
                if isinstance(kind, str) and re.fullmatch(r'[a-z_]{1,64}', kind):
                    yield 'data: ' + json.dumps({'type': kind}) + '\n\n'
    finally:
        await upstream.aclose()


@app.api_route('/api/{path:path}', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
@app.api_route('/media-proxy/{path:path}', methods=['GET', 'HEAD'])
async def proxy(request: Request, path: str):
    media = request.url.path.startswith('/media-proxy/')
    if media:
        if (not path.startswith('vtp-video-evidence/') or '\\' in path or '%' in path
                or any(part in ('', '.', '..') for part in path.split('/'))):
            raise HTTPException(404)
        signed_v4 = bool(request.query_params.get('X-Amz-Signature'))
        signed_v2 = all(request.query_params.get(key) for key in ('AWSAccessKeyId', 'Signature', 'Expires'))
        if not (signed_v4 or signed_v2):
            raise HTTPException(403, 'Cần link video đã ký từ hệ thống chính.')
        target, schema = MEDIA + '/' + path, 'video'
        body = b''
        headers = {key: value for key, value in request.headers.items()
                   if key.lower() in ('range', 'if-none-match', 'if-modified-since')}
        headers['host'] = MEDIA_HOST
    else:
        allowed_query, schema = route_contract(request.method, path)
        if set(request.query_params) - allowed_query:
            raise HTTPException(400, 'Tham số không được phép.')
        target = API + '/api/' + path
        headers = {}
        if path != 'v1/auth/login':
            headers['authorization'] = check_authorization(request)
        chunks = bytearray()
        async for chunk in request.stream():
            chunks.extend(chunk)
            if len(chunks) > 16384:
                raise HTTPException(413, 'Yêu cầu quá lớn.')
        body = bytes(chunks)
        if path == 'v1/auth/login':
            if len(body) > 16384:
                raise HTTPException(413, 'Yêu cầu quá lớn.')
            try:
                login = json.loads(body)
                if not isinstance(login, dict) or set(login) != {'username', 'password'} or not all(isinstance(v, str) for v in login.values()):
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(400, 'Thông tin đăng nhập không hợp lệ.') from None
            headers['content-type'] = 'application/json'
        elif request.method == 'POST':
            if body:
                raise HTTPException(400, 'Yêu cầu tải video không nhận dữ liệu bổ sung.')
            if request.query_params.get('layout', 'overview_main') not in LAYOUTS:
                raise HTTPException(400, 'Bố cục không hợp lệ.')
    if request.url.query:
        target += '?' + request.url.query
    try:
        upstream = await app.state.client.send(app.state.client.build_request(
            request.method, target, headers=headers, content=body), stream=True)
    except httpx.RequestError:
        raise HTTPException(502, 'Không kết nối được hệ thống chính.') from None
    if media and upstream.status_code == 304:
        await upstream.aclose()
        return Response(status_code=304, headers={'Cache-Control': 'no-store'})
    if not 200 <= upstream.status_code < 300:
        return await safe_error(upstream)
    if schema == 'events':
        return StreamingResponse(public_events(upstream), media_type='text/event-stream',
                                 headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})
    if schema != 'video':
        try:
            data = json.loads(await upstream.aread())
            return JSONResponse(project(data, schema), headers={'Cache-Control': 'no-store'})
        except ValueError:
            raise HTTPException(502, 'Phản hồi hệ thống chính không hợp lệ.') from None
        finally:
            await upstream.aclose()
    # Binary media/export only. No upstream server headers, cookies or redirects.
    forwarded = {key: value for key, value in upstream.headers.items()
                 if key.lower() in ('content-type', 'content-disposition', 'content-range',
                                    'accept-ranges', 'etag', 'last-modified')}
    forwarded['Cache-Control'] = 'no-store'
    return StreamingResponse(upstream.aiter_bytes(), status_code=upstream.status_code,
                             headers=forwarded, background=BackgroundTask(upstream.aclose))


DIST = Path(__file__).parent / 'dist'


@app.get('/dashboard', include_in_schema=False)
@app.get('/dashboard/', include_in_schema=False)
def dashboard():
    if not (DIST / 'index.html').is_file():
        raise HTTPException(503, 'Chưa build giao diện. Hãy chạy run.sh.')
    return FileResponse(DIST / 'index.html')


if DIST.is_dir():
    app.mount('/', StaticFiles(directory=DIST, html=True), name='ui')
