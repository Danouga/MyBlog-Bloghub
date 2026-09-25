import base64
import io
import json
import unittest
from unittest.mock import patch
import urllib.error
import publish_notes
import build_notes


class PublishTests(unittest.TestCase):
    def test_invalid_names(self):
        for name in ['../secret.md', 'a/b.md', 'a\\b.py', 'test.exe']:
            with self.assertRaises(ValueError):
                publish_notes.publish({'name': name, 'content': ''})

    @patch('publish_notes.urllib.request.urlopen')
    @patch('publish_notes.subprocess.run')
    def test_publish_uses_sha_and_encoded_content(self, git, request):
        git.return_value.returncode = 0
        git.return_value.stdout = 'password=test-only\n'
        request.return_value = io.BytesIO(json.dumps({'content': {'sha': 'new', 'html_url': 'url'}}).encode())
        result = publish_notes.publish({'name': 'note.md', 'content': '你好', 'sha': 'old'})
        payload = json.loads(request.call_args.args[0].data)
        self.assertEqual(payload['sha'], 'old')
        self.assertEqual(base64.b64decode(payload['content']).decode(), '你好')
        self.assertEqual(result['sha'], 'new')

    @patch('publish_notes.urllib.request.urlopen')
    @patch('publish_notes.subprocess.run')
    def test_conflict_preserves_remote(self, git, request):
        git.return_value.returncode = 0
        git.return_value.stdout = 'password=test-only\n'
        request.side_effect = urllib.error.HTTPError('url', 409, 'Conflict', {}, None)
        with self.assertRaisesRegex(ValueError, '冲突'):
            publish_notes.publish({'name': 'note.md', 'content': ''})
        self.assertEqual(request.call_count, 1)

    def test_public_catalogue(self):
        notes = build_notes.collect()
        self.assertTrue(any(n['name'] == 'welcome.md' for n in notes))
        self.assertTrue(all(len(n['sha']) == 40 for n in notes))
