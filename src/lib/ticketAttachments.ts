// Zentrale Validierung für Ticket-Anhänge (Portal + intern).
// Muss zum DB-Trigger `validate_ticket_attachment` passen.

export const TICKET_ATTACHMENT_MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export const TICKET_ATTACHMENT_BLOCKED_EXT = new Set([
  'exe','bat','cmd','com','scr','pif','msi','vbs','vbe','js','jse',
  'wsf','wsh','ps1','ps1xml','psm1','jar','app','sh','bash','zsh',
  'apk','ipa','dll','sys','reg','hta','htm','html','svg','xhtml',
  'phtml','php','php3','php4','php5','asp','aspx','jsp','cgi',
]);

export const TICKET_ATTACHMENT_BLOCKED_MIME = new Set([
  'text/html','application/xhtml+xml','image/svg+xml',
  'application/x-msdownload','application/x-msdos-program',
  'application/x-executable','application/x-mach-binary',
  'application/vnd.microsoft.portable-executable',
  'application/javascript','application/x-javascript','text/javascript',
  'application/x-httpd-php','application/x-sh',
]);

/** Empfohlene accept-Liste für <input type="file"> */
export const TICKET_ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,' +
  'application/pdf,' +
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/plain,text/csv,application/zip';

export function validateTicketAttachment(file: File): { ok: true } | { ok: false; reason: string } {
  if (file.size > TICKET_ATTACHMENT_MAX_SIZE) {
    return { ok: false, reason: `Datei „${file.name}" ist größer als 25 MB.` };
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (TICKET_ATTACHMENT_BLOCKED_EXT.has(ext)) {
    return { ok: false, reason: `Dateityp .${ext} ist aus Sicherheitsgründen nicht erlaubt.` };
  }
  const mime = (file.type || '').toLowerCase();
  if (mime && TICKET_ATTACHMENT_BLOCKED_MIME.has(mime)) {
    return { ok: false, reason: `MIME-Typ "${mime}" ist aus Sicherheitsgründen nicht erlaubt.` };
  }
  return { ok: true };
}
