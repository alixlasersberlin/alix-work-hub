// ALIX COLLECT – Digitale Akte als PDF rendern und im Storage archivieren
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderPdf, eur, de, san, type Block } from '../_shared/collect-pdf.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BUCKET = 'finance-documents';

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const PURPOSE_LABEL: Record<string, string> = {
  inkasso: 'Inkasso-Uebergabe',
  anwalt: 'Anwalt / Klage',
  insolvenz: 'Insolvenzanmeldung',
  intern: 'Interne Dokumentation',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
    const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);

    const { dossier_id } = await req.json().catch(() => ({}));
    if (!dossier_id) return json({ error: 'dossier_id erforderlich' }, 400);

    const { data: dossier } = await admin.from('collect_dossiers').select('*').eq('id', dossier_id).maybeSingle();
    if (!dossier) return json({ error: 'Akte nicht gefunden' }, 404);

    const c: any = dossier.content ?? {};
    const cur = c.case?.currency ?? 'EUR';
    const customer = c.case?.customer_name ?? 'Unbekannt';

    const blocks: Block[] = [
      { type: 'h1', text: `Digitale Akte - ${customer}` },
      {
        type: 'p',
        text: `Zweck: ${PURPOSE_LABEL[dossier.purpose] ?? dossier.purpose}\nErstellt am: ${de(dossier.created_at)}\nAkten-ID: ${dossier.id}`,
      },
      { type: 'h2', text: 'Zusammenfassung' },
      {
        type: 'p',
        text: [
          `Offener Betrag: ${eur(c.summary?.open_amount, cur)}`,
          `Davon ueberfaellig: ${eur(c.summary?.overdue_amount, cur)}`,
          `Maximaler Verzug: ${c.summary?.max_days_overdue ?? 0} Tage`,
          `Anzahl Rechnungen: ${c.summary?.invoice_count ?? 0}`,
          `Dokumentierte Kontakte: ${c.summary?.contact_count ?? 0}`,
        ].join('\n'),
      },
      { type: 'h2', text: 'Offene Rechnungen' },
      {
        type: 'table',
        head: ['Rechnung', 'Datum', 'Faellig', 'Verzug', 'Saldo'],
        widths: [110, 80, 80, 60, 165],
        rows: (c.invoices ?? []).map((i: any) => [
          i.invoice_number ?? '-',
          de(i.invoice_date),
          de(i.due_date),
          `${i.days_overdue ?? 0} T`,
          eur(i.balance, i.currency ?? cur),
        ]),
      },
    ];

    const contacts = [...(c.events ?? []), ...(c.calls ?? [])]
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 120);
    blocks.push({ type: 'h2', text: 'Kommunikationsverlauf' });
    blocks.push({
      type: 'table',
      head: ['Datum', 'Typ', 'Kanal', 'Inhalt'],
      widths: [80, 100, 60, 255],
      rows: contacts.map((e: any) => [
        de(e.created_at),
        e.event_type ?? e.outcome ?? 'Kontakt',
        e.channel ?? (e.phone ? 'Telefon' : '-'),
        String(e.subject ?? e.note ?? e.body ?? '').slice(0, 90),
      ]),
    });

    if ((c.promises ?? []).length) {
      blocks.push({ type: 'h2', text: 'Zahlungszusagen' });
      blocks.push({
        type: 'table',
        head: ['Zugesagt am', 'Faellig', 'Betrag', 'Status'],
        widths: [110, 110, 130, 145],
        rows: (c.promises ?? []).map((p: any) => [
          de(p.created_at), de(p.promised_date), eur(p.amount, cur), p.status ?? '-',
        ]),
      });
    }

    if ((c.payment_plans ?? []).length) {
      blocks.push({ type: 'h2', text: 'Ratenvereinbarungen' });
      blocks.push({
        type: 'table',
        head: ['Erstellt', 'Gesamt', 'Raten', 'Status'],
        widths: [110, 130, 110, 145],
        rows: (c.payment_plans ?? []).map((p: any) => [
          de(p.created_at), eur(p.total_amount ?? p.amount, cur), String(p.installments ?? '-'), p.status ?? '-',
        ]),
      });
    }

    blocks.push({ type: 'spacer', size: 16 });
    blocks.push({
      type: 'p',
      text: san(
        'Diese Akte wurde automatisch aus dem Forderungsmanagement der Alix Lasers erzeugt und dokumentiert '
        + 'den vollstaendigen Vorgang inklusive Mahnhistorie und Kundenkommunikation.',
      ),
    });

    const bytes = await renderPdf({
      title: `Digitale Akte - ${PURPOSE_LABEL[dossier.purpose] ?? dossier.purpose}`,
      subtitle: `${customer} | Stand ${de(new Date().toISOString())}`,
      blocks,
    });

    const path = `collect/dossiers/${dossier.id}.pdf`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    await admin.from('collect_dossiers').update({ file_url: path }).eq('id', dossier.id);

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);

    return json({ success: true, path, url: signed?.signedUrl ?? null });
  } catch (e: any) {
    console.error('collect-dossier-pdf error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
