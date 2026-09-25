import http.client
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
import runner


class RunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), runner.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, path, body, origin='http://127.0.0.1:8765', token=None):
        client = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Host': '127.0.0.1:8765', 'Origin': origin, 'Authorization': 'Bearer ' + (runner.TOKEN if token is None else token), 'Content-Type': 'application/json'}
        client.request('POST', path, json.dumps(body), headers)
        response = client.getresponse()
        result = response.status, json.loads(response.read())
        client.close()
        return result

    def test_untrusted_origin_rejected(self):
        self.assertEqual(self.request('/run', {}, origin='https://evil.example')[0], 403)

    def test_invalid_token_rejected(self):
        self.assertEqual(self.request('/environments', {}, token='invalid')[0], 401)

    def test_environment_listing(self):
        status, data = self.request('/environments', {})
        self.assertEqual(status, 200)
        self.assertIn(sys.executable, data['environments'])

    def test_python_output(self):
        status, data = self.request('/run', {'python': sys.executable, 'code': 'print("你好 Bloghub")'})
        self.assertEqual(status, 200)
        self.assertIn('你好 Bloghub', data['output'])
        self.assertEqual(data['returncode'], 0)

    def test_python_errors(self):
        status, data = self.request('/run', {'python': sys.executable, 'code': 'raise ValueError("test-error")'})
        self.assertEqual(status, 200)
        self.assertNotEqual(data['returncode'], 0)
        self.assertIn('test-error', data['output'])

    def test_unregistered_environment(self):
        self.assertEqual(self.request('/run', {'python': 'unknown', 'code': ''})[0], 400)

    def test_bad_request(self):
        self.assertEqual(self.request('/run', [1, 2])[0], 400)


if __name__ == '__main__':
    unittest.main()
