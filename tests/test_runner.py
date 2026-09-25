import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer
import runner

class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), runner.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
    def request(self, method, path):
        client = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        client.request(method, path, headers={'Host': '127.0.0.1:8765'})
        response = client.getresponse()
        status = response.status
        response.read()
        client.close()
        return status
    def test_removed_apis(self):
        for path in ['/publish', '/run', '/environment', '/environments']:
            self.assertEqual(self.request('POST', path), 405)
    def test_assets(self):
        for path in ['/', '/python-worker.js', '/library.js', '/notes.json']:
            self.assertEqual(self.request('GET', path), 200)
    def test_no_source_exposure(self):
        self.assertEqual(self.request('GET', '/runner.py'), 404)
