"""Rebuild a local Git index from authenticated GitHub API metadata, without a remote write.

Usage: python3 scripts/restore-github-index.py metadata.json
metadata.json contains {head, commit, tree}; commit/tree are Git database API responses.
Missing tracked evidence stays in the index and is reported as unavailable.
"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zlib

repository = Path(__file__).resolve().parent.parent
metadata = json.loads(Path(sys.argv[1]).read_text())
head = metadata['head']
commit = metadata['commit']
tree = metadata['tree']
if commit['sha'] != head or tree['sha'] != commit['tree']['sha'] or tree.get('truncated'):
    raise SystemExit('The source API identity is incomplete or inconsistent')
if (repository / '.git').exists():
    raise SystemExit('Refusing to replace an existing Git checkout')
subprocess.run(['git', 'init', '--initial-branch=codex/production-iron-amber'], cwd=repository, check=True)
git_directory = repository / '.git'

def store_object(kind, data, expected=None):
    encoded = kind.encode() + b' ' + str(len(data)).encode() + b'\0' + data
    sha = hashlib.sha1(encoded).hexdigest()
    if expected is not None and sha != expected:
        raise SystemExit(f'Git object verification failed for {kind}: expected {expected}, got {sha}')
    destination = git_directory / 'objects' / sha[:2] / sha[2:]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(zlib.compress(encoded))
    return sha

entries = tree['tree']
children = {}
for entry in entries:
    parent, _, name = entry['path'].rpartition('/')
    children.setdefault(parent, []).append((name, entry))
tree_ids = {'': tree['sha'], **{entry['path']: entry['sha'] for entry in entries if entry['type'] == 'tree'}}
for directory, expected in tree_ids.items():
    ordered = sorted(children.get(directory, []), key=lambda child: (child[0] + ('/' if child[1]['type'] == 'tree' else '')).encode())
    data = b''.join(str(int(entry['mode'])).encode() + b' ' + name.encode() + b'\0' + bytes.fromhex(entry['sha']) for name, entry in ordered)
    store_object('tree', data, expected)

def identity(role, timezone):
    author = commit[role]
    epoch = int(datetime.datetime.fromisoformat(author['date'].replace('Z', '+00:00')).timestamp())
    sign = '+' if timezone >= 0 else '-'
    offset = abs(timezone)
    return f"{role} {author['name']} <{author['email']}> {epoch} {sign}{offset // 60:02d}{offset % 60:02d}"

headers = [f"tree {commit['tree']['sha']}"] + [f"parent {parent['sha']}" for parent in commit['parents']]
message = commit['message']
offsets = list(dict.fromkeys([0, -420, -480, 60, 120] + list(range(-840, 841))))
raw_commit = None
for timezone in offsets:
    for ending in ['', '\n', '\n\n']:
        candidate = ('\n'.join(headers + [identity('author', timezone), identity('committer', timezone)]) + '\n\n' + message + ending).encode()
        encoded = b'commit ' + str(len(candidate)).encode() + b'\0' + candidate
        if hashlib.sha1(encoded).hexdigest() == head:
            raw_commit = candidate
            break
    if raw_commit is not None:
        break
if raw_commit is None:
    raise SystemExit('Could not reconstruct the exact published commit; no fabricated commit was written')
store_object('commit', raw_commit, head)

present = []
missing = []
modified = []
for entry in entries:
    if entry['type'] != 'blob':
        continue
    file = repository / entry['path']
    if not file.exists():
        missing.append(entry['path'])
        continue
    data = file.read_bytes()
    actual = store_object('blob', data)
    present.append(entry['path'])
    if actual != entry['sha']:
        modified.append(entry['path'])
(git_directory / 'shallow').write_text(head + '\n')
subprocess.run(['git', 'update-ref', 'HEAD', head], cwd=repository, check=True)
subprocess.run(['git', 'read-tree', tree['sha']], cwd=repository, check=True)
report = {'head': head, 'tree': tree['sha'], 'present': len(present), 'missing': missing, 'modified': modified}
print(json.dumps(report, indent=2))
