import twilio from 'npm:twilio@5.10.4';
import { Webhook } from 'npm:standardwebhooks@1.0.0';

export async function validTwilioRequest(req: Request, endpoint: string, token = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''): Promise<boolean> {
  if (!token || req.method !== 'POST' || !req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) return false;
  const signature = req.headers.get('x-twilio-signature');
  const base = Deno.env.get('SUPABASE_URL');
  if (!signature || !base) return false;
  const params = new URLSearchParams(await req.clone().text());
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const entries = params.getAll(key);
    values[key] = entries.length === 1 ? entries[0] : entries;
  }
  // Do not trust caller-controlled Host or forwarded headers for signature URLs.
  const url = `${base.replace(/\/$/, '')}/functions/v1/${endpoint}${new URL(req.url).search}`;
  return twilio.validateRequest(token, signature, url, values);
}

export function verifyMailPayload(raw: string, headers: Headers, secret: string): unknown {
  if (!secret) throw new Error('Mail signature configuration unavailable');
  const signingSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  return new Webhook(signingSecret).verify(raw, {
    'webhook-id': headers.get('svix-id') ?? '',
    'webhook-timestamp': headers.get('svix-timestamp') ?? '',
    'webhook-signature': headers.get('svix-signature') ?? '',
  });
}

export function sameTicketSender(sender: string, customerEmail: unknown): boolean {
  return typeof customerEmail === 'string' && !!sender.trim()
    && sender.trim().toLowerCase() === customerEmail.trim().toLowerCase();
}