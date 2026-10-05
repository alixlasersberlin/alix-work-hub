// Absender, aus denen NIE Tickets entstehen dürfen (eigene System-/Kopie-Mails).
const BLOCKED_SENDERS = [
  "@alixwork.de", // alle eigenen alixwork.de-Absender
  "service@alix-lasers.com",
  "noreply@alixlasers.ai",
  "noreply@eanamnese.de",
];

export function isBlockedTicketSender(raw: unknown): boolean {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return false;
  return BLOCKED_SENDERS.some((b) => s.includes(b));
}
