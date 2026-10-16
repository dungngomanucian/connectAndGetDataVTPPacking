import json
import unittest
import httpx
import server


class SettingsGatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.seen = []
        def upstream(request):
            self.seen.append(request)
            if request.url.path.endswith('/file'):
                return httpx.Response(200, content=b'audio-data', headers={'Content-Type': 'audio/mpeg'})
            if request.url.path.endswith('/session-timeout'):
                return httpx.Response(200, json={'version': 2, 'max_session_seconds': 600, 'max_session_minutes': 10, 'internal': 'private'})
            asset = {'event_type': 'start', 'version': 2, 'configured': True, 'filename': 'sound.mp3', 'media_type': 'audio/mpeg', 'size_bytes': 10, 'duration_seconds': 1, 'internal': 'private'}
            return httpx.Response(200, json={'assets': {'start': asset, 'end': asset}} if request.url.path.endswith('/audio-settings') else asset)
        self.remote = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
        server.app.state.client = self.remote
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test',headers={'Authorization':'Bearer test'})

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.remote.aclose()

    async def test_routes_and_metadata(self):
        for path in ['/settings','/settings/','/api/v1/ui/audio-settings','/api/v1/ui/session-timeout']:
            response = await self.client.get(path)
            self.assertEqual(response.status_code,200)
            self.assertNotIn('private',response.text)

    async def test_timeout_forwarding(self):
        body = {'expected_version':1,'max_session_minutes':12.5}
        response = await self.client.put('/api/v1/ui/session-timeout',json=body)
        self.assertEqual(response.status_code,200)
        self.assertEqual(json.loads(self.seen[-1].content),body)
        for body in ({'expected_version':1,'max_session_minutes':0}, {'expected_version':1,'max_session_minutes':10,'scanner':{}}):
            self.assertEqual((await self.client.put('/api/v1/ui/session-timeout',json=body)).status_code,400)

    async def test_audio_upload_playback_and_reset(self):
        response = await self.client.put('/api/v1/ui/audio-settings/start',data={'expected_version':'1'},files={'file':('sound.mp3',b'audio-data','audio/mpeg')})
        self.assertEqual(response.status_code,200)
        self.assertIn(b'audio-data',self.seen[-1].content)
        self.assertIn('multipart/form-data',self.seen[-1].headers['content-type'])
        self.assertNotIn('private',response.text)
        response = await self.client.get('/api/v1/ui/audio-settings/start/file')
        self.assertEqual(response.content,b'audio-data')
        response = await self.client.delete('/api/v1/ui/audio-settings/start?expected_version=2')
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.seen[-1].url.params['expected_version'],'2')

    async def test_restricts_access(self):
        self.assertEqual((await self.client.get('/api/v1/ui/audio-settings',headers={'Authorization':''})).status_code,401)
        self.assertEqual((await self.client.put('/api/v1/ui/audio-settings/other',content=b'file')).status_code,403)
        self.assertEqual((await self.client.put('/api/v1/ui/audio-settings/start',content=b'file')).status_code,400)
        self.assertFalse(self.seen)
