import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def updated_at(path, project_root):
    relative_path = path.relative_to(project_root).as_posix()
    log = subprocess.run(
        ['git', 'log', '-1', '--format=%cI', '--', relative_path],
        cwd=project_root, capture_output=True, text=True, check=False
    )
    return log.stdout.strip() or datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()


def collect():
    result = []
    project_root = Path(__file__).resolve().parent
    root = project_root / 'notes'
    readable_suffixes = {'.md', '.txt', '.ipynb', '.py', '.js', '.json', '.html', '.css', '.ts', '.sh', '.yaml', '.yml'}
    for path in sorted(root.rglob('*')):
        if path.is_file() and path.suffix.lower() in readable_suffixes and 'datasets' not in path.relative_to(root).parts:
            raw = path.read_bytes()
            try:
                content = raw.decode('utf-8')
            except UnicodeDecodeError:
                continue
            result.append({'name': path.relative_to(root).as_posix(), 'content': content, 'sha': hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest(), 'updatedAt': updated_at(path, project_root)})
    return result


if __name__ == '__main__':
    Path('_site/notes.json').write_text(json.dumps(collect(), ensure_ascii=False), encoding='utf-8')
