import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Activity, Search, Loader2, Calendar, Euro, CheckCircle2, XCircle,
  Factory, Package, Truck, MapPin, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { withAt } from '@/lib/atSuffix';
import { toast } from 'sonner';

type StatusResult = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  source_system: string | null;
  order_date: string | null;
  total_amount: number | null;
  deposit_ok: boolean | null;
  deposit_ok_at: string | null;
  deposit_amount: number | null;
  salesperson_name: string | null;
  customer_name: string;
  production_orders: number;
  reserviert: number;
  geliefert: number;
  route_plans: number;
};

const fmtMoney = (n: number | null | undefined) =>
  n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n));
const fmtDate = (d: string | null | undefined) =>
  !d ? '–' : new Date(d).toLocaleDateString('de-DE');

export default function AuftragStatus() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);

    // Normalize: strip "-AT", uppercase. Also try with "SO-" prefix if user typed digits.
    const base = term.toUpperCase().replace(/-AT$/i, '').trim();
    const variants = Array.from(new Set([
      base,
      base.startsWith('SO-') ? base : `SO-${base.replace(/^S-/, '')}`,
      base.replace(/^S-/, 'SO-'),
    ]));

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`id, order_number, order_status, source_system, order_date, total_amount,
               deposit_ok, deposit_ok_at, deposit_amount, salesperson_name, customer_id,
               customers ( company_name, contact_name )`)
      .in('order_number', variants)
      .limit(1);

    if (error) {
      toast.error('Fehler bei der Suche');
      setLoading(false);
      return;
    }

    const o: any = (orders ?? [])[0];
    if (!o) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const [prodRes, resRes, delRes, rpRes] = await Promise.all([
      supabase.from('production_orders').select('id', { count: 'exact', head: true }).eq('order_id', o.id),
      supabase.from('lager_devices').select('id', { count: 'exact', head: true }).eq('reserved_order_id', o.id),
      supabase.from('lager_devices').select('id', { count: 'exact', head: true }).eq('delivered_order_id', o.id),
      supabase.from('route_plans').select('id', { count: 'exact', head: true }).eq('order_id', o.id),
    ]);

    setResult({
      id: o.id,
      order_number: o.order_number,
      order_status: o.order_status,
      source_system: o.source_system,
      order_date: o.order_date,
      total_amount: o.total_amount,
      deposit_ok: o.deposit_ok,
      deposit_ok_at: o.deposit_ok_at,
      deposit_amount: o.deposit_amount,
      salesperson_name: o.salesperson_name,
      customer_name: o.customers?.company_name || o.customers?.contact_name || '–',
      production_orders: prodRes.count ?? 0,
      reserviert: resRes.count ?? 0,
      geliefert: delRes.count ?? 0,
      route_plans: rpRes.count ?? 0,
    });
    setLoading(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') search();
  }

  const isAt = result?.source_system === 'zoho_eu_2';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Auftragsstatus</h1>
          <p className="text-muted-foreground text-sm">
            Schnellabfrage: Status, Anzahlung, Bestellung, Reservierung, Lieferung & Tourenplanung zu einem Auftrag.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auftragsnummer suchen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="z. B. SO-4063"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                className="pl-8 uppercase"
              />
            </div>
            <Button onClick={search} disabled={loading || !q.trim()} className="gold-gradient text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Status prüfen
            </Button>
          </div>
        </CardContent>
      </Card>

      {notFound && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Kein Auftrag mit dieser Nummer gefunden.
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-xl">{withAt(result.order_number, result.source_system)}</CardTitle>
              {isAt && <Badge variant="outline">AT 🇦🇹</Badge>}
              <Badge variant="secondary" className="capitalize">{result.order_status || '–'}</Badge>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={`/auftraege/${result.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Zum Auftrag
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Kunde" value={result.customer_name} />
              <Field label="Verkäufer" value={result.salesperson_name || '–'} />
              <Field label="Auftragsdatum" icon={<Calendar className="h-4 w-4" />} value={fmtDate(result.order_date)} />
              <Field label="Auftragssumme" icon={<Euro className="h-4 w-4" />} value={fmtMoney(result.total_amount)} />
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold mb-3">Anzahlung</div>
              <div className="flex items-center gap-3 flex-wrap">
                {result.deposit_ok ? (
                  <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> bestätigt</Badge>
                ) : (
                  <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> offen</Badge>
                )}
                <span className="text-sm text-muted-foreground">am {fmtDate(result.deposit_ok_at)}</span>
                <span className="text-sm font-medium">· {fmtMoney(result.deposit_amount)}</span>
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold mb-3">Prozessfortschritt</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StepCard icon={<Factory className="h-4 w-4" />} label="Produktionsbestellung" count={result.production_orders} ok={result.production_orders > 0} />
                <StepCard icon={<Package className="h-4 w-4" />} label="Reserviert (Lager)" count={result.reserviert} ok={result.reserviert > 0} />
                <StepCard icon={<Truck className="h-4 w-4" />} label="Geliefert" count={result.geliefert} ok={result.geliefert > 0} />
                <StepCard icon={<MapPin className="h-4 w-4" />} label="Tourenplanung" count={result.route_plans} ok={result.route_plans > 0} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{value}</div>
    </div>
  );
}

function StepCard({ icon, label, count, ok }: { icon: React.ReactNode; label: string; count: number; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? 'border-emerald-600/40 bg-emerald-600/5' : 'border-border bg-muted/20'}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-2xl font-bold">{count}</span>
        {ok ? (
          <Badge className="bg-emerald-600 text-white text-[10px]">erledigt</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">offen</Badge>
        )}
      </div>
    </div>
  );
}
