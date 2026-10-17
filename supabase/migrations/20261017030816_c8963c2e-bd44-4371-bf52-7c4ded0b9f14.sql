CREATE OR REPLACE FUNCTION public.comm_order_payment_evidence(p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'deposit_received', coalesce(o.deposit_ok,false) OR EXISTS (
      SELECT 1 FROM public.finance_deposits d WHERE d.order_id=o.id
      AND d.status NOT IN ('cancelled','storniert','void') AND d.gross_amount>0 AND d.paid_amount>=d.gross_amount-0.01
    ),
    'first_three_paid', EXISTS (
      SELECT 1 FROM public.rp_payment_plans p
      JOIN public.finance_contracts c ON c.id=p.contract_id
      WHERE c.order_id=o.id AND p.plan_type='raten' AND p.interval_months=1
      AND NOT EXISTS (SELECT 1 FROM generate_series(1,3) n WHERE NOT EXISTS (
        SELECT 1 FROM public.rp_billing_run_items i JOIN public.zoho_invoices z ON z.id=i.invoice_id
        WHERE i.plan_id=p.id AND i.installment_number=n AND z.total>0 AND z.balance<=0.01
        AND lower(z.status) NOT IN ('void','cancelled','storniert','draft')
      ))
    ) OR EXISTS (
      SELECT 1 FROM public.op_light_installment_plans p JOIN public.zoho_invoices z ON z.id=p.invoice_id
      WHERE z.reference_number=o.order_number AND (z.customer_id=o.customer_id::text OR z.customer_id=(SELECT to_jsonb(cu)->>'zoho_customer_id' FROM public.customers cu WHERE cu.id=o.customer_id)) AND lower(p.status) NOT IN ('cancelled','storniert','void')
      AND NOT EXISTS (SELECT 1 FROM generate_series(1,3) n WHERE NOT EXISTS (
        SELECT 1 FROM public.op_light_installments i WHERE i.plan_id=p.id AND i.seq=n AND i.paid_at IS NOT NULL AND i.amount>0
      ))
      AND EXISTS (SELECT 1 FROM public.op_light_installments a JOIN public.op_light_installments b ON b.plan_id=a.plan_id AND b.seq=2
        JOIN public.op_light_installments c ON c.plan_id=a.plan_id AND c.seq=3
        WHERE a.plan_id=p.id AND a.seq=1
        AND date_trunc('month',b.due_date)=date_trunc('month',a.due_date)+interval '1 month'
        AND date_trunc('month',c.due_date)=date_trunc('month',a.due_date)+interval '2 months')
    )
  ) FROM public.orders o WHERE o.id=p_order_id AND public.comm_can_read(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.comm_order_payment_evidence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comm_order_payment_evidence(uuid) TO authenticated, service_role;

WITH added AS (
  INSERT INTO public.commission_rules (name,description,commission_type,percent_value,basis,effective_event,payout_timing,installment_mode,installment_schedule,approval_required,auto_calculate,auto_prepare_payout,payout_grouped_monthly,valid_from)
  SELECT 'new','2,5 % vom Nettoauftragswert nach gebuchter Anzahlung; weitere 2,5 % erst nach Auslieferung UND vollständiger Bezahlung der ersten drei Monatsraten. Insgesamt 5 %.','percent',5,'net','deposit_received','immediate','custom_schedule',
    '[{"key":"deposit","percent":2.5,"event":"deposit_received"},{"key":"delivery_three_installments","percent":2.5,"event":"delivered","first_monthly_installments":3}]'::jsonb,
    true,true,false,false,current_date
  WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE name='new') RETURNING id
)
INSERT INTO public.commission_audit_logs (action,object_type,object_id,new_value)
SELECT 'Provisionsregel angelegt','rule',id,jsonb_build_object('name','new','basis','net','first_percent',2.5,'second_percent',2.5,'second_requires','delivered AND first 3 monthly installments paid') FROM added;