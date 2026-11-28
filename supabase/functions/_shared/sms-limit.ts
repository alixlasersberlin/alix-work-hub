import { smsPhone } from './sms-policy.ts';

type LimiterClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
export async function reserveSmsSend(client: LimiterClient, userId: string, destination: string): Promise<Response | null> {
  const failure = () => new Response(JSON.stringify({error:'SMS-Versandbegrenzung nicht verfügbar; es wurde keine SMS gesendet.'}), {status:503,headers:{'Content-Type':'application/json'}});
  const phone = smsPhone(destination);
  if (!phone) return failure();
  try {
    const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(phone));
    const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
    const {data,error} = await client.rpc('sms_reserve_send',{p_user_id:userId,p_recipient_hash:hash});
    if (error || !data || typeof data !== 'object') return failure();
    const result = data as Record<string,unknown>;
    if (result.allowed === true) return null;
    if (result.allowed !== false || typeof result.retry_after_seconds !== 'number' || !Number.isInteger(result.retry_after_seconds) || result.retry_after_seconds < 1 || result.retry_after_seconds > 86400 || !['user','recipient'].includes(String(result.scope))) return failure();
    return new Response(JSON.stringify({error:result.scope === 'user' ? 'SMS-Versandlimit für diesen Mitarbeiter erreicht.' : 'SMS-Versandlimit für diese Empfängernummer erreicht.',retry_after_seconds:result.retry_after_seconds}), {status:429,headers:{'Content-Type':'application/json','Retry-After':String(result.retry_after_seconds)}});
  } catch { return failure(); }
}

export function smsLimitWithCors(response: Response, cors: Record<string,string>): Response {
  const headers = new Headers(response.headers);
  for (const [name,value] of Object.entries(cors)) headers.set(name,value);
  headers.set('Access-Control-Expose-Headers','Retry-After');
  return new Response(response.body,{status:response.status,headers});
}