INSERT INTO public.app_releases (version, build_number, platform, release_channel, status, stability, summary, changes, known_issues, rollback_plan)
VALUES (
  '1.0.0', '100', 'ALL', 'RC1', 'RC', 'OBSERVATION',
  'ALIXWORK MOBILE Release Candidate 1 – Inbox, Push, WhatsApp, AI, Command Center, Security, Design Polish.',
  '["ALIX INBOX","Push & Eskalationen","WhatsApp Senden/Medien","ALIX AI Assistant","Mobile Command Center","Security Hardening","Design Polish","Go-Live & Monitoring"]'::jsonb,
  '["Native Push-Credentials (APNs/FCM) fehlen","WhatsApp Outbound produktiv noch deaktiviert","Native iOS-/Android-Builds noch nicht real getestet"]'::jsonb,
  'Feature Rollback über Kill Switches in mobile_app_config (WhatsApp Outbound, AI, Push, Ticket Creation, Read Only). Backend-Migrationen sind additiv und werden nicht automatisch zurückgerollt.'
)
ON CONFLICT (version, build_number, platform) DO NOTHING;

INSERT INTO public.integration_health (integration, status)
VALUES
  ('whatsapp_inbound', 'UNKNOWN'),
  ('whatsapp_outbound', 'NOT CONFIGURED'),
  ('push', 'NOT CONFIGURED'),
  ('ai', 'UNKNOWN'),
  ('realtime', 'UNKNOWN'),
  ('tickets', 'UNKNOWN'),
  ('storage', 'UNKNOWN')
ON CONFLICT (integration) DO NOTHING;

INSERT INTO public.mobile_rollout_users (group_id, user_id, enabled)
SELECT g.id, ur.user_id, true
FROM public.mobile_rollout_groups g
CROSS JOIN LATERAL (
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE r.name = 'Super Admin'
) ur
WHERE g.name = 'DEVELOPERS'
ON CONFLICT (group_id, user_id) DO NOTHING;