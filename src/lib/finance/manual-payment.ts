export function manualPaymentError(amount: number, balance: number, date: string, evidence: string, today: string): string | null {
  if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return 'Der Zahlbetrag muss positiv sein und darf den offenen Betrag nicht überschreiten.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today) return 'Bitte ein gültiges Zahlungsdatum bis heute angeben.';
  if (evidence.trim().length < 5 || evidence.trim().length > 2000) return 'Bitte einen Zahlungsnachweis mit 5 bis 2000 Zeichen angeben.';
  return null;
}