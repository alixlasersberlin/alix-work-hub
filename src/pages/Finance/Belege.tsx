import { useEffect, useRef, useState } from 'react';
import { Files, Upload, Download, Trash2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const DOC_TYPES = ['Rechnung','Gutschrift','Lieferschein','Mahnung','Lastschriftavis','Kontoauszug','SteuerExport','DATEVExport','XRechnung','ZUGFeRD','Eingangsrechnung','Sonstiges'];

const fmtBytes = (b: number | null | undefined) => {
  if (!b) return '–';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const sha256 = async (buf: ArrayBuffer) => {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function FinanceBelege() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('alle');
  const [uploadType, setUploadType] = useState<string>('Sonstiges');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('finance_documents' as any).select('*').order('document_date', { ascending: false }).limit(500);
    if (typeFilter !== 'alle') q = q.eq('document_type', typeFilter);
    const { data, error } = await q;
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setDocs((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const hash = await sha256(buf);
      const path = `${uploadType.toLowerCase()}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
      const up = await supabase.storage.from('finance-documents').upload(path, buf, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from('finance_documents' as any).insert({
        document_type: uploadType,
        reference: file.name,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        hash_sha256: hash,
      });
      if (error) throw error;
      toast({ title: 'Beleg hochgeladen', description: file.name });
      await load();
    } catch (err: any) {
      toast({ title: 'Upload-Fehler', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const download = async (d: any) => {
    const { data, error } = await supabase.storage.from('finance-documents').createSignedUrl(d.file_path, 300);
    if (error || !data?.signedUrl) { toast({ title: 'Fehler', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const remove = async (d: any) => {
    if (!confirm(`Beleg "${d.file_name}" wirklich löschen?`)) return;
    await supabase.storage.from('finance-documents').remove([d.file_path]);
    await supabase.from('finance_documents' as any).delete().eq('id', d.id);
    toast({ title: 'Gelöscht' });
    load();
  };

  const filtered = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [d.file_name, d.reference, d.document_type].some(v => String(v ?? '').toLowerCase().includes(s));
  });

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<Files className="w-6 h-6 text-primary" />}
        title="Belegarchiv"
        subtitle="GoBD-konforme Ablage aller Finanzbelege mit 10-Jahres Aufbewahrungsfrist"
        actions={
          <div className="flex gap-2 items-center">
            <Select value={uploadType} onValueChange={setUploadType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <input ref={fileRef} type="file" hidden onChange={onFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gold-gradient text-primary-foreground">
              <Upload className="w-4 h-4 mr-2" />{uploading ? 'Lade hoch…' : 'Beleg hochladen'}
            </Button>
          </div>
        }
      />

      <DataCard className="p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche nach Dateiname / Referenz…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Typen</SelectItem>
            {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </DataCard>

      <DataCard className="overflow-hidden">
        {loading ? <PageLoading /> : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">Keine Belege gefunden.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Datum</th>
                  <th className="text-left px-4 py-3">Typ</th>
                  <th className="text-left px-4 py-3">Datei</th>
                  <th className="text-left px-4 py-3">Referenz</th>
                  <th className="text-right px-4 py-3">Betrag</th>
                  <th className="text-right px-4 py-3">Größe</th>
                  <th className="text-left px-4 py-3">Aufbew. bis</th>
                  <th className="text-right px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs">{d.document_date ?? '–'}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{d.document_type}</Badge></td>
                    <td className="px-4 py-3 max-w-xs truncate" title={d.file_name}>{d.file_name}</td>
                    <td className="px-4 py-3 text-xs">{d.reference ?? '–'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{d.amount != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: d.currency ?? 'EUR' }).format(Number(d.amount)) : '–'}</td>
                    <td className="px-4 py-3 text-right text-xs">{fmtBytes(d.file_size)}</td>
                    <td className="px-4 py-3 text-xs">{d.retention_until ?? '–'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => download(d)}><Download className="w-3.5 h-3.5 mr-1" />Download</Button>
                      {isSuperAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => remove(d)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
