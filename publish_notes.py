import base64
import json
import os
import re
import subprocess
import urllib.request
import urllib.error
import urllib.parse


def publish(data):
    name, content, sha = data.get('name'), data.get('content'), data.get('sha')
    if (not isinstance(name, str) or len(name) > 350
            or any(not p or p in ('.', '..') or p != p.strip() or re.search(r'[\\:*?"<>|\x00-\x1f]', p) for p in name.split('/'))
            or not re.search(r'\.(md|py|txt|js|json|html|css|ts|sh|yaml|yml)$', name, re.I)):
        raise ValueError('请输入有效的文件路径，例如 学习/Python/note.md，不允许 .. 或非法符号')
    if not isinstance(content, str) or (sha is not None and not isinstance(sha, str)):
        raise ValueError('无效的内容或版本')
    result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', text=True, capture_output=True, timeout=15, env=dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never'))
    credentials = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if result.returncode or not credentials.get('password'):
        raise ValueError('请先在本机配置 GitHub Git 凭据')
    payload = {'message': 'Publish note: ' + name, 'branch': 'main', 'content': base64.b64encode(content.encode()).decode()}
    if sha:
        payload['sha'] = sha
    request = urllib.request.Request('https://api.github.com/repos/Danouga/MyBlog-Bloghub/contents/notes/' + urllib.parse.quote(name, safe='/'), data=json.dumps(payload).encode(), method='PUT', headers={'Authorization': 'Bearer ' + credentials['password'], 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'Bloghub'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
        return {'sha': data['content']['sha'], 'url': data['content']['html_url']}
    except urllib.error.HTTPError as error:
        if error.code in (409, 422):
            raise ValueError('同名文件或版本冲突，请下载草稿备份后重新加载远程版本') from None
        raise ValueError('GitHub 写入失败，HTTP ' + str(error.code)) from None
