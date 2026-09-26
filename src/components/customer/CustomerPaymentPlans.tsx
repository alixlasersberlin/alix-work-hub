import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InstallmentPlanView, METHOD } from '@/pages/Finance/SepaMonatslauf';

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

/** Kundenakte: Zahlungsplan (Ratenpläne + laufende Pläne). Nur sichtbar mit Finance-Leserecht (RLS). */
export default function CustomerPaymentPlans({ customerId }: { customerId: string }) {
  const [plans, setPlans] = useState<any[] | null>(null);
  useEffect(() => {
    (supabase as any).from('rp_payment_plans').select('*').eq('customer_id', customerId).order('created_at').then(({ data }: any) => setPlans(data || []));
  }, [customerId]);
  if (!plans?.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Zahlungsplan</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {plans.map((p) => (
          <div key={p.id} className="space-y-2">
            <div className="text-sm font-medium">{p.product} · {METHOD[p.payment_method]} · {p.plan_type === 'raten' ? `${p.installment_count} × ${eur(p.gross_amount)}` : `${eur(p.gross_amount)} ${p.billing_interval}`}</div>
            {p.plan_type === 'raten' && <InstallmentPlanView plan={p} canEdit={false} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
