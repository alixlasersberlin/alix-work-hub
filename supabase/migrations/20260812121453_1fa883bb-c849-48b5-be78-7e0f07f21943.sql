ALTER TABLE public.rz_reminder_settings
  ADD COLUMN IF NOT EXISTS tpl_greeting text NOT NULL DEFAULT 'Sehr geehrte/r {anrede} {nachname},',
  ADD COLUMN IF NOT EXISTS tpl_intro text NOT NULL DEFAULT 'bitte beachten Sie, dass die Fälligkeit Ihrer monatlichen Rechnung am {faelligkeit} bevorsteht.',
  ADD COLUMN IF NOT EXISTS tpl_sepa_title text NOT NULL DEFAULT 'SEPA-Lastschriftverfahren',
  ADD COLUMN IF NOT EXISTS tpl_sepa_text text NOT NULL DEFAULT 'Da Sie bereits an unserem SEPA-Lastschriftverfahren teilnehmen, müssen Sie nichts weiter unternehmen. Der Rechnungsbetrag wird zum Fälligkeitstermin automatisch von Ihrem Konto eingezogen.',
  ADD COLUMN IF NOT EXISTS tpl_self_title text NOT NULL DEFAULT 'Selbstzahler',
  ADD COLUMN IF NOT EXISTS tpl_self_text text NOT NULL DEFAULT 'Als Selbstzahler bitten wir Sie, den offenen Rechnungsbetrag pünktlich bis zum Fälligkeitstermin zu überweisen.',
  ADD COLUMN IF NOT EXISTS tpl_thanks text NOT NULL DEFAULT 'Vielen Dank. Wir wünschen Ihnen einen angenehmen Tag.',
  ADD COLUMN IF NOT EXISTS tpl_shop_title text NOT NULL DEFAULT 'Schon gewusst?',
  ADD COLUMN IF NOT EXISTS tpl_shop_text text NOT NULL DEFAULT 'Viele Dinge können Sie ganz bequem online erledigen. Besuchen Sie einfach:',
  ADD COLUMN IF NOT EXISTS tpl_shop_items text[] NOT NULL DEFAULT ARRAY['Ultraschallgel','Zubehör','Ersatzteile','Verbrauchsmaterial','Dienstleistungen','viele weitere Produkte'],
  ADD COLUMN IF NOT EXISTS tpl_closing text NOT NULL DEFAULT 'Vielen Dank für Ihr Vertrauen.',
  ADD COLUMN IF NOT EXISTS tpl_team text NOT NULL DEFAULT 'Ihr Team von Alix.',
  ADD COLUMN IF NOT EXISTS tpl_show_shop_box boolean NOT NULL DEFAULT true;