import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, Download } from 'lucide-react';

export default function AlixDocs2Compliance() {
  const [customerId, setCustomerId] = useState('');
  const [docType, setDocType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const runExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs2-compliance-export', {
        body: {
          customer_id: customerId || undefined,
          doc_type: docType || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `alixdocs2-manifest-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      toast.success(`Manifest mit ${data?.count ?? 0} Dokumenten erzeugt`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler beim Export');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> GoBD / DSGVO Compliance-Export
        </h1>
        <p className="text-sm text-muted-foreground">
          Erstellt ein signiertes Manifest (JSON) mit SHA-256-Hashes aller ausgewählten Dokumente.
          Nur Admin und Super Admin. Jeder Export wird im Audit-Log protokolliert.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Kunde-ID (optional)</Label><Input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="UUID" /></div>
            <div><Label>Doku-Typ (optional)</Label><Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="rechnung, vertrag, …" /></div>
            <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <Button onClick={runExport} disabled={loading} className="w-full">
            <Download className="w-4 h-4 mr-2" /> {loading ? 'Erzeuge Manifest…' : 'Manifest exportieren'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
