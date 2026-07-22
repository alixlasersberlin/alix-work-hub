import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FileType } from 'lucide-react';

export default function AlixDocs2DocTypes() {
  const [items, setItems] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  async function load() {
    const { data } = await supabase.from('alixdocs2_doctypes').select('*').order('label');
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggle(code: string, requires_approval: boolean) {
    const { error } = await supabase.from('alixdocs2_doctypes').update({ requires_approval }).eq('code', code);
    if (error) return toast.error(error.message);
    load();
  }
  async function add() {
    if (!newKey.trim() || !newLabel.trim()) return;
    const { error } = await supabase.from('alixdocs2_doctypes').insert({ code: newKey.trim(), label: newLabel.trim() });
    if (error) return toast.error(error.message);
    setNewKey(''); setNewLabel(''); load();
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2"><FileType className="w-6 h-6" /> Dokumententypen</h1>
        <p className="text-sm text-muted-foreground">Stammdaten für die KI-Klassifizierung. Vier-Augen-Freigabe kann pro Typ aktiviert werden.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Neuen Typ anlegen</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Schlüssel (z.B. rechnung)" value={newKey} onChange={e => setNewKey(e.target.value)} />
          <Input placeholder="Anzeige (z.B. Rechnung)" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <Button onClick={add}>Hinzufügen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Typen ({items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Typen definiert.</p>}
          {items.map(t => (
            <div key={t.code} className="flex items-center justify-between border rounded p-2 text-sm">
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{t.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">Vier-Augen</span>
                <Switch checked={!!t.requires_approval} onCheckedChange={v => toggle(t.code, v)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
