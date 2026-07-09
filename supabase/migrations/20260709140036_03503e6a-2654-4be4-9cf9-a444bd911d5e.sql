-- Add customer number range so customer numbers share the Vorgangs-Stammnummer,
-- differing only by prefix (e.g. K-2026-04240 for case 2026-04240).
INSERT INTO public.number_ranges (
  code, label, prefix, separator, include_year, padding,
  start_value, current_value, active, inherit_case, reset_yearly, notes
) VALUES (
  'customer',
  'Kundennummer',
  'K',
  '-',
  true,
  5,
  1,
  0,
  true,
  true,
  true,
  'Kundennummer bei manueller Kundenanlage. Erbt die Vorgangs-Stammnummer (Format K-JJJJ-NNNNN), damit Kunde, Angebot, Auftrag, Rechnung usw. dieselbe Basisnummer teilen.'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  prefix = EXCLUDED.prefix,
  separator = EXCLUDED.separator,
  include_year = EXCLUDED.include_year,
  padding = EXCLUDED.padding,
  inherit_case = EXCLUDED.inherit_case,
  active = true,
  notes = EXCLUDED.notes,
  updated_at = now();
