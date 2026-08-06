import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Download, Loader2, Database } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];

type EntityKey = 'devices' | 'assemblies' | 'parts' | 'suppliers' | 'bom';

interface EntityDef {
  key: EntityKey;
  label: string;
  table: string;
  /** Spalten der CSV-Vorlage */
  columns: string[];
  /** Spalte, über die ein bestehender Datensatz erkannt wird */
  matchColumn: string;
  /** Spalten die als Zahl geparst werden */
  numeric?: string[];
  /** Spalten die als Boolean geparst werden */
  boolean?: string[];
  hint?: string;
}

const ENTITIES: EntityDef[] = [
  {
    key: 'suppliers',
    label: 'Lieferanten',
    table: 'plm_suppliers',
    matchColumn: 'supplier_number',
    columns: ['supplier_number', 'name', 'is_manufacturer', 'contact_name', 'email', 'phone', 'website', 'street', 'zip', 'city', 'country', 'rating', 'release_status', 'notes'],
    numeric: ['rating'],
    boolean: ['is_manufacturer'],
    hint: 'Zuerst importieren – wird von Einzelteilen referenziert.',
  },
  {
    key: 'devices',
    label: 'Geräte',
    table: 'plm_devices',
    matchColumn: 'article_number',
    columns: ['article_number', 'name', 'product_family', 'hardware_version', 'software_version', 'version', 'revision', 'ce_status', 'mdr_status', 'mdr_class', 'udi_di', 'release_status', 'notes'],
    hint: 'Basis für Baugruppen, Teile und Stücklisten.',
  },
  {
    key: 'assemblies',
    label: 'Baugruppen',
    table: 'plm_assemblies',
    matchColumn: 'code',
    columns: ['code', 'name', 'device_article_number', 'parent_code', 'version', 'revision', 'release_status', 'sort_order', 'description'],
    numeric: ['sort_order'],
    hint: 'device_article_number und parent_code werden automatisch aufgelöst.',
  },
  {
    key: 'parts',
    label: 'Einzelteile',
    table: 'plm_parts',
    matchColumn: 'part_number',
    columns: ['part_number', 'name', 'category', 'device_article_number', 'assembly_code', 'manufacturer', 'manufacturer_part_number', 'supplier_number', 'supplier_part_number', 'price', 'currency', 'moq', 'lead_time_days', 'material', 'weight_g', 'stock_min', 'is_spare_part', 'release_status', 'criticality', 'description'],
    numeric: ['price', 'moq', 'lead_time_days', 'weight_g', 'stock_min'],
    boolean: ['is_spare_part'],
    hint: 'supplier_number wird als Hauptlieferant zugeordnet.',
  },
  {
    key: 'bom',
    label: 'Stückliste (BOM)',
    table: 'plm_bom_items',
    matchColumn: '',
    columns: ['position_no', 'device_article_number', 'assembly_code', 'child_assembly_code', 'part_number', 'quantity', 'unit', 'install_position', 'notes'],
    numeric: ['position_no', 'quantity'],
    hint: 'Zeilen werden immer neu angelegt – Geräte, Baugruppen und Teile müssen bereits existieren.',
  },
];

function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const delimiter = (clean.split('\n')[0].match(/;/g)?.length || 0) >= (clean.split('\n')[0].match(/,/g)?.length || 0) ? ';' : ',';

  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur);
  rows.push(row);

  const header = rows.shift()!.map(h => h.trim());
  return rows
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function toBool(v: string) {
  return ['1', 'ja', 'true', 'x', 'yes', 'wahr'].includes(v.toLowerCase());
}

export default function PlmStammdatenimport() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));
  const [busy, setBusy] = useState<EntityKey | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (line: string) => setLog(prev => [line, ...prev].slice(0, 100));

  function downloadTemplate(def: EntityDef) {
    const csv = def.columns.join(';') + '\n';
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `plm_${def.key}_vorlage.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadLookup(table: string, column: string) {
    const map = new Map<string, string>();
    const { data } = await supabase.from(table as any).select(`id, ${column}`).limit(5000);
    (data as any[] | null)?.forEach(r => { if (r[column]) map.set(String(r[column]).trim().toLowerCase(), r.id); });
    return map;
  }

  async function handleFile(def: EntityDef, file: File) {
    setBusy(def.key);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) { toast.error('Keine Datenzeilen gefunden.'); return; }

      const needsDevice = def.columns.includes('device_article_number');
      const needsAssembly = def.columns.some(c => c === 'assembly_code' || c === 'parent_code' || c === 'child_assembly_code');
      const needsSupplier = def.columns.includes('supplier_number');
      const needsPart = def.columns.includes('part_number') && def.key === 'bom';

      const [devices, assemblies, suppliers, parts] = await Promise.all([
        needsDevice ? loadLookup('plm_devices', 'article_number') : Promise.resolve(new Map()),
        needsAssembly ? loadLookup('plm_assemblies', 'code') : Promise.resolve(new Map()),
        needsSupplier ? loadLookup('plm_suppliers', 'supplier_number') : Promise.resolve(new Map()),
        needsPart ? loadLookup('plm_parts', 'part_number') : Promise.resolve(new Map()),
      ]);

      const existing = def.matchColumn ? await loadLookup(def.table, def.matchColumn) : new Map();

      let created = 0, updated = 0, skipped = 0;

      for (const raw of rows) {
        const payload: Record<string, any> = {};
        for (const col of def.columns) {
          const val = raw[col];
          if (val === undefined || val === '') continue;
          if (col === 'device_article_number') { payload.device_id = devices.get(val.toLowerCase()) ?? null; continue; }
          if (col === 'assembly_code') { payload.assembly_id = assemblies.get(val.toLowerCase()) ?? null; continue; }
          if (col === 'parent_code') { payload.parent_id = assemblies.get(val.toLowerCase()) ?? null; continue; }
          if (col === 'child_assembly_code') { payload.child_assembly_id = assemblies.get(val.toLowerCase()) ?? null; continue; }
          if (col === 'supplier_number' && def.key !== 'suppliers') { payload.primary_supplier_id = suppliers.get(val.toLowerCase()) ?? null; continue; }
          if (col === 'part_number' && def.key === 'bom') { payload.part_id = parts.get(val.toLowerCase()) ?? null; continue; }
          if (def.numeric?.includes(col)) { const n = Number(val.replace(',', '.')); payload[col] = Number.isFinite(n) ? n : null; continue; }
          if (def.boolean?.includes(col)) { payload[col] = toBool(val); continue; }
          payload[col] = val;
        }

        if (!Object.keys(payload).length) { skipped++; continue; }

        const matchValue = def.matchColumn ? raw[def.matchColumn]?.toLowerCase() : '';
        const existingId = matchValue ? existing.get(matchValue) : undefined;

        if (existingId) {
          const { error } = await supabase.from(def.table as any).update(payload).eq('id', existingId);
          if (error) { skipped++; addLog(`Fehler (${matchValue}): ${error.message}`); } else updated++;
        } else {
          const { error } = await supabase.from(def.table as any).insert(payload);
          if (error) { skipped++; addLog(`Fehler (${matchValue || 'Zeile'}): ${error.message}`); } else created++;
        }
      }

      addLog(`${def.label}: ${created} neu, ${updated} aktualisiert, ${skipped} übersprungen (${rows.length} Zeilen).`);
      toast.success(`${def.label}: ${created} neu, ${updated} aktualisiert${skipped ? `, ${skipped} Fehler` : ''}`);
    } catch (e: any) {
      toast.error(e.message || 'Import fehlgeschlagen');
      addLog(`${def.label}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={Database}
        title="Stammdaten-Import"
        subtitle="CSV-Import für Lieferanten, Geräte, Baugruppen, Einzelteile und Stücklisten."
      />

      {!canWrite && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Für den Import fehlen dir die Berechtigungen.</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ENTITIES.map((def, idx) => (
          <Card key={def.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge variant="outline" className="border-border text-muted-foreground">{idx + 1}</Badge>
                {def.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {def.hint && <p className="text-sm text-muted-foreground">{def.hint}</p>}
              <p className="text-xs font-mono text-muted-foreground break-all">{def.columns.join(' · ')}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(def)}>
                  <Download className="mr-2 h-4 w-4" /> Vorlage
                </Button>
                <Button size="sm" disabled={!canWrite || busy !== null} asChild={canWrite && busy === null}>
                  {canWrite && busy === null ? (
                    <label className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" /> CSV importieren
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(def, f); e.target.value = ''; }}
                      />
                    </label>
                  ) : (
                    <span className="flex items-center">
                      {busy === def.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      CSV importieren
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Protokoll</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-72 overflow-auto">
            {log.map((l, i) => <p key={i} className="text-xs font-mono text-muted-foreground">{l}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
