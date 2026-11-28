/** Only provider-owned HTTPS media and this project's private storage are fetched. */
export function allowedVoiceMedia(value: unknown, supabaseUrl: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value), project = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    return (url.origin === project.origin && url.pathname.startsWith('/storage/v1/object/'))
      || (url.hostname === 'api.twilio.com' && url.pathname.startsWith('/2010-04-01/Accounts/'));
  } catch { return false; }
}