"""Optional read-only preview, with no credentials or execution APIs."""
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT = Path(__file__).resolve().parent
STATIC = {'/': ('index.html', 'text/html')}
for name in ['index.html', 'style.css', 'app.js', 'library.js', 'library.css', 'browser-python.js', 'python-worker.js', 'python.css']:
    STATIC['/' + name] = (name, 'text/html' if name.endswith('.html') else 'text/css' if name.endswith('.css') else 'text/javascript')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Host') not in {'127.0.0.1:8765', 'localhost:8765'}:
            return self.send_error(403)
        path = self.path.split('?')[0]
        if path == '/notes.json':
            from build_notes import collect
            body, mime = json.dumps(collect(), ensure_ascii=False).encode('utf-8'), 'application/json'
        elif path in STATIC:
            filename, mime = STATIC[path]
            body = (ROOT / filename).read_bytes()
        else:
            return self.send_error(404)
        self.send_response(200)
        self.send_header('Content-Type', mime + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self'; connect-src 'self' https://danouga.github.io https://cdn.jsdelivr.net; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        self.send_error(405, 'Read-only preview')
    def log_message(self, *args):
        pass

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('Read-only preview: http://127.0.0.1:8765', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
