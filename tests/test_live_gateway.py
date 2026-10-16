import unittest
import httpx
import server

ID = '11111111-1111-1111-1111-111111111111'


class LiveGatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.seen = []
        self.allowed = True
        def upstream(request):
            self.seen.append(request)
            if request.url.path.endswith('/dashboard'):
                return httpx.Response(200, json={'warehouses': [{'tables': [{'id': ID, 'enabled': True, 'cameras': {'overview': {'enabled': self.allowed}}}]}]})
            if request.method == 'POST':
                return httpx.Response(201, content=b'sdp-answer', headers={'Content-Type':'application/sdp', 'Location':f'http://upstream/tables/{ID}/overview/whep/session1'})
            if request.method == 'DELETE':
                return httpx.Response(204)
            return httpx.Response(200, content=b'#EXTM3U\nsegment.mp4', headers={'Content-Type':'application/vnd.apple.mpegurl'})
        self.remote = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
        server.app.state.client = self.remote
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test',headers={'Authorization':'Bearer test'})

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.remote.aclose()

    async def test_live_routes(self):
        for path in ['/live','/live/']:
            self.assertEqual((await self.client.get(path)).status_code,200)

    async def test_hls_and_whep(self):
        path = f'/tables/{ID}/overview/'
        response = await self.client.get(path + 'index.m3u8?_HLS_msn=1')
        self.assertEqual(response.status_code,200)
        self.assertIn('#EXTM3U',response.text)
        self.assertEqual(self.seen[-2].headers['authorization'],'Bearer test')
        response = await self.client.post(path + 'whep', content='sdp-offer')
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.headers['location'], path + 'whep/session1')
        self.assertEqual(self.seen[-1].content,b'sdp-offer')
        self.assertEqual((await self.client.delete(path + 'whep/session1')).status_code,204)

    async def test_hls_cookie_redirect(self):
        requests = []
        def upstream(request):
            requests.append(request)
            if request.url.path.endswith('/dashboard'):
                return httpx.Response(200, json={'warehouses': [{'tables': [{'id': ID, 'enabled': True, 'cameras': {'overview': {'enabled': True}}}]}]})
            if 'cookieCheck' not in request.url.params:
                return httpx.Response(302, headers={'Location': str(request.url) + '?cookieCheck=1', 'Set-Cookie': 'checked=yes; Path=/'})
            return httpx.Response(200, content=b'#EXTM3U', headers={'Content-Type': 'application/vnd.apple.mpegurl'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as remote:
            server.app.state.client = remote
            response = await self.client.get(f'/tables/{ID}/overview/index.m3u8')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, '#EXTM3U')
        self.assertIn('checked=yes', requests[-1].headers.get('cookie', ''))

    async def test_hls_session_query(self):
        path = f'/tables/{ID}/overview/video1_stream.m3u8?session={ID}'
        response = await self.client.get(path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.seen[-1].url.params['session'], ID)
        count = len(self.seen)
        response = await self.client.get(f'/tables/{ID}/overview/video1_stream.m3u8?session=invalid')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(self.seen), count)

    async def test_disconnected_stream_request(self):
        messages = []
        async def receive():
            return {'type': 'http.disconnect'}
        async def send(message):
            messages.append(message)
        path = f'/tables/{ID}/overview/whep'
        scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                 'method': 'POST', 'scheme': 'http', 'path': path, 'raw_path': path.encode(),
                 'query_string': b'', 'root_path': '', 'server': ('test', 80), 'client': ('test', 1234),
                 'headers': [(b'authorization', b'Bearer test'), (b'content-type', b'application/sdp')]}
        await server.app(scope, receive, send)
        self.assertEqual(messages[0]['status'], 499)
        self.assertTrue(all(request.url.path.endswith('/dashboard') for request in self.seen))

    async def test_access_restrictions(self):
        path = f'/tables/{ID}/overview/index.m3u8'
        self.assertEqual((await self.client.get(path,headers={'Authorization':''})).status_code,401)
        self.assertFalse(self.seen)
        self.allowed = False
        self.assertEqual((await self.client.get(path)).status_code,403)
        self.assertEqual(len(self.seen),1)
        for path in [f'/tables/{ID}/overview/admin',f'/tables/{ID}/other/index.m3u8']:
            self.assertIn((await self.client.get(path)).status_code,(403,404))
        self.assertEqual(len(self.seen),1)
