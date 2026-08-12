/**
 * Mehrsprachige Texte für die Zahlungserinnerungen der wiederkehrenden Zahler.
 * Deutsch ist Standard – weitere Sprachen können hier ergänzt werden.
 */
export const RZ_T = {
  de: {
    subject: 'Ihre monatliche Rechnung',
    sepaTitle: 'SEPA-Lastschriftverfahren',
    sepaText:
      'Da Sie bereits an unserem SEPA-Lastschriftverfahren teilnehmen, müssen Sie nichts weiter unternehmen. Der Rechnungsbetrag wird zum Fälligkeitstermin automatisch von Ihrem Konto eingezogen.',
    selfTitle: 'Selbstzahler',
    selfText:
      'Als Selbstzahler bitten wir Sie, den offenen Rechnungsbetrag pünktlich bis zum Fälligkeitstermin zu überweisen.',
    thanks: 'Vielen Dank. Wir wünschen Ihnen einen angenehmen Tag.',
    didYouKnow: 'Schon gewusst?',
    shopText: 'Viele Dinge können Sie ganz bequem online erledigen. Besuchen Sie einfach:',
    closing: 'Vielen Dank für Ihr Vertrauen.',
    team: 'Ihr Team von Alix.',
  },
} as const;

export type RzLang = keyof typeof RZ_T;
