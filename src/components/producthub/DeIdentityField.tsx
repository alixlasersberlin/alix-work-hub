import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidDeIdentity = (v: string) => UUID.test(v.trim());

/** Super Admin legt die bestätigte Geräte-Kennung von alix-lasers.de fest. */
export function DeIdentityField({ productId }: { productId: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data } = await (supabase as any).from('ph_lang_sync_map').select('remote_product_id,verified_at')
      .eq('product_id', productId).eq('site_code', 'de').maybeSingle();
    const id = data?.verified_at ? data.remote_product_id : null;
    setCurrent(id); setValue(id ?? '');
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [productId]);
  const save = async () => {
    const v = value.trim();
    if (!isValidDeIdentity(v)) { toast.error('Bitte eine gültige DE-Kennung (Format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) eingeben.'); return; }
    if (current && current !== v && !confirm('Bestehende DE-Kennung ersetzen? Die alte Kennung wird protokolliert.')) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('ph_set_de_identity', { p_product_id: productId, p_remote_id: v });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('DE-Kennung gespeichert und bestätigt');
    load();
  };
  return (
    <div className="w-full flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">DE-Kennung:</span>
      <Input className="h-8 w-80 font-mono text-xs" placeholder="Kennung von alix-lasers.de" value={value} onChange={e => setValue(e.target.value)} />
      <Button size="sm" variant="outline" disabled={busy || value.trim() === (current ?? '')} onClick={save}>Kennung speichern</Button>
      <span className={current ? 'text-success' : 'text-destructive'}>{current ? 'bestätigt' : 'fehlt – Versand gesperrt'}</span>
    </div>
  );
}
