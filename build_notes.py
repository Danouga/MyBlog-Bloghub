import hashlib
import json
from pathlib import Path


def collect():
    result = []
    for path in sorted((Path(__file__).resolve().parent / 'notes').glob('*')):
        if path.is_file():
            raw = path.read_bytes()
            result.append({'name': path.name, 'content': raw.decode('utf-8'), 'sha': hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()})
    return result


if __name__ == '__main__':
    Path('_site/notes.json').write_text(json.dumps(collect(), ensure_ascii=False), encoding='utf-8')
