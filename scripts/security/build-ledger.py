#!/usr/bin/env python3
"""Baut das persistente Security-Ledger (V7) aus den gesicherten Registern.

Quellen (nur lesend):
  docs/security-v7/scan-latest.json        – letzte gespeicherte native Scanantwort (agent_security_v2)
  docs/security-finalization-v5/remaining-original.csv – historische Originalrestliste
  docs/security-finalization-v5/closed-native-ids.txt – gezielt geschlossene native IDs
  docs/security-finalization-v5/database-317-review.csv – Linter-Priorisierung
  docs/security-v7/linter-latest.txt       – aktueller Datenbank-Linter
  docs/security-v7/checks.json             – Prüfungen / externe Aufgaben
  docs/security-v7/progress.csv            – Fortschritt je Arbeitspaket (überschreibt Status)
  docs/security-v7/version.json            – Versionsbindung

Ausgabe: supabase/functions/security-remediate/ledger.json und docs/security-v7/ledger.csv
Kategorien werden nie addiert; Duplikate verweisen auf ihre native Identität.
"""
import csv, json, re, subprocess, hashlib
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
V7 = ROOT / 'docs/security-v7'
V5 = ROOT / 'docs/security-finalization-v5'
STATUSES = ['OPEN','IN_PROGRESS','FIXED','TESTED','DEPLOYED','VERIFIED','FALSE_POSITIVE','BLOCKED_EXTERNAL','BLOCKED_TECHNICAL']

def comp_of(text):
    m = re.search(r'Location:\s*(\S+)', text or '')
    return m.group(1) if m else ''

def short_component(path):
    m = re.match(r'supabase/functions/([^/]+)/', path or '')
    if m: return f'function:{m.group(1)}'
    m = re.match(r'supabase/migrations/', path or '')
    if m: return 'database:migrations'
    return path or 'unbekannt'

scan = json.loads((V7/'scan-latest.json').read_text())['agent_security_v2']
version = json.loads((V7/'version.json').read_text())
closed = set((V5/'closed-native-ids.txt').read_text().split())
items = []
native_ids = set()
for f in scan['findings']:
    nid = f['internal_id']; native_ids.add(nid)
    loc = f.get('metadata',{}).get('finding_family_key') or comp_of(f.get('details'))
    crit = f['level'] == 'error'
    items.append(dict(
        id=f'native:{nid}', kind='native', source=f"agent_security_v2 {scan.get('version')}", nativeId=nid,
        severity='critical' if crit else 'high', priority='P0' if crit else 'P1', title=f['name'],
        component=short_component(loc), location=loc, category=f.get('category',''),
        status='DEPLOYED' if nid in closed else 'OPEN',
        fix='Gezielt korrigiert und über Befundverwaltung gemeldet' if nid in closed else '',
        evidence='docs/security-finalization-v5/fortsetzungsstand.md' if nid in closed else '',
        checkedVersion=version['scanSourceCommit'], deployedVersion='', lastChecked=scan['timestamp'][:19]+'Z',
        blocker='', nextStep='Erneuter vollständiger Tiefenscan auf aktuellem Commit' if nid in closed else 'Analysieren, korrigieren, testen, bereitstellen', duplicateOf=''))

for r in csv.DictReader(open(V5/'remaining-original.csv')):
    nid = r['internal_id']; dup = nid in native_ids
    items.append(dict(
        id=f'original:{nid}', kind='original', source='Ursprüngliches 600er-Register', nativeId=nid,
        severity='critical' if r['level']=='error' else 'high', priority='P0' if r['level']=='error' else 'P1',
        title=r['name'], component=short_component(r['location']), location=r['location'], category='',
        status='OPEN', fix='', evidence='', checkedVersion='historisch', deployedVersion='', lastChecked='',
        blocker='', nextStep='Über native Identität bearbeiten' if dup else 'Im aktuellen Code einzeln nachprüfen; Abwesenheit im Scan ist kein Nachweis',
        duplicateOf=f'native:{nid}' if dup else ''))

review = {}
for r in csv.DictReader(open(V5/'database-317-review.csv')):
    review[r['observation'].strip()] = r
PRIO = {'kritisch':('critical','P0'),'hoch':('high','P1'),'mittel':('medium','P2'),'niedrig':('low','P3')}
lint = (V7/'linter-latest.txt').read_text()
section = None; lint_seen = set()
for line in lint.splitlines():
    h = re.match(r'(INFO|WARN|ERROR) \d+: (.+?) \(\d+ issues?\)', line)
    if h: section = h.group(2); continue
    if not line.strip().startswith('- ') or section is None: continue
    if 'Performance' in section or 'Index' in section or 'Permissive' in section or 'Foreign Key' in section: continue
    m = re.search(r'Function `public\.([^`]+)`', line) or re.search(r'Table \\?`public\.([^`\\]+)', line) or re.search(r'Extension \\?`([^`\\]+)', line)
    if not m: continue
    obj = m.group(1)
    key = f'public.{obj}' if not section.startswith('Extension') else obj
    code = {'RLS':'rls_no_policy','Ext':'extension_public','Pub':'anon_definer','Sig':'authenticated_definer'}[section[:3]]
    lint_seen.add((code, key))
    rv = review.get(key, {})
    sev, pr = PRIO.get(rv.get('priority',''), ('medium','P2'))
    status, blocker, nxt, ev = 'OPEN', '', 'Aufrufer prüfen, Invoker/Revoke mit Regressionstest', ''
    if section.startswith('RLS Enabled No Policy'):
        status, sev, pr, ev = 'FALSE_POSITIVE', 'info', 'P4', 'Absichtlich service-only Tabelle ohne Client-Policy (verifiziert im 317-Register)'
        nxt = 'Keine Aktion; bei Schemaänderung erneut prüfen'
    elif section.startswith('Extension'):
        status, sev, pr = 'BLOCKED_TECHNICAL', 'medium', 'P3'
        blocker = 'Schema-Umzug von Extension benötigt vorher erfolgreichen isolierten Restore-Test'; nxt = 'Nach Restore-Test im Testprojekt verschieben und vergleichen'
    elif section.startswith('Public Can Execute'):
        sev, pr = ('high','P1') if pr in ('P0','P1') else (sev, pr)
        nxt = 'Anonyme Policy-/Portalaufrufer prüfen, dann EXECUTE für anon entziehen'
    pkg_key = obj.split('(')[0].split('_')[0]
    items.append(dict(
        id=f'lint:{code}:{key}', kind='db_linter', source='Supabase Datenbank-Linter', nativeId='', severity=sev, priority=pr,
        title=section, component=f'database:{pkg_key}', location=key, category=section,
        status=status, fix='', evidence=ev, checkedVersion=version['migrationHead'], deployedVersion='', lastChecked=version['linterAt'],
        blocker=blocker, nextStep=nxt, duplicateOf=''))
for key, rv in review.items():
    if (rv.get('category',''), key) in lint_seen or not rv.get('status','').startswith('Behoben'): continue
    sev, pr = PRIO.get(rv.get('priority',''), ('medium','P2'))
    items.append(dict(id=f"lint:{rv.get('category','')}:{key}", kind='db_linter', source='Supabase Datenbank-Linter', nativeId='', severity=sev, priority=pr,
        title=rv.get('category',''), component=f"database:{key.replace('public.','').split('_')[0]}", location=key, category=rv.get('category',''),
        status='DEPLOYED', fix='Invoker/Revoke-Korrektur', evidence='Nicht mehr im aktuellen Linter; '+rv.get('evidence',''),
        checkedVersion=version['migrationHead'], deployedVersion=version['migrationHead'], lastChecked=version['linterAt'],
        blocker='', nextStep='Authentifizierte Rollenabnahme ausstehend', duplicateOf=''))

for c in json.loads((V7/'checks.json').read_text()):
    items.append({**dict(nativeId='', location='', category='', fix='', evidence='', checkedVersion='', deployedVersion='', lastChecked='', blocker='', nextStep='', duplicateOf=''), **c})

progress = list(csv.DictReader(open(V7/'progress.csv'))) if (V7/'progress.csv').exists() else []
by_id = {i['id']: i for i in items}
for p in progress:
    it = by_id.get(p['id'])
    if not it: raise SystemExit(f'Unbekannte Fortschritts-ID {p["id"]}')
    if p['status'] not in STATUSES: raise SystemExit(f'Ungültiger Status {p["status"]}')
    for k in ('status','fix','evidence','deployedVersion','lastChecked','nextStep','blocker'):
        if p.get(k): it[k] = p[k]
    it['package'] = p.get('package') or it.get('package','')

import collections; _d=[k for k,v in collections.Counter(i["id"] for i in items).items() if v>1]; assert not _d, _d
for it in items: assert it['status'] in STATUSES, it

ledger = dict(version='7.0', generatedAt=version['ledgerAt'], versions=version, statuses=STATUSES,
              scan=dict(status=scan['completion_status'], timestamp=scan['timestamp'], scanner=scan.get('version'), sourceCommit=version['scanSourceCommit']),
              items=[{k: v for k, v in it.items() if v not in ('', None)} for it in items])
(ROOT/'supabase/functions/security-remediate/ledger.json').write_text(json.dumps(ledger, ensure_ascii=False, separators=(',',':')))
with open(V7/'ledger.csv','w',newline='') as fh:
    cols = ['id','kind','priority','severity','status','component','title','location','duplicateOf','checkedVersion','deployedVersion','lastChecked','fix','evidence','blocker','nextStep','package']
    w = csv.DictWriter(fh, fieldnames=cols, extrasaction='ignore'); w.writeheader()
    for it in items:
        w.writerow({k: (('\'' + str(it.get(k,''))) if str(it.get(k,'')).startswith(('=','+','-','@')) else it.get(k,'')) for k in cols})
cnt = defaultdict(int)
for it in items: cnt[(it['kind'], it['status'])] += 1
print(json.dumps({f'{k}/{s}': v for (k,s), v in sorted(cnt.items())}, indent=1))
