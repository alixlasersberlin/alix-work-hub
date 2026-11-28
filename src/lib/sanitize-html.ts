import DOMPurify from 'dompurify';

/** Encode plain text for HTML text nodes and quoted attributes, not URLs or scripts. */
export function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

/**
 * Sanitize untrusted HTML before injecting via dangerouslySetInnerHTML.
 * Used for mail bodies (inbound + templates) which can be authored by any
 * staff member with mail access and viewed by admins/other staff.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'srcdoc'],
  });
}
