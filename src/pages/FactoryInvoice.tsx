import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, Search, Upload, Download, Building2, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Row {
  id: string;
  order_number: string;
  production_order_number: string | null;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  supplier_id: string;
  approval_status: string;
  approved_at: string | null;
  invoice_pdf_path: string | null;
  is_reclamation: boolean;
  supplier?: { name: string | null } | null;
}

export default function FactoryInvoice() {
  const { roles } = useAuth();
  const canUpload = roles.includes('Super Admin') || roles.includes('FACTORY INVOICE');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('id, order_number, production_order_number, status, liefertermin, modellname, farbe, bearbeiter, supplier_id, approval_status, approved_at, invoice_pdf_path, is_reclamation, supplier:suppliers(name)')
      .eq('approval_status', 'approved')
      .order('approved_at', { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.production_order_number || ''} ${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.supplier?.name || ''}`
        .toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handlePickFile = (row: Row) => {
    if (!canUpload) return;
    activeRowRef.current = row;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const row = activeRowRef.current;
    e.target.value = '';
    if (!file || !row) return;
    if (file.type !== 'application/pdf') {
      toast.error('Bitte PDF-Datei wählen');
      return;
    }
    setUploadingId(row.id);
    try {
      const path = `invoices/${row.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('production-orders')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const { error: rpcErr } = await supabase.rpc('set_factory_invoice_pdf', {
        _production_order_id: row.id,
        _path: path,
      });
      if (rpcErr) throw rpcErr;
      toast.success('Invoice hochgeladen');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Upload fehlgeschlagen');
    } finally {
      setUploadingId(null);
      activeRowRef.current = null;
    }
  };

  const downloadInvoice = async (row: Row) => {
    if (!row.invoice_pdf_path) return;
    const { data, error } = await supabase.storage.from('production-orders').download(row.invoice_pdf_path);
    if (error || !data) return toast.error(error?.message || 'Download fehlgeschlagen');
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${row.production_order_number || row.order_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Receipt className="w-6 h-6" /> Factory Invoice
          </h1>
          <p className="text-sm text-muted-foreground">
            Lieferanten-Rechnungen zu freigegebenen Bestellungen hochladen
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {filtered.length} Bestellungen
        </Badge>
      </div>

      {!canUpload && (
        <Card className="p-3 border-yellow-500/40 bg-yellow-500/5 text-xs text-yellow-500">
          Sie haben keine Berechtigung, Factory-Invoices hochzuladen. Nur die Rollen <b>Super Admin</b> und <b>FACTORY INVOICE</b> dürfen Uploads durchführen.
        </Card>
      )}

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Lieferant, Auftragsnr., Modell, Farbe…"
            className="pl-9 h-9"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Keine Bestellungen vorhanden.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.production_order_number || r.order_number}</span>
                    {r.is_reclamation && (
                      <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-500">Reklamation</Badge>
                    )}
                    {r.invoice_pdf_path && (
                      <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Invoice
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                    {r.supplier?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {r.supplier.name}
                      </span>
                    )}
                    {r.modellname && <span>· {r.modellname}</span>}
                    {r.farbe && <span>· {r.farbe}</span>}
                    {r.bearbeiter && <span>· {r.bearbeiter}</span>}
                    {r.liefertermin && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(r.liefertermin), 'dd.MM.yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.invoice_pdf_path && (
                    <Button variant="outline" size="sm" onClick={() => downloadInvoice(r)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                    </Button>
                  )}
                  {canUpload && (
                    <Button
                      size="sm"
                      className="gold-gradient"
                      onClick={() => handlePickFile(r)}
                      disabled={uploadingId === r.id}
                    >
                      {uploadingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {r.invoice_pdf_path ? 'Ersetzen' : 'Upload Invoice'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
