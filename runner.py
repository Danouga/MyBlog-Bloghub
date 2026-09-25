"""Bloghub loopback-only Python bridge; Python 3.10+, no dependencies."""
import argparse
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
TOKEN = secrets.token_urlsafe(32)
ENVIRONMENTS = list(dict.fromkeys(filter(None, [sys.executable, shutil.which('python')])) )
LOCK = threading.Lock()
ORIGINS = {'http://127.0.0.1:8765', 'http://localhost:8765'}
STATIC = {'/': ('index.html', 'text/html'), '/index.html': ('index.html', 'text/html'), '/style.css': ('style.css', 'text/css'), '/app.js': ('app.js', 'text/javascript')}


def run_code(python, code):
    with tempfile.TemporaryDirectory(prefix='bloghub-') as folder:
        script = Path(folder) / 'main.py'
        script.write_text(code, encoding='utf-8')
        env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')
        with tempfile.TemporaryFile() as output:
            process = subprocess.Popen([python, '-u', str(script)], cwd=folder,
                stdout=output, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                env=env, start_new_session=os.name != 'nt')
            timed_out = False
            try:
                process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                timed_out = True
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
                else:
                    os.killpg(process.pid, signal.SIGKILL)
                process.kill()
                process.wait()
            output.seek(0)
            raw = output.read(200001)
            text = raw[:200000].decode('utf-8', errors='replace')
            if len(raw) > 200000:
                text += '\n[输出已截断至 200 KB]'
            return {'output': text, 'returncode': process.returncode, 'timeout': timed_out}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log the connection token or submitted code.

    def allowed(self):
        return (self.headers.get('Host') in {'127.0.0.1:8765', 'localhost:8765'}
                and self.headers.get('Origin') in ORIGINS)

    def cors(self):
        origin = self.headers.get('Origin')
        if origin in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network', 'true')

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.reply(200 if self.allowed() else 403, {})

    def do_GET(self):
        if self.headers.get('Host') not in {'127.0.0.1:8765', 'localhost:8765'}:
            return self.reply(403, {'error': 'Host 不允许'})
        asset = STATIC.get(self.path.split('?')[0])
        if not asset:
            return self.reply(404, {'error': 'Not found'})
        body = (ROOT / asset[0]).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', asset[1] + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; connect-src http://127.0.0.1:8765; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.allowed():
            return self.reply(403, {'error': '网页来源不允许，请通过 --origin 配置 GitHub Pages 来源'})
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return self.reply(401, {'error': '连接密钥不正确'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 2 * 1024 * 1024:
                return self.reply(413, {'error': '请求大小无效（最多 2 MB）'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('请求必须是对象')
            if self.path == '/environments':
                return self.reply(200, {'environments': ENVIRONMENTS})
            if self.path == '/environment':
                path = Path(data.get('path', ''))
                if not path.is_absolute() or not path.is_file() or not path.name.lower().startswith('python'):
                    raise ValueError('请输入存在的 Python 解释器绝对路径')
                result = subprocess.run([str(path), '-c', 'import sys; print(sys.executable)'], capture_output=True, timeout=5)
                if result.returncode != 0:
                    raise ValueError('无法启动此 Python 解释器')
                selected = str(path.resolve())
                if selected not in ENVIRONMENTS:
                    ENVIRONMENTS.append(selected)
                return self.reply(200, {'environments': ENVIRONMENTS, 'selected': selected})
            if self.path == '/run':
                python, code = data.get('python'), data.get('code')
                if python not in ENVIRONMENTS or not isinstance(code, str):
                    raise ValueError('请选择已添加的环境，并提供文本代码')
                if not LOCK.acquire(blocking=False):
                    return self.reply(409, {'error': '已有代码正在运行，请稍后再试'})
                try:
                    result = run_code(python, code)
                finally:
                    LOCK.release()
                return self.reply(200, result)
            return self.reply(404, {'error': 'Not found'})
        except (ValueError, OSError, subprocess.SubprocessError) as error:
            return self.reply(400, {'error': str(error)})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', action='append', default=[], help='Exact allowed web origin, e.g. https://username.github.io (no path)')
    args = parser.parse_args()
    ORIGINS.update(args.origin)
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('Bloghub: http://127.0.0.1:8765', flush=True)
    print('连接密钥: ' + TOKEN, flush=True)
    print('仅执行可信代码；不是沙箱。Ctrl+C 停止服务。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
