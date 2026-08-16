UPDATE public.ph_products
SET laser_class = 'IIb',
    intended_use = COALESCE(NULLIF(intended_use, ''), 'Medizinisches Diodenlaser-System zur dauerhaften Haarentfernung bzw. Haarreduktion an menschlicher Haut; Anwendung ausschliesslich durch geschultes Fachpersonal.'),
    updated_at = now()
WHERE slug = 'alix-blueice-smart-ki';

INSERT INTO public.ph_master_fields (product_id, field_name, proposed_value, master_value, previous_value, source_of_truth, verification_status, decision_status, note, approved_by_email, approved_at)
SELECT p.id, f.field_name, NULL,
       CASE f.field_name WHEN 'laser_class' THEN p.laser_class ELSE p.intended_use END,
       NULL, 'Technische Dokumentation', 'documentation_verified', 'approved',
       'Phase B Master Data Review: manuell bestaetigt', 'system@alix-operation.de', now()
FROM public.ph_products p
CROSS JOIN (VALUES ('laser_class'), ('intended_use')) AS f(field_name)
WHERE p.slug = 'alix-blueice-smart-ki'
ON CONFLICT (product_id, field_name) DO UPDATE
SET master_value = EXCLUDED.master_value,
    source_of_truth = EXCLUDED.source_of_truth,
    verification_status = EXCLUDED.verification_status,
    decision_status = 'approved',
    note = EXCLUDED.note,
    approved_at = now(),
    updated_at = now();

INSERT INTO public.ph_field_history (product_id, alix_product_id, field_name, old_value, new_value, is_critical, source, approval_status, changed_by_email)
SELECT p.id, p.alix_product_id, f.field_name, NULL,
       CASE f.field_name WHEN 'laser_class' THEN p.laser_class ELSE p.intended_use END,
       true, 'master_review:Technische Dokumentation', 'approved', 'system@alix-operation.de'
FROM public.ph_products p
CROSS JOIN (VALUES ('laser_class'), ('intended_use')) AS f(field_name)
WHERE p.slug = 'alix-blueice-smart-ki';