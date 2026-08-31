ALTER TABLE public.compliance_tasks ADD COLUMN IF NOT EXISTS co_assignee_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.compliance_tasks
SET co_assignee_ids = ARRAY['587ff294-b34a-4c45-a8c0-a14a04ba3a8a'::uuid]
WHERE mandatory = true
  AND assignee_id = '40e9003c-1819-4ec2-89c3-5ec51ab4b7b5'
  AND NOT ('587ff294-b34a-4c45-a8c0-a14a04ba3a8a'::uuid = ANY(co_assignee_ids));

INSERT INTO public.compliance_project_members (project_id, user_id, role, active, can_review, can_approve)
SELECT DISTINCT t.project_id, '587ff294-b34a-4c45-a8c0-a14a04ba3a8a'::uuid, 'COMPLIANCE_LEAD', true, true, true
FROM public.compliance_tasks t
WHERE t.mandatory = true
ON CONFLICT DO NOTHING;