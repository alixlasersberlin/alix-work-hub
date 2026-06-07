import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Tenant {
  id: string; code: string; name: string;
  country: string | null; currency: string | null; flag_emoji: string | null;
  zoho_source_system: string | null; is_active: boolean; sort_order: number;
}

export default function Mandanten() {
  const { hasRole } = useAuth();
  const canManage = hasRole('Super Admin');
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*').order('sort_order');
    if (error) toast.error(error.message);
    setRows(((data as any) || []) as Tenant[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (t: Tenant) => {
    setSaving(t.id);
    const { error } = await supabase.from('tenants').update({
      name: t.name, country: t.country, currency: t.currency, flag_emoji: t.flag_emoji,
      zoho_source_system: t.zoho_source_system || null, is_active: t.is_active, sort_order: t.sort_order,
    }).eq('id', t.id);
    setSaving(null);
    if (error) toast.error(error.message); else { toast.success('Gespeichert'); load(); }
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mandanten</h1>
          <p className="text-sm text-muted-foreground">Verwaltung der Konzerngesellschaften.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> lädt…</div>
      ) : (
        <div className="grid gap-4">
          {rows.map((t, idx) => (
            <Card key={t.id} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                <div>
                  <Label>Code</Label>
                  <Input value={t.code} disabled />
                </div>
                <div className="md:col-span-2">
                  <Label>Name</Label>
                  <Input value={t.name} onChange={(e) => { const c = [...rows]; c[idx] = { ...t, name: e.target.value }; setRows(c); }} disabled={!canManage} />
                </div>
                <div>
                  <Label>Land</Label>
                  <Input value={t.country ?? ''} onChange={(e) => { const c = [...rows]; c[idx] = { ...t, country: e.target.value }; setRows(c); }} disabled={!canManage} />
                </div>
                <div>
                  <Label>Währung</Label>
                  <Input value={t.currency ?? ''} onChange={(e) => { const c = [...rows]; c[idx] = { ...t, currency: e.target.value }; setRows(c); }} disabled={!canManage} />
                </div>
                <div>
                  <Label>Flagge</Label>
                  <Input value={t.flag_emoji ?? ''} onChange={(e) => { const c = [...rows]; c[idx] = { ...t, flag_emoji: e.target.value }; setRows(c); }} disabled={!canManage} />
                </div>
                <div>
                  <Label>Zoho Quelle</Label>
                  <Input value={t.zoho_source_system ?? ''} placeholder="zoho_eu_1" onChange={(e) => { const c = [...rows]; c[idx] = { ...t, zoho_source_system: e.target.value }; setRows(c); }} disabled={!canManage} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={t.is_active} onCheckedChange={(v) => { const c = [...rows]; c[idx] = { ...t, is_active: v }; setRows(c); }} disabled={!canManage} />
                  <span className="text-sm text-muted-foreground">{t.is_active ? 'aktiv' : 'inaktiv'}</span>
                </div>
                {canManage && (
                  <div className="md:col-span-7 flex justify-end">
                    <Button onClick={() => save(t)} disabled={saving === t.id} className="gold-gradient">
                      {saving === t.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Speichern
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
