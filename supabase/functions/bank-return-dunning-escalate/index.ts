import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEFAULT_EMAIL: Record<string, string> = {
  subject: 'Rücklastschrift – offene Forderung zu Rechnung {{rechnung}} und angekündigte Leistungssperre',
  headline: 'Zahlungsaufforderung nach Rücklastschrift',
  intro: 'die von uns eingezogene Lastschrift wurde am {{datum}} von Ihrem Kreditinstitut zurückgegeben – Grund: {{grund}} ({{code}}). Die betroffene Forderung ist damit wieder offen.',
  warnTitle: 'Wichtiger Hinweis: bevorstehende Sperre der Leistungen',
  warnBody: 'Sollte der Gesamtbetrag von {{gesamt}} nicht bis zum {{zahlbar_bis}} vollständig auf unserem Konto eingegangen sein, sind wir gezwungen, sämtliche Leistungen von Alix Lasers mit Wirkung zum {{sperrdatum}} vorübergehend zu sperren.',
  warnBody2: 'Dies betrifft insbesondere die Freischaltung und den Betrieb Ihres Gerätes, Service- und Wartungsleistungen, Support, Schulungen sowie ausstehende Lieferungen.',
  closing: 'Sollte die Rücklastschrift auf einem Irrtum Ihres Kreditinstituts beruhen oder haben Sie den Betrag bereits ausgeglichen, setzen Sie sich bitte kurzfristig mit uns in Verbindung.',
  senderName: 'Alix Lasers – Buchhaltung',
};

const SETTINGS_KEY = 'bank_return_dunning_escalation';

interface EscalationConfig {
  enabled: boolean;
  /** Tage nach Buchung der Rücklastschrift bis Mahnstufe 1 */
  level1AfterDays: number;
  /** Tage zwischen Stufe 1 und 2 */
  level2AfterDays: number;
  /** Tage zwischen Stufe 2 und 3 */
  level3AfterDays: number;
  /** Zahlungsfrist im Schreiben */
  payDays: number;
  /** Höchste automatische Mahnstufe */
  maxLevel: number;
}

const DEFAULTS: EscalationConfig = {
  enabled: false,
  level1AfterDays: 0,
  level2AfterDays: 7,
  level3AfterDays: 7,
  payDays: 7,
  maxLevel: 3,
};

const deDate = (d: Date) => d.toLocaleDateString('de-DE');
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const today = new Date();
  const result = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  try {
    const { data: setting } = await supabase
      .from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
    const cfg: EscalationConfig = { ...DEFAULTS, ...((setting?.value as any) ?? {}) };

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = !!body?.dryRun;
      if (body?.force) cfg.enabled = true;
    } catch { /* cron sendet evtl. keinen Body */ }

    if (!cfg.enabled) {
      return new Response(JSON.stringify({ ...result, disabled: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rds, error } = await supabase
      .from('bank_return_debits')
      .select('*')
      .in('status', ['bestaetigt', 'mahnprozess'])
      .eq('dunning_paused', false)
      .lt('dunning_level', cfg.maxLevel)
      .limit(500);
    if (error) throw error;

    const gap = [cfg.level1AfterDays, cfg.level2AfterDays, cfg.level3AfterDays];

    for (const rd of rds ?? []) {
      result.processed++;
      const level = Number(rd.dunning_level || 0);
      const base = rd.next_dunning_due
        ? new Date(rd.next_dunning_due)
        : (() => {
            const d = new Date(rd.booking_date ?? rd.created_at);
            d.setDate(d.getDate() + (gap[0] ?? 0));
            return d;
          })();
      if (base > today) { result.skipped++; continue; }

      // Empfänger + Beträge ermitteln
      let recipient: string | null = null;
      let customerName = '';
      if (rd.customer_id) {
        const { data: c } = await supabase.from('customers')
          .select('company_name, contact_name, email').eq('id', rd.customer_id).maybeSingle();
        recipient = (c as any)?.email ?? null;
        customerName = (c as any)?.company_name || (c as any)?.contact_name || '';
      }
      if (!recipient) {
        result.skipped++;
        result.errors.push(`${rd.id}: keine E-Mail-Adresse`);
        continue;
      }

      const { data: allocs } = await supabase
        .from('bank_return_debit_allocations')
        .select('invoice_number, allocated_amount').eq('return_debit_id', rd.id);

      let bank: any = null;
      if (rd.bank_account_id) {
        const { data } = await supabase.from('bank_accounts')
          .select('iban, bic, bank_name').eq('id', rd.bank_account_id).maybeSingle();
        bank = data;
      }

      const nextLevel = level + 1;
      const amount = Number(rd.return_debit_amount || 0);
      const fee = Number(rd.customer_fee || 0);
      const due = new Date(); due.setDate(due.getDate() + cfg.payDays);
      const block = new Date(due); block.setDate(block.getDate() + 1);

      if (dryRun) { result.sent++; continue; }

      const { data: emailRow } = await supabase.from('app_settings')
        .select('value').eq('key', 'bank_return_dunning_email').maybeSingle();
      const emailCfg: Record<string, string> = { ...DEFAULT_EMAIL, ...((emailRow?.value as any) ?? {}) };
      const money = (n: number) =>
        Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: rd.currency || 'EUR' });
      const vars: Record<string, string> = {
        kunde: customerName || '',
        rechnung: (allocs ?? []).map((a: any) => a.invoice_number).filter(Boolean).join(', ') || rd.invoice_number || '–',
        betrag: money(amount),
        gebuehr: money(fee),
        gesamt: money(amount + fee),
        datum: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : '–',
        grund: rd.return_reason || '–',
        code: rd.return_code || '–',
        zahlbar_bis: deDate(due),
        sperrdatum: deDate(block),
        iban: bank?.iban || '–',
        bic: bank?.bic || '–',
        bank: bank?.bank_name || '–',
        absender: emailCfg.senderName,
        heute: new Date().toLocaleDateString('de-DE'),
        stufe: String(nextLevel),
      };
      const fill = (t: string) =>
        (t ?? '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m: string, k: string) => vars[String(k).toLowerCase()] ?? '');
      const texts = {
        subjectOverride: fill(emailCfg.subject),
        headline: fill(emailCfg.headline),
        intro: fill(emailCfg.intro),
        warnTitle: fill(emailCfg.warnTitle),
        warnBody: fill(emailCfg.warnBody),
        warnBody2: fill(emailCfg.warnBody2),
        closing: fill(emailCfg.closing),
        senderName: fill(emailCfg.senderName),
      };

      const { error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'ruecklastschrift-mahnung',
          recipientEmail: recipient,
          idempotencyKey: `ruecklastschrift-mahnung-${rd.id}-stufe${nextLevel}`,
          templateData: {
            customerName,
            dunningLevel: nextLevel,
            returnDate: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : null,
            returnReason: rd.return_reason ?? null,
            returnCode: rd.return_code ?? null,
            amount,
            fee,
            total: amount + fee,
            currency: rd.currency || 'EUR',
            payUntil: deDate(due),
            blockDate: deDate(block),
            mandateBlocked: !!rd.sepa_mandate_blocked,
            items: (allocs ?? []).map((a: any) => ({
              invoice_number: a.invoice_number ?? null,
              amount: Number(a.allocated_amount || 0),
              due_date: null,
            })),
            iban: bank?.iban ?? null,
            bic: bank?.bic ?? null,
            bankName: bank?.bank_name ?? null,
            ...texts,
          },
        },
      });
      if (mailErr) { result.errors.push(`${rd.id}: ${mailErr.message}`); continue; }

      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + (gap[nextLevel] ?? cfg.level3AfterDays));

      await supabase.from('bank_return_debits').update({
        status: 'mahnprozess',
        reminder_process_started: true,
        dunning_level: nextLevel,
        last_dunning_at: new Date().toISOString(),
        next_dunning_due: nextLevel >= cfg.maxLevel ? null : iso(nextDue),
        note: [rd.note, `Automatische Mahnstufe ${nextLevel} an ${recipient} versendet (zahlbar bis ${deDate(due)}, Sperre ab ${deDate(block)}).`]
          .filter(Boolean).join('\n'),
      }).eq('id', rd.id);

      await supabase.from('bank_audit_log').insert({
        action: 'ruecklastschrift_mahnung_automatisch',
        bank_transaction_id: rd.bank_transaction_id ?? null,
        new_value: { level: nextLevel, recipient, payUntil: iso(due) },
      });

      result.sent++;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('bank-return-dunning-escalate failed:', e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
