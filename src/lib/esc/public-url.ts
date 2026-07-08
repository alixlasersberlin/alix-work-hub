// All public-facing links MUST use https://alixworks.de.
// Never leak preview or Supabase URLs into e-mails, tokens, or public pages.
export const ALIXWORKS_PUBLIC_BASE = 'https://alixwork.de';

export function publicUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${ALIXWORKS_PUBLIC_BASE}${clean}`;
}

export function confirmUrl(token: string): string {
  return publicUrl(`/appointment/${encodeURIComponent(token)}`);
}
export function rescheduleUrl(token: string): string {
  return publicUrl(`/appointment/reschedule/${encodeURIComponent(token)}`);
}
export function cancelUrl(token: string): string {
  return publicUrl(`/appointment/cancel/${encodeURIComponent(token)}`);
}
export function declineUrl(token: string): string {
  return publicUrl(`/appointment/decline/${encodeURIComponent(token)}`);
}
export function checkinUrl(token: string): string {
  return publicUrl(`/checkin/${encodeURIComponent(token)}`);
}
export function bookingUrl(department?: string, service?: string): string {
  if (department && service) return publicUrl(`/book/${encodeURIComponent(department)}/${encodeURIComponent(service)}`);
  if (department) return publicUrl(`/book/${encodeURIComponent(department)}`);
  return publicUrl('/book');
}
