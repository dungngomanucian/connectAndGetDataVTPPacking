import json
import unittest
import httpx
import server

ID = '11111111-1111-1111-1111-111111111111'


class WarehouseGatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.seen = []
        def upstream(request):
            self.seen.append(request)
            record = {'id': ID, 'code': 'WH', 'name': 'Kho', 'version': 2, 'enabled': True,
                      'camera_total': 4, 'camera_enabled': 3, 'status': 'WARNING', 'internal': 'private'}
            if request.url.path.endswith('/tables'):
                return httpx.Response(200, json={'id': ID, 'name': 'Kho', 'tables': [{
                    **record, 'table_type': 'PACKING', 'activity': 'BUSY', 'scanner': {'regex': 'private'},
                    'node_id': 'private', 'pre_roll_seconds': 10, 'tote_codes': ['private'],
                    'cameras': {'DETAIL': {'source_url': 'private'}},
                    'current_session': {'id': ID, 'tracking_code': 'ORDER1', 'status': 'IN_PROGRESS', 'internal': 'private'}}]})
            if request.method == 'DELETE':
                return httpx.Response(200, json={'id': ID, 'deleted': True})
            if request.url.path.endswith('/list'):
                return httpx.Response(200, json={'items': [record], 'total': 21, 'limit': 10, 'offset': 10})
            return httpx.Response(200, json=record)
        self.remote = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
        server.app.state.client = self.remote
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test', headers={'Authorization': 'Bearer test'})

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.remote.aclose()

    async def test_list(self):
        query = 'q=WH&province=HN&status=warning&limit=10&offset=10'
        response = await self.client.get('/api/v1/warehouses/list?' + query)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.seen[-1].url.query.decode(), query)
        self.assertEqual(response.json()['items'][0]['status'], 'WARNING')
        self.assertEqual(response.json()['total'], 21)
        self.assertNotIn('private', response.text)

    async def test_crud(self):
        for method, path, body in [('POST', 'v1/warehouses', {'code': 'WH', 'name': 'Kho', 'enabled': True}), ('PATCH', f'v1/warehouses/{ID}', {'expected_version': 2, 'name': 'Kho 2'}), ('DELETE', f'v1/warehouses/{ID}', None)]:
            kwargs = {'json': body} if body is not None else {}
            response = await self.client.request(method, '/api/' + path, **kwargs)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(self.seen[-1].method, method)
            self.assertEqual(self.seen[-1].headers['authorization'], 'Bearer test')
            self.assertNotIn('private', response.text)
            if body is not None:
                self.assertEqual(json.loads(self.seen[-1].content), body)
                self.assertEqual(self.seen[-1].headers['content-type'], 'application/json')

    async def test_desks_exclude_configuration(self):
        response = await self.client.get(f'/api/v1/ui/warehouses/{ID}/tables')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('private', response.text)
        desk = response.json()['tables'][0]
        self.assertEqual(desk['current_session']['tracking_code'], 'ORDER1')
        for field in ('scanner', 'node_id', 'cameras', 'tote_codes', 'pre_roll_seconds'):
            self.assertNotIn(field, desk)

    async def test_payload_restrictions(self):
        for body in ({'code': 'WH', 'name': 'Kho', 'scanner': {}}, {'code': 'WH', 'name': 'Kho', 'enabled': 'yes'}):
            self.assertEqual((await self.client.post('/api/v1/warehouses', json=body)).status_code, 400)
        self.assertEqual((await self.client.patch(f'/api/v1/warehouses/{ID}', json={'name': 'Kho'})).status_code, 400)
        self.assertEqual((await self.client.post('/api/v1/warehouses', json={'code': 'WH', 'name': 'Kho'}, headers={'Authorization': ''})).status_code, 401)
        self.assertFalse(self.seen)

    async def test_delete_live_table(self):
        response = await self.client.delete(f'/api/v1/tables/{ID}')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['deleted'])
        self.assertEqual(self.seen[-1].method, 'DELETE')
        self.assertEqual(self.seen[-1].headers['authorization'], 'Bearer test')
        count = len(self.seen)
        response = await self.client.delete(f'/api/v1/tables/{ID}', headers={'Authorization': ''})
        self.assertEqual(response.status_code, 401)
        response = await self.client.request('DELETE', f'/api/v1/tables/{ID}', json={'scanner': {}})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(self.seen), count)

    async def test_configuration_blocked(self):
        for method, path in [('POST', 'v1/tables'), ('PATCH', f'v1/tables/{ID}'), ('GET', f'v1/ui/tables/{ID}/camera-config'), ('GET', 'v1/nodes')]:
            self.assertEqual((await self.client.request(method, '/api/' + path)).status_code, 403)
        self.assertFalse(self.seen)

    async def test_routes(self):
        for path in ['/warehouse', '/warehouse/', f'/warehouse/{ID}/desks', f'/warehouse/{ID}/desks/']:
            response = await self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn('<div id="root">', response.text)
