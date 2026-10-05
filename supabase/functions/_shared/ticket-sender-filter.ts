// Absender, aus denen NIE Tickets entstehen dürfen (eigene System-/Kopie-Mails).
const BLOCKED_SENDERS = ["noreply@alixwork.de", "service@alix-lasers.com"];

export function isBlockedTicketSender(raw: unknown): boolean {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return false;
  return BLOCKED_SENDERS.some((b) => s.includes(b));
}
