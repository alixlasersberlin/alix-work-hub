ALTER TABLE public.ac_conversations
  ADD COLUMN IF NOT EXISTS inbox_status TEXT NOT NULL DEFAULT 'NEW';
CREATE INDEX IF NOT EXISTS idx_ac_conv_inbox_status ON public.ac_conversations (inbox_status);
UPDATE public.ac_conversations SET inbox_status = CASE
  WHEN status::text IN ('resolved') THEN 'RESOLVED'
  WHEN status::text IN ('closed') THEN 'ARCHIVED'
  WHEN status::text IN ('pending','snoozed') THEN 'IN_PROGRESS'
  WHEN assigned_to IS NOT NULL THEN 'IN_PROGRESS'
  ELSE 'NEW' END
WHERE inbox_status = 'NEW';