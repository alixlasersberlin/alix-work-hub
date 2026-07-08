
-- Document intentional realtime publications to satisfy security review
COMMENT ON TABLE public.system_maintenance IS
  'Intentionally published to supabase_realtime and readable by anon: powers the global maintenance banner/overlay for all visitors (incl. logged-out). Content is non-sensitive (enabled flag + message). Do NOT add sensitive columns to this table.';

COMMENT ON TABLE public.order_items IS
  'Intentionally published to supabase_realtime for live order detail updates. Access is scoped by RLS (role-based). Any policy relaxation MUST be reviewed against realtime exposure.';

COMMENT ON TABLE public.offer_followup_tasks IS
  'Intentionally published to supabase_realtime for live follow-up task board updates. Access is scoped by RLS. Any policy relaxation MUST be reviewed against realtime exposure.';

COMMENT ON TABLE public.offer_outcomes IS
  'Intentionally published to supabase_realtime for live offer outcome updates. Access is scoped by RLS. Any policy relaxation MUST be reviewed against realtime exposure.';
