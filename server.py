
import json
import os
import re
import base64
import shlex
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID as UUIDValue

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.requests import ClientDisconnect

from contracts import DASHBOARD, LOGIN, NEARBY, OUTPUTS, PAGE, PLAYBACK, REPRESENTATIVE, SESSION, USER, REPORT_SUMMARY, REPORT_WAREHOUSE, WAREHOUSE_CHOICE, WAREHOUSE_PAGE, WAREHOUSE_RECORD, WAREHOUSE_LIST, WAREHOUSE_DESKS, DELETED, AUDIO_ASSET, AUDIO_SETTINGS, SESSION_TIMEOUT, project

CONFIG_KEYS = {'VTP_API_URL', 'VTP_MEDIA_URL', 'VTP_MEDIA_SIGNED_HOST', 'VTP_HLS_URL', 'VTP_WHEP_URL', 'VTP_LIVE_AUTHORIZATION', 'VTP_LIVE_USERNAME', 'VTP_LIVE_PASSWORD'}
ENV_FILE = Path(__file__).parent / '.env'
if ENV_FILE.is_file():
    for line in ENV_FILE.read_text().splitlines():
        key, separator, value = line.partition('=')
        if separator and key.strip() in CONFIG_KEYS:
            parts = shlex.split(value, comments=True)
            if len(parts) <= 1:
                os.environ.setdefault(key.strip(), parts[0] if parts else '')

API = os.environ.get('VTP_API_URL', 'http://192.168.1.94:18080').rstrip('/')
MEDIA = os.environ.get('VTP_MEDIA_URL', 'http://192.168.1.94:18000').rstrip('/')
MEDIA_HOST = os.environ.get('VTP_MEDIA_SIGNED_HOST', urlsplit(MEDIA).netloc)
HLS = os.environ.get('VTP_HLS_URL', 'http://192.168.1.94:18888').rstrip('/')
WHEP = os.environ.get('VTP_WHEP_URL', 'http://192.168.1.94:18889').rstrip('/')
LIVE_AUTH = os.environ.get('VTP_LIVE_AUTHORIZATION', '')
if not LIVE_AUTH and os.environ.get('VTP_LIVE_USERNAME'):
    credentials = os.environ['VTP_LIVE_USERNAME'] + ':' + os.environ.get('VTP_LIVE_PASSWORD', '')
    LIVE_AUTH = 'Basic ' + base64.b64encode(credentials.encode()).decode()
UUID = r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
LAYOUTS = {'overview_main', 'detail_main', 'vertical', 'horizontal', 'horizontal_40_60', 'horizontal_60_40'}
SESSION_QUERY = {'q', 'table_type', 'started_from', 'started_before', 'per_table_limit',
                 'group_consecutive', 'limit', 'offset', 'table_id'}
REPORT_QUERY = {'warehouse_id', 'table_id', 'table_type', 'started_from', 'started_before', 'q', 'timezone'}

ROUTES = [
    ('GET', r'v1/ui/audio-settings', set(), AUDIO_SETTINGS),
    ('GET', r'v1/ui/audio-settings/(?:start|end)/file', set(), 'video'),
    ('PUT', r'v1/ui/audio-settings/(?:start|end)', set(), AUDIO_ASSET),
    ('DELETE', r'v1/ui/audio-settings/(?:start|end)', {'expected_version'}, AUDIO_ASSET),
    ('GET', r'v1/ui/session-timeout', set(), SESSION_TIMEOUT),
    ('PUT', r'v1/ui/session-timeout', set(), SESSION_TIMEOUT),
    ('DELETE', rf'v1/tables/{UUID}', set(), DELETED),
    ('GET', r'v1/warehouses/list', {'q', 'province', 'status', 'offset', 'limit'}, WAREHOUSE_LIST),
    ('POST', r'v1/warehouses', set(), WAREHOUSE_RECORD),
    ('PATCH', rf'v1/warehouses/{UUID}', set(), WAREHOUSE_RECORD),
    ('DELETE', rf'v1/warehouses/{UUID}', set(), DELETED),
    ('GET', rf'v1/ui/warehouses/{UUID}/tables', set(), WAREHOUSE_DESKS),
    ('GET', r'v1/ui/reports/summary', REPORT_QUERY, REPORT_SUMMARY),
    ('GET', r'v1/ui/reports/export-public', REPORT_QUERY, 'video'),
    ('GET', r'v1/ui/warehouses/page', {'q', 'limit', 'offset'}, WAREHOUSE_PAGE),
    ('GET', rf'v1/ui/warehouses/{UUID}/choice', set(), WAREHOUSE_CHOICE),
    ('GET', rf'v1/warehouses/{UUID}/catalog', set(), REPORT_WAREHOUSE),
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


@app.exception_handler(ClientDisconnect)
async def client_disconnected(request: Request, exception: ClientDisconnect):
    return Response(status_code=499)


def route_contract(method, path):
    for allowed_method, pattern, query, schema in ROUTES:
        if method == allowed_method and re.fullmatch(pattern, path):
            return query, schema
    raise HTTPException(403, 'API này không được phép sử dụng trong ứng dụng.')


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
    detail = messages.get(status, 'Dịch vụ API chưa xử lý được yêu cầu.')
    try:
        payload = json.loads(await upstream.aread())
        code = payload.get('detail', {}).get('code') if isinstance(payload.get('detail'), dict) else None
        if isinstance(code, str) and re.fullmatch(r'[A-Z_]{1,64}', code):
            detail = {'code': code}
    except (ValueError, AttributeError):
        pass
    await upstream.aclose()

    return JSONResponse({'detail': detail}, status_code=status if 400 <= status < 600 else 502,
                        headers={'Cache-Control': 'no-store'})


async def public_events(upstream):

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
            raise HTTPException(403, 'Cần link video đã ký từ dịch vụ.')
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
            maximum = 10 * 1024 * 1024 + 65536 if request.method == 'PUT' and re.fullmatch(r'v1/ui/audio-settings/(?:start|end)', path) else 16384
            if len(chunks) > maximum:
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
        elif request.method == 'PUT' and re.fullmatch(r'v1/ui/audio-settings/(?:start|end)', path):
            content_type = request.headers.get('content-type', '')
            if not re.fullmatch(r'multipart/form-data;\s*boundary=[a-zA-Z0-9_-]{1,100}', content_type):
                raise HTTPException(400, 'Định dạng tải lên không hợp lệ.')
            headers['content-type'] = content_type
        elif request.method == 'PUT' and path == 'v1/ui/session-timeout':
            try:
                payload = json.loads(body)
                if not isinstance(payload, dict) or set(payload) != {'expected_version', 'max_session_minutes'}:
                    raise ValueError()
                if type(payload['expected_version']) is not int or type(payload['max_session_minutes']) not in (int, float) or not 0 < payload['max_session_minutes'] < float('inf'):
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(400, 'Cài đặt không hợp lệ.') from None
            headers['content-type'] = 'application/json'
        elif request.method in ('POST', 'PATCH') and re.fullmatch(rf'v1/warehouses(?:/{UUID})?', path):
            try:
                payload = json.loads(body)
                fields = {'code', 'name', 'province', 'address', 'enabled', 'sort_order'} if request.method == 'POST' else {'expected_version', 'name', 'province', 'address', 'enabled'}
                required = {'code', 'name'} if request.method == 'POST' else {'expected_version'}
                if not isinstance(payload, dict) or set(payload) - fields or not required <= set(payload):
                    raise ValueError()
                for key, value in payload.items():
                    if key in ('enabled',):
                        valid = isinstance(value, bool)
                    elif key in ('sort_order', 'expected_version'):
                        valid = isinstance(value, int) and not isinstance(value, bool)
                    else:
                        valid = isinstance(value, str)
                    if not valid:
                        raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(400, 'Thông tin kho không hợp lệ.') from None
            headers['content-type'] = 'application/json'
        elif request.method == 'DELETE':
            if body:
                raise HTTPException(400, 'Yêu cầu không nhận dữ liệu bổ sung.')
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
        raise HTTPException(502, 'Không kết nối được dịch vụ.') from None
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
            raise HTTPException(502, 'Phản hồi dịch vụ không hợp lệ.') from None
        finally:
            await upstream.aclose()

    forwarded = {key: value for key, value in upstream.headers.items()
                 if key.lower() in ('content-type', 'content-disposition', 'content-range',
                                    'accept-ranges', 'etag', 'last-modified')}
    forwarded['Cache-Control'] = 'no-store'
    return StreamingResponse(upstream.aiter_bytes(), status_code=upstream.status_code,
                             headers=forwarded, background=BackgroundTask(upstream.aclose))


@app.api_route('/tables/{table_id:uuid}/{lens}/{resource:path}', methods=['GET', 'POST', 'DELETE'])
async def live_proxy(request: Request, table_id: UUIDValue, lens: str, resource: str):
    if lens not in ('overview', 'detail') or not re.fullmatch(r'[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_-]+)?', resource) or '..' in resource:
        raise HTTPException(404)
    whep = resource == 'whep' or resource.startswith('whep/')
    if (whep and request.method not in ('POST', 'DELETE')) or (not whep and (request.method != 'GET' or not resource.endswith(('.m3u8', '.mp4', '.m4s', '.ts')))):
        raise HTTPException(403)
    if (request.method == 'POST' and resource != 'whep') or (request.method == 'DELETE' and not resource.startswith('whep/')):
        raise HTTPException(403)
    if set(request.query_params) - {'_HLS_msn', '_HLS_part', '_HLS_skip', 'session'}:
        raise HTTPException(400)
    session = request.query_params.get('session')
    if session is not None and not re.fullmatch(UUID, session):
        raise HTTPException(400, 'Phiên media không hợp lệ.')
    authorization = check_authorization(request)
    client = app.state.client
    try:
        catalog = await client.get(API + '/api/v1/ui/dashboard', headers={'authorization': authorization})
        if catalog.status_code != 200:
            return await safe_error(catalog)
        tables = [table for warehouse in catalog.json().get('warehouses', []) for table in warehouse.get('tables', [])]
        table = next((table for table in tables if table.get('id') == str(table_id)), None)
        camera = (table or {}).get('cameras', {}).get(lens)
        if not table or not table.get('enabled') or not camera or not camera.get('enabled'):
            raise HTTPException(403, 'Không có quyền truy cập camera.')
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 65536:
                raise HTTPException(413)
        headers = {'content-type': 'application/sdp'} if request.method == 'POST' else {}
        if LIVE_AUTH:
            headers['authorization'] = LIVE_AUTH
        target = (WHEP if whep else HLS) + f'/tables/{table_id}/{lens}/{resource}'
        if request.url.query:
            target += '?' + request.url.query
        upstream = await client.send(client.build_request(request.method, target, headers=headers, content=bytes(body)), stream=True)
        if not whep and upstream.status_code in (301, 302, 303, 307, 308):
            from urllib.parse import urljoin, parse_qs
            redirected = urlsplit(urljoin(target, upstream.headers.get('location', '')))
            original = urlsplit(target)
            query = parse_qs(redirected.query)
            if (redirected.scheme, redirected.netloc, redirected.path) != (original.scheme, original.netloc, original.path) or set(query) - {'cookieCheck', '_HLS_msn', '_HLS_part', '_HLS_skip', 'session'} or query.get('cookieCheck') != ['1']:
                await upstream.aclose()
                raise HTTPException(502, 'Chuyển hướng media không hợp lệ.')
            await upstream.aclose()
            upstream = await client.send(client.build_request('GET', redirected.geturl(), headers=headers), stream=True)
    except (httpx.RequestError, ValueError):
        raise HTTPException(502, 'Không kết nối được dịch vụ trực tiếp.') from None
    if not 200 <= upstream.status_code < 300:
        return await safe_error(upstream)
    forwarded = {'Cache-Control': 'no-store'}
    if 'content-type' in upstream.headers:
        forwarded['content-type'] = upstream.headers['content-type']
    if whep and request.method == 'POST':
        location = upstream.headers.get('location')
        if location:
            from urllib.parse import urljoin
            resolved = urlsplit(urljoin(target, location))
            expected = f'/tables/{table_id}/{lens}/whep/'
            if resolved.path.startswith(expected) and re.fullmatch(r'[a-zA-Z0-9_-]+', resolved.path[len(expected):]):
                forwarded['Location'] = resolved.path
    return StreamingResponse(upstream.aiter_bytes(), status_code=upstream.status_code,
                             headers=forwarded, background=BackgroundTask(upstream.aclose))


DIST = Path(__file__).parent / 'dist'


@app.get('/settings', include_in_schema=False)
@app.get('/settings/', include_in_schema=False)
@app.get('/live', include_in_schema=False)
@app.get('/live/', include_in_schema=False)
@app.get('/warehouse', include_in_schema=False)
@app.get('/warehouse/', include_in_schema=False)
@app.get('/warehouse/{warehouse_id:uuid}/desks', include_in_schema=False)
@app.get('/warehouse/{warehouse_id:uuid}/desks/', include_in_schema=False)
@app.get('/reports', include_in_schema=False)
@app.get('/reports/', include_in_schema=False)
@app.get('/packing', include_in_schema=False)
@app.get('/packing/', include_in_schema=False)
@app.get('/dashboard', include_in_schema=False)
@app.get('/dashboard/', include_in_schema=False)
def dashboard():
    if not (DIST / 'index.html').is_file():
        raise HTTPException(503, 'Chưa build giao diện. Hãy chạy run.sh.')
    return FileResponse(DIST / 'index.html')


if DIST.is_dir():
    app.mount('/', StaticFiles(directory=DIST, html=True), name='ui')
