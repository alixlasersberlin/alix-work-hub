import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Settings2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Setting = { setting_key: string; setting_value: any; description: string | null };

export default function DispatchEinstellungen() {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ['dispatch', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_settings').select('setting_key, setting_value, description').order('setting_key');
      if (error) throw error;
      return (data ?? []) as Setting[];
    },
  });

  useEffect(() => {
    if (data) {
      setValues(Object.fromEntries(data.map(s => [s.setting_key, JSON.stringify(s.setting_value, null, 2)])));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (key: string) => {
      const parsed = JSON.parse(values[key]);
      const { error } = await supabase.from('delivery_settings').update({ setting_value: parsed }).eq('setting_key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Einstellung gespeichert');
      qc.invalidateQueries({ queryKey: ['dispatch', 'settings'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Ungültige Eingabe'),
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Dispatch-Einstellungen" subtitle="Erinnerungsfristen, Standardwerte und Kundeninformation" icon={Settings2} />
      {(data ?? []).map(s => (
        <Card key={s.setting_key} className="p-4 space-y-3">
          <div>
            <Label className="text-base">{s.setting_key}</Label>
            {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
          </div>
          <Input
            className="font-mono text-xs h-auto py-2"
            value={values[s.setting_key] ?? ''}
            onChange={e => setValues({ ...values, [s.setting_key]: e.target.value })}
          />
          <Button size="sm" onClick={() => save.mutate(s.setting_key)} disabled={save.isPending}>Speichern</Button>
        </Card>
      ))}
    </div>
  );
}
