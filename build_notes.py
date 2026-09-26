import hashlib
import json
from pathlib import Path


def collect():
    result = []
    root = Path(__file__).resolve().parent / 'notes'
    readable_suffixes = {'.md', '.txt', '.ipynb', '.py', '.js', '.json', '.html', '.css', '.ts', '.sh', '.yaml', '.yml'}
    for path in sorted(root.rglob('*')):
        if path.is_file() and path.suffix.lower() in readable_suffixes and 'datasets' not in path.relative_to(root).parts:
            raw = path.read_bytes()
            try:
                content = raw.decode('utf-8')
            except UnicodeDecodeError:
                continue
            result.append({'name': path.relative_to(root).as_posix(), 'content': content, 'sha': hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()})
    return result


if __name__ == '__main__':
    Path('_site/notes.json').write_text(json.dumps(collect(), ensure_ascii=False), encoding='utf-8')
