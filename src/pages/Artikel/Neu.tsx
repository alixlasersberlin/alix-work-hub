import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PM_CATEGORIES, PM_SEGMENTS, PM_STATUS } from '@/lib/produktmaster/config';
import { pmUid } from '@/lib/produktmaster/api';
import { phSlug } from '@/lib/producthub/config';

const db = supabase as any;

function NeuField({ k, label, f, setF }: any) {
  return (
    <div><Label className="text-xs">{label}</Label>
      <Input value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
  );
}

export default function ArtikelNeu() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({
    sku: '', name: '', model: '', product_family: '', brand: 'ALIX', manufacturer: '',
    manufacturer_sku: '', ean: '', revision: '', segment: 'Beauty', status: 'draft',
    product_group: '', series: '', categories: [] as string[],
  });

  const toggleCat = (c: string) =>
    setF((s: any) => ({ ...s, categories: s.categories.includes(c) ? s.categories.filter((x: string) => x !== c) : [...s.categories, c] }));

  const save = async () => {
    if (!f.sku.trim() || !f.name.trim()) { toast.error('Artikelnummer und Produktname sind Pflichtfelder'); return; }
    setBusy(true);
    try {
      const uid = await pmUid();
      const { data, error } = await db.from('ph_products').insert({
        ...f,
        slug: phSlug(f.name),
        alix_product_id: `ALX-${f.sku.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
        created_by: uid, updated_by: uid,
      }).select('id').single();
      if (error) throw error;
      toast.success('Artikel angelegt');
      nav(`/artikel/${data.id}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };


  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <PageHeader title="Neuen Artikel anlegen" subtitle="Identifikation & Klassifizierung – weitere Bereiche folgen in der Produktakte" icon={Plus} />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Identifikation</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div><Label className="text-xs">Artikelnummer / SKU *</Label>
            <Input value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} /></div>
          <div><Label className="text-xs">Produktname *</Label>
            <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <NeuField f={f} setF={setF} k="model" label="Modellbezeichnung" />
          <NeuField f={f} setF={setF} k="product_family" label="Produktfamilie" />
          <NeuField f={f} setF={setF} k="brand" label="Marke" />
          <NeuField f={f} setF={setF} k="manufacturer" label="Hersteller" />
          <NeuField f={f} setF={setF} k="manufacturer_sku" label="Hersteller-Artikelnummer" />
          <NeuField f={f} setF={setF} k="ean" label="EAN" />
          <NeuField f={f} setF={setF} k="revision" label="Revision / Version" />
          <NeuField f={f} setF={setF} k="series" label="Serie" />
          <NeuField f={f} setF={setF} k="product_group" label="Produktgruppe" />
          <div><Label className="text-xs">Segment</Label>
            <Select value={f.segment} onValueChange={v => setF({ ...f, segment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PM_SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label className="text-xs">Status</Label>
            <Select value={f.status} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PM_STATUS.map(s => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
            </Select></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Kategorien (Mehrfachauswahl) *</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PM_CATEGORIES.map(c => (
            <Badge key={c} variant={f.categories.includes(c) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleCat(c)}>{c}</Badge>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Artikel anlegen</Button>
        <Button variant="outline" onClick={() => nav('/artikel/liste')}>Abbrechen</Button>
      </div>
    </div>
  );
}
