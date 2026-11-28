"""Explicitly invoked offline restore runner; never connects to a production DB.

Uses an administrator-provisioned LOCAL PostgreSQL database with disabled user
triggers. No mail/WhatsApp/website release code, cron creation or secret exports.
The report is evidence, not an automatic production approval.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.parse
import urllib.request


def safe_target(dsn):
    u = urllib.parse.urlparse(dsn)
    return (u.scheme in ('postgres', 'postgresql') and
            u.hostname in ('localhost', '127.0.0.1', '::1') and
            u.path.startswith('/alixwork_restore_') and not u.query)


def contained(root, path):
    p = (root / path).resolve()
    if not p.is_relative_to(root.resolve()):
        raise ValueError('Dateipfad außerhalb der Sicherung')
    return p


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def sql(statement):
    # Credential stays in the subprocess environment, never its arguments/output.
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env['PGDATABASE'] = os.environ['RESTORE_DATABASE_URL']
    r = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                       input=statement, text=True, capture_output=True, env=env)
    if r.returncode:
        raise RuntimeError('Isolierte Datenbankprüfung fehlgeschlagen; keine Zugangsdaten im Bericht')
    return r.stdout.strip()


def canonical(rows):
    return sorted(json.dumps(r, sort_keys=True, ensure_ascii=False, separators=(',', ':')) for r in rows)


def run(root, manifest_path, api_url):
    started = time.monotonic()
    dsn = os.environ.get('RESTORE_DATABASE_URL', '')
    if not safe_target(dsn):
        raise ValueError('Nur lokale Datenbank alixwork_restore_* erlaubt; Produktiv-/Remote-Ziele werden abgelehnt')
    if os.environ.get('RESTORE_ISOLATION_CONFIRMED') != 'ALIXWORK RESTORE TEST':
        raise ValueError('Explizite Bestätigung der isolierten Testumgebung fehlt')
    m = json.loads(manifest_path.read_text())
    report = {'backup_id': m.get('meta', {}).get('backup_id'), 'isolated': True,
              'passed': False, 'complete': False, 'checks': [], 'differences': []}
    check = lambda name, ok, detail: report['checks'].append({'name': name, 'passed': bool(ok), 'detail': detail})
    # Zero runnable user triggers and no background/network adapters.
    unsafe = sql("SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'D';")
    if unsafe != '0':
        raise ValueError('Benutzertrigger sind nicht vollständig deaktiviert; Restore wird nicht begonnen')
    if sql("SELECT count(*) FROM pg_foreign_server;") != '0':
        raise ValueError('Externe Datenbankverbindungen vorhanden')
    if sql("SELECT count(*) FROM pg_extension WHERE extname IN ('pg_cron','pg_net','http');") != '0':
        raise ValueError('Automatisierungs-/Netzwerkerweiterungen im Testziel vorhanden')
    counts = m.get('counts', {})
    tables = sorted(counts)
    if not tables or 'ph_products' not in counts:
        raise ValueError('Sicherungsmanifest unvollständig')
    rows = {t: [] for t in tables}
    for t in tables:
        if not re.fullmatch(r'[a-z][a-z0-9_]*', t):
            raise ValueError('Ungültiger Tabellenname im Manifest')
        if sql(f'SELECT count(*) FROM public."{t}";') != '0':
            raise ValueError('Testziel ist nicht leer; vorhandene Daten werden niemals überschrieben')
    for part in m.get('files', []):
        t = part.get('table')
        if t not in rows:
            raise ValueError('Teil ohne Manifest-Tabelle')
        path = contained(root, part['path'])
        if not path.is_file() or not part.get('sha256') or digest(path) != part['sha256']:
            raise ValueError('Sicherungsteil fehlt oder SHA-256 stimmt nicht')
        rows[t].extend(json.loads(line) for line in path.read_text().splitlines() if line)
    for t in tables:
        if len(rows[t]) != counts[t]:
            raise ValueError('Zeilenzahl stimmt nicht mit dem Sicherungsmanifest überein')
    # Actual inserts into the isolated DB, one transaction. No overwrite/delete.
    commands = ['BEGIN;', "SET LOCAL session_replication_role='replica';"]
    for t in tables:
        for offset in range(0, len(rows[t]), 100):
            payload = json.dumps(rows[t][offset:offset + 100], ensure_ascii=False).replace("'", "''")
            commands.append(f'INSERT INTO public."{t}" SELECT * FROM json_populate_recordset(NULL::public."{t}",\'{payload}\'::json);')
    commands.append('COMMIT;')
    sql('\n'.join(commands))
    for t in tables:
        recovered = json.loads(sql(f'SELECT coalesce(json_agg(t),\'[]\'::json) FROM public."{t}" t;'))
        ok = canonical(recovered) == canonical(rows[t])
        check(t, ok, f'{len(recovered)} / {counts[t]} Datensätze gegen Manifest und geprüfte Sicherungsteile')
        if not ok:
            report['differences'].append(t)
    # Validate each FK explicitly after replica-mode import, including composite FKs.
    fk_query = """SELECT coalesce(json_agg(x),'[]'::json) FROM (
      SELECT c.conname, n.nspname AS child_schema, r.relname AS child,
        pn.nspname AS parent_schema, pr.relname AS parent,
        array_agg(a.attname ORDER BY k.ord) AS child_cols,
        array_agg(pa.attname ORDER BY k.ord) AS parent_cols
      FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=r.relnamespace
      JOIN pg_class pr ON pr.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=pr.relnamespace
      CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(ck,pk,ord)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.ck
      JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=k.pk
      WHERE c.contype='f' AND n.nspname='public'
      GROUP BY c.conname,n.nspname,r.relname,pn.nspname,pr.relname) x;"""
    for fk in json.loads(sql(fk_query)):
        if fk['child'] not in tables:
            continue
        quote = lambda v: '"' + v.replace('"', '""') + '"'
        joins = ' AND '.join(f'p.{quote(b)}=c.{quote(a)}' for a, b in zip(fk['child_cols'], fk['parent_cols']))
        nonnull = ' AND '.join(f'c.{quote(a)} IS NOT NULL' for a in fk['child_cols'])
        q = f"SELECT count(*) FROM {quote(fk['child_schema'])}.{quote(fk['child'])} c WHERE {nonnull} AND NOT EXISTS(SELECT 1 FROM {quote(fk['parent_schema'])}.{quote(fk['parent'])} p WHERE {joins});"
        check(fk['conname'], sql(q) == '0', 'Fremdschlüssel gegen tatsächlich wiederhergestellte Daten')
    # Indexes are not binary backups of the actual objects: require the files themselves.
    indexes = m.get('storage_index_files', [])
    assets = []
    for entry in indexes:
        ip = contained(root, entry if isinstance(entry, str) else entry['path'])
        index = json.loads(ip.read_text())
        assets.extend(index if isinstance(index, list) else index.get('files', []))
    relevant = [a for a in assets if a.get('bucket') in ('product-hub-docs', 'ph-catalog-media')]
    check('Dateimanifest vorhanden', bool(relevant), 'Product-Hub-Dateien müssen tatsächlich in der isolierten Sicherung liegen')
    for a in relevant:
        p = contained(root, f"storage/{a['bucket']}/{a.get('path', a.get('name', ''))}")
        ok = p.is_file() and p.stat().st_size == a.get('size_bytes', a.get('size'))
        if a.get('sha256') and ok:
            ok = digest(p) == a['sha256']
        check('Datei: ' + a.get('path', a.get('name', '')), ok and bool(a.get('sha256')), 'Verfügbarkeit, Größe und SHA-256 der tatsächlichen Datei')
    # The old manifest lacks a schema snapshot. Never silently treat today's schema as the backup schema.
    schema = contained(root, 'schema.sql')
    check('Struktur zum Sicherungszeitpunkt', schema.is_file() and m.get('schema_sha256') and digest(schema) == m['schema_sha256'], 'Schema-Snapshot muss im Manifest authentifiziert sein; v5 enthält diesen noch nicht')
    parsed = urllib.parse.urlparse(api_url or '')
    api_ok = False
    if parsed.hostname in ('localhost', '127.0.0.1', '::1') and parsed.scheme == 'http' and not parsed.username:
        try:
            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, headers, newurl):
                    return None
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
            with opener.open(api_url, timeout=10) as response:
                payload = json.loads(response.read(5 * 1024 * 1024))
                api_ok = response.status == 200 and payload.get('contract') == '1.3' and len(payload.get('products', [])) + len(payload.get('offline_products', [])) == counts['ph_products']
        except Exception:
            api_ok = False
    check('Lesende isolierte API', api_ok, 'Nur lokale Test-API; keine produktive URL zulässig')
    report['duration_ms'] = round((time.monotonic() - started) * 1000)
    report['manifest_verified'] = all(c['passed'] for c in report['checks'] if c['name'] in tables)
    report['read_api_verified'] = api_ok
    report['complete'] = report['passed'] = all(c['passed'] for c in report['checks'])
    report['result'] = 'Bestanden' if report['passed'] else 'Nicht vollständig geprüft'
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--root', required=True)
    p.add_argument('--manifest', required=True)
    p.add_argument('--read-api-url')
    p.add_argument('--report', required=True)
    a = p.parse_args()
    try:
        result = run(Path(a.root), Path(a.manifest), a.read_api_url)
    except (ValueError, RuntimeError, OSError) as e:
        result = {'passed': False, 'complete': False, 'result': 'Nicht vollständig geprüft', 'error': str(e)}
    Path(a.report).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(result['result'])
    raise SystemExit(0 if result['passed'] else 1)