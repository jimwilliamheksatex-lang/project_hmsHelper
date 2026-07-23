#!/usr/bin/env python3
"""PPC Warping MES Workstation — dummy live-trial server.

Serves the static site (html/css/js) AND a small JSON API backed by
SQLite, so that ppc_planner.html, supervisor_view v1/v2.html and
operator_input v2.html can share one live dataset instead of each page
loading its own frozen copy of dummy_data.json.

Usage:
    python server.py               # start on http://localhost:8000
    python server.py --port 8080   # custom port
    python server.py --reseed      # wipe hms.db and reload from dummy_data.json

Stdlib only (http.server + sqlite3) — nothing to pip install.
"""
import argparse
import json
import os
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, 'hms.db')
SEED_PATH = os.path.join(ROOT, 'dummy_data.json')

# Top-level dummy_data.json arrays that are exploded into one SQLite row
# per item, keyed by the given id field. Everything else (shifts,
# beam_database, app_config, comment strings, ...) is stored whole as a
# single JSON blob per top-level key in `singletons`.
ARRAY_COLLECTIONS = {
    'machines': 'id',
    'manufacturing_orders': 'mo_id',
    'yarn_types': 'id',
    'users': 'id',
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('CREATE TABLE IF NOT EXISTS blobs (collection TEXT, id TEXT, data TEXT, PRIMARY KEY (collection, id))')
    conn.execute('CREATE TABLE IF NOT EXISTS singletons (key TEXT PRIMARY KEY, data TEXT)')
    return conn


def seed_if_empty(conn, force=False):
    count = conn.execute('SELECT COUNT(*) FROM singletons').fetchone()[0]
    if count > 0 and not force:
        return False
    if force:
        conn.execute('DELETE FROM blobs')
        conn.execute('DELETE FROM singletons')
    with open(SEED_PATH, 'r', encoding='utf-8') as f:
        raw = json.load(f)
    for collection, key_field in ARRAY_COLLECTIONS.items():
        for item in raw.get(collection, []):
            conn.execute(
                'INSERT INTO blobs (collection, id, data) VALUES (?, ?, ?)',
                (collection, item[key_field], json.dumps(item)),
            )
    hph = raw.get('hph_records', {}) or {}
    hph_comment = hph.get('_comment')
    for hph_id, rec in hph.items():
        if hph_id == '_comment':
            continue
        conn.execute(
            'INSERT INTO blobs (collection, id, data) VALUES (?, ?, ?)',
            ('hph_records', hph_id, json.dumps(rec)),
        )
    if hph_comment is not None:
        conn.execute('INSERT INTO singletons (key, data) VALUES (?, ?)',
                     ('hph_records__comment', json.dumps(hph_comment)))

    skip = set(ARRAY_COLLECTIONS) | {'hph_records'}
    for key, value in raw.items():
        if key in skip:
            continue
        conn.execute('INSERT INTO singletons (key, data) VALUES (?, ?)', (key, json.dumps(value)))
    conn.commit()
    print(f'[server] seeded {DB_PATH} from {os.path.basename(SEED_PATH)}')
    return True


def get_snapshot(conn):
    out = {}
    for key, data in conn.execute('SELECT key, data FROM singletons'):
        if key == 'hph_records__comment':
            continue
        out[key] = json.loads(data)
    for collection in ARRAY_COLLECTIONS:
        rows = conn.execute('SELECT data FROM blobs WHERE collection = ? ORDER BY id', (collection,))
        out[collection] = [json.loads(row[0]) for row in rows]
    hph = {}
    for item_id, data in conn.execute('SELECT id, data FROM blobs WHERE collection = ?', ('hph_records',)):
        hph[item_id] = json.loads(data)
    comment_row = conn.execute('SELECT data FROM singletons WHERE key = ?', ('hph_records__comment',)).fetchone()
    if comment_row:
        hph['_comment'] = json.loads(comment_row[0])
    out['hph_records'] = hph
    return out


def patch_blob(conn, collection, item_id, patch):
    row = conn.execute('SELECT data FROM blobs WHERE collection = ? AND id = ?', (collection, item_id)).fetchone()
    if row is None:
        return None
    data = json.loads(row[0])
    data.update(patch)
    conn.execute('UPDATE blobs SET data = ? WHERE collection = ? AND id = ?',
                 (json.dumps(data), collection, item_id))
    conn.commit()
    return data


def patch_active_yarn(conn, machine_id, patch):
    row = conn.execute('SELECT data FROM blobs WHERE collection = ? AND id = ?', ('machines', machine_id)).fetchone()
    if row is None:
        return None
    data = json.loads(row[0])
    existing = data.get('active_yarn') or {}
    data['active_yarn'] = {**existing, **patch}
    conn.execute('UPDATE blobs SET data = ? WHERE collection = ? AND id = ?',
                 (json.dumps(data), 'machines', machine_id))
    conn.commit()
    return data


MO_RE = re.compile(r'^/api/mo/([^/]+)$')
MACHINE_IOT_RE = re.compile(r'^/api/machine/([^/]+)/iot$')
MACHINE_YARN_RE = re.compile(r'^/api/machine/([^/]+)/active_yarn$')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        print('[server]', fmt % args)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', 0) or 0)
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode('utf-8'))

    def do_GET(self):
        if self.path == '/api/data':
            conn = get_conn()
            try:
                self._send_json(200, get_snapshot(conn))
            finally:
                conn.close()
            return
        super().do_GET()

    def do_POST(self):
        if not self.path.startswith('/api/'):
            self._send_json(404, {'error': 'not found'})
            return
        try:
            patch = self._read_json_body()
        except (ValueError, UnicodeDecodeError):
            self._send_json(400, {'error': 'invalid JSON body'})
            return

        conn = get_conn()
        try:
            m = MO_RE.match(self.path)
            if m:
                result = patch_blob(conn, 'manufacturing_orders', m.group(1), patch)
                if result is None:
                    self._send_json(404, {'error': 'mo not found'})
                else:
                    self._send_json(200, {'ok': True, 'mo': result})
                return

            m = MACHINE_IOT_RE.match(self.path)
            if m:
                status = patch.get('status')
                if not status:
                    self._send_json(400, {'error': 'missing "status"'})
                    return
                result = patch_blob(conn, 'machines', m.group(1), {'iot_status': status})
                if result is None:
                    self._send_json(404, {'error': 'machine not found'})
                else:
                    self._send_json(200, {'ok': True, 'machine': result})
                return

            m = MACHINE_YARN_RE.match(self.path)
            if m:
                result = patch_active_yarn(conn, m.group(1), patch)
                if result is None:
                    self._send_json(404, {'error': 'machine not found'})
                else:
                    self._send_json(200, {'ok': True, 'machine': result})
                return

            self._send_json(404, {'error': 'unknown endpoint'})
        finally:
            conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--reseed', action='store_true', help='wipe hms.db and reload from dummy_data.json')
    args = parser.parse_args()

    conn = get_conn()
    seed_if_empty(conn, force=args.reseed)
    conn.close()

    httpd = HTTPServer(('0.0.0.0', args.port), Handler)
    print(f'[server] PPC Warping MES Workstation running at http://localhost:{args.port}')
    print(f'[server] DB: {DB_PATH}')
    print('[server] Ctrl+C to stop')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
