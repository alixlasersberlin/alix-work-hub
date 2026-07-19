import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, X, Loader2, CheckCircle2, FileImage } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Category { id: string; code: string; name: string; sort_order: number | null }
interface CustomerOpt { id: string; display: string }
interface Pending { id: string; file: File; preview: string; status: 'pending' | 'uploading' | 'done' | 'error'; message?: string }

export default function AlixDocsMobile() {
  const { user, loading: authLoading } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>('sonstiges');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOpts, setCustomerOpts] = useState<CustomerOpt[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('alixdocs_categories').select('id, code, name, sort_order').order('sort_order')
      .then(({ data }) => setCats((data as any) ?? []));
  }, []);

  // Customer search
  useEffect(() => {
    const t = setTimeout(async () => {
      if (customerQuery.trim().length < 2) { setCustomerOpts([]); return; }
      const q = customerQuery.trim();
      const { data } = await supabase
        .from('customers')
        .select('id, company_name, contact_person, customer_number, email')
        .or(`company_name.ilike.%${q}%,contact_person.ilike.%${q}%,customer_number.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      setCustomerOpts((data ?? []).map((c: any) => ({
        id: c.id,
        display: `${c.company_name || c.contact_person || '—'} · ${c.customer_number || ''}`,
      })));
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  // Resolve order number → order id
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!orderNumber.trim()) { setOrderId(null); return; }
      const { data } = await supabase
        .from('orders')
        .select('id, customer_id')
        .eq('order_number', orderNumber.trim())
        .maybeSingle();
      if (data) {
        setOrderId((data as any).id);
        if (!customerId && (data as any).customer_id) setCustomerId((data as any).customer_id);
      } else setOrderId(null);
    }, 400);
    return () => clearTimeout(t);
  }, [orderNumber]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Pending[] = [];
    Array.from(files).forEach((f) => {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: > 20 MB`); return; }
      next.push({
        id: crypto.randomUUID(),
        file: f,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        status: 'pending',
      });
    });
    setPending((p) => [...p, ...next]);
  };

  const removeItem = (id: string) => setPending((p) => p.filter((x) => x.id !== id));

  const uploadOne = async (item: Pending): Promise<void> => {
    const fd = new FormData();
    fd.append('file', item.file);
    if (orderId) fd.append('order_id', orderId);
    if (customerId) fd.append('customer_id', customerId);
    fd.append('category_code', category);
    fd.append('title', item.file.name.replace(/\.[^.]+$/, ''));
    fd.append('confidentiality_level', 'internal');
    const { data, error } = await supabase.functions.invoke('alixdocs-upload', { body: fd });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
  };

  const uploadAll = async () => {
    if (pending.length === 0) { toast.error('Keine Dateien ausgewählt'); return; }
    if (!customerId && !orderId) { toast.error('Kunde oder Auftrag wählen'); return; }
    setUploading(true);
    let ok = 0, fail = 0;
    for (const item of pending) {
      if (item.status === 'done') { ok++; continue; }
      setPending((p) => p.map((x) => x.id === item.id ? { ...x, status: 'uploading' } : x));
      try {
        await uploadOne(item);
        setPending((p) => p.map((x) => x.id === item.id ? { ...x, status: 'done' } : x));
        ok++;
      } catch (e: any) {
        setPending((p) => p.map((x) => x.id === item.id ? { ...x, status: 'error', message: e?.message } : x));
        fail++;
      }
    }
    setUploading(false);
    toast[fail ? 'warning' : 'success'](`${ok} hochgeladen${fail ? `, ${fail} Fehler` : ''}`);
  };

  const selectedCustomerLabel = useMemo(
    () => customerOpts.find((o) => o.id === customerId)?.display,
    [customerOpts, customerId]
  );

  if (authLoading) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" /> AlixDocs Mobile
        </h1>
        <p className="text-xs text-muted-foreground">Belege & Dokumente per Kamera oder Datei erfassen</p>
      </header>

      <div className="p-4 space-y-4 max-w-xl mx-auto">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">1. Zuordnung</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Kunde suchen</Label>
              <Input
                inputMode="search"
                placeholder="Name, Kundennr, E-Mail…"
                value={customerQuery}
                onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId(null); }}
              />
              {customerOpts.length > 0 && !customerId && (
                <div className="mt-1 border rounded-md max-h-48 overflow-auto bg-card">
                  {customerOpts.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => { setCustomerId(o.id); setCustomerQuery(o.display); setCustomerOpts([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >{o.display}</button>
                  ))}
                </div>
              )}
              {customerId && (
                <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {selectedCustomerLabel || 'Kunde gewählt'}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Auftragsnummer (optional)</Label>
              <Input placeholder="z. B. SO-3540" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              {orderId && <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auftrag gefunden
              </div>}
            </div>

            <div>
              <Label className="text-xs">Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">2. Erfassen</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={() => cameraRef.current?.click()} className="h-16">
                <Camera className="w-5 h-5 mr-2" /> Kamera
              </Button>
              <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()} className="h-16">
                <FileImage className="w-5 h-5 mr-2" /> Datei
              </Button>
            </div>
            <input
              ref={cameraRef} type="file" accept="image/*" capture="environment"
              multiple className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={fileRef} type="file" accept="image/*,application/pdf"
              multiple className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />

            {pending.length > 0 && (
              <div className="space-y-2">
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border rounded-md p-2">
                    {p.preview ? (
                      <img src={p.preview} className="w-14 h-14 object-cover rounded" alt="" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-muted flex items-center justify-center text-xs">PDF</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(p.file.size / 1024).toFixed(0)} KB
                        {p.status === 'uploading' && ' · lädt hoch…'}
                        {p.status === 'done' && ' · ✓ fertig'}
                        {p.status === 'error' && ` · Fehler: ${p.message ?? ''}`}
                      </div>
                    </div>
                    {p.status === 'uploading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : p.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => removeItem(p.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-3">
        <div className="max-w-xl mx-auto">
          <Button
            className="w-full h-12"
            onClick={uploadAll}
            disabled={uploading || pending.length === 0 || (!customerId && !orderId)}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Upload className="w-5 h-5 mr-2" />}
            {pending.length > 0 ? `${pending.length} Dokument(e) hochladen` : 'Dokumente hochladen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
