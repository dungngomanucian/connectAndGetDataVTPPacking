
import unittest

import httpx
import server

WAREHOUSE = '11111111-1111-1111-1111-111111111111'


class ReportsGatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []

        def upstream(request):
            self.requests.append(request)
            path = request.url.path
            if path.endswith('/export'):
                return httpx.Response(200, content=b'xlsx-upstream-bytes', headers={
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': 'attachment; filename="report.xlsx"'})
            if path.endswith('/catalog'):
                return httpx.Response(200, json={'id': WAREHOUSE, 'code': 'WH', 'name': 'Kho',
                    'tables': [{'id': 'desk', 'name': 'Bàn', 'table_type': 'PACKING',
                                'node_id': 'private', 'cameras': [{'password': 'private'}]}],
                    'configuration': 'private'})
            if path.endswith('/choice'):
                return httpx.Response(200, json={'id': WAREHOUSE, 'name': 'Kho', 'enabled': True,
                                                'configuration': 'private'})
            if path.endswith('/page'):
                return httpx.Response(200, json={'items': [{'id': WAREHOUSE, 'name': 'Kho',
                    'enabled': True, 'configuration': 'private'}], 'total': 41, 'limit': 20, 'offset': 20})
            return httpx.Response(200, json={'orders': 123, 'videos': 234,
                'daily': [{'date': '2026-10-16', 'orders': 123, 'videos': 234}],
                'tables': [], 'internal': 'private'})

        self.remote = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
        server.app.state.client = self.remote
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),
                                       base_url='http://vtp-test', headers={'Authorization': 'Bearer test'})

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.remote.aclose()

    async def test_report_filters_and_upstream_totals(self):
        query = ('warehouse_id=' + WAREHOUSE + '&table_id=desk&table_type=PACKING'
                 '&started_from=2026-10-01T00:00:00Z&started_before=2026-10-17T00:00:00Z'
                 '&q=ORDER&timezone=Asia%2FHo_Chi_Minh')
        response = await self.client.get('/api/v1/ui/reports/summary?' + query)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['orders'], 123)
        self.assertNotIn('internal', response.json())
        self.assertEqual(self.requests[-1].url.query.decode(), query)
        self.assertEqual(self.requests[-1].headers['authorization'], 'Bearer test')

    async def test_excel_passes_through_without_local_generation(self):
        response = await self.client.get('/api/v1/ui/reports/export?timezone=Asia%2FHo_Chi_Minh')
        self.assertEqual(response.content, b'xlsx-upstream-bytes')
        self.assertIn('spreadsheetml', response.headers['content-type'])
        self.assertIn('report.xlsx', response.headers['content-disposition'])

    async def test_catalog_and_choices_exclude_internal_configuration(self):
        for path in [f'v1/warehouses/{WAREHOUSE}/catalog',
                     f'v1/ui/warehouses/{WAREHOUSE}/choice',
                     'v1/ui/warehouses/page?q=Kho&limit=20&offset=20']:
            response = await self.client.get('/api/' + path)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn('private', response.text)
        self.assertEqual(response.json()['total'], 41)

    async def test_reports_require_auth_and_only_allow_declared_requests(self):
        response = await self.client.get('/api/v1/ui/reports/summary', headers={'Authorization': ''})
        self.assertEqual(response.status_code, 401)
        response = await self.client.get('/api/v1/ui/reports/summary?internal=true')
        self.assertEqual(response.status_code, 400)
        response = await self.client.post('/api/v1/ui/reports/export')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.requests, [])

    async def test_direct_reports_routes(self):
        for path in ['/reports', '/reports/', '/reports?from=2026-10-01']:
            response = await self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn('<div id="root">', response.text)
