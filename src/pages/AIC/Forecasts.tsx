import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';

export default function AicForecasts() {
  const { data } = useQuery({
    queryKey: ['aic', 'forecasts-all'],
    queryFn: async () => {
      const { data } = await supabase.from('aic_forecasts').select('*').order('generated_at', { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold mb-4">Prognosen</h2>
      {!data?.length ? <p className="text-sm text-muted-foreground">Noch keine Prognosen.</p> : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr><th className="text-left p-2">Typ</th><th className="text-right p-2">Wert</th><th className="text-right p-2">Konfidenz</th><th className="text-left p-2">Begründung</th><th className="text-left p-2">Erzeugt</th></tr></thead>
          <tbody>
            {data.map((f: any) => (
              <tr key={f.id} className="border-t border-border">
                <td className="p-2 font-medium">{f.kind}</td>
                <td className="p-2 text-right font-mono text-primary">{f.value != null ? Number(f.value).toLocaleString('de-DE') : '–'} {f.unit}</td>
                <td className="p-2 text-right">{f.confidence != null ? Math.round(Number(f.confidence) * 100) + '%' : '–'}</td>
                <td className="p-2 text-muted-foreground">{f.rationale}</td>
                <td className="p-2 text-xs text-muted-foreground">{new Date(f.generated_at).toLocaleString('de-DE')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
