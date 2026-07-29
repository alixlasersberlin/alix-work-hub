// pain.008.001.02.ch.03 – Swiss LSV+/BDD Direct Debit export
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const xe = (s: string) => (s ?? '').replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]!));
const amt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const iban = (s: string) => (s ?? '').replace(/\s+/g, '').toUpperCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const { run_id } = await req.json();
    if (!run_id) throw new Error('run_id erforderlich');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: run } = await admin.from('finance_ch_dd_runs').select('*').eq('id', run_id).maybeSingle();
    if (!run) throw new Error('Lauf nicht gefunden');
    const { data: items } = await admin
      .from('finance_ch_dd_run_items')
      .select('*, mandate:mandate_id(*), customer:customer_id(company_name, contact_name)')
      .eq('run_id', run_id);
    if (!items?.length) throw new Error('Keine Positionen im Lauf');

    const total = items.reduce((s: number, it: any) => s + Number(it.amount), 0);
    const msgId = `MSG-${run.run_number}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const localInstrm = run.scheme === 'BDD' ? 'BDD' : 'LSV+';

    const txs = items.map((it: any) => {
      const name = it.customer?.company_name || it.customer?.contact_name || 'Debtor';
      const ete = it.end_to_end_id || `${run.run_number}-${it.id.slice(0, 8)}`;
      return `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${xe(ete)}</EndToEndId></PmtId>
        <InstdAmt Ccy="CHF">${amt(Number(it.amount))}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${xe(it.mandate.mandate_reference)}</MndtId>
            <DtOfSgntr>${it.mandate.signed_at}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        ${it.mandate.bic ? `<DbtrAgt><FinInstnId><BIC>${xe(it.mandate.bic)}</BIC></FinInstnId></DbtrAgt>` : `<DbtrAgt><FinInstnId><ClrSysMmbId><MmbId>NOTPROVIDED</MmbId></ClrSysMmbId></FinInstnId></DbtrAgt>`}
        <Dbtr><Nm>${xe(it.mandate.account_holder || name)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${iban(it.mandate.iban)}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${xe(it.remittance_info || it.reference || '')}</Ustrd></RmtInf>
      </DrctDbtTxInf>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="http://www.six-interbank-clearing.com/de/pain.008.001.02.ch.03.xsd">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${createdAt}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${amt(total)}</CtrlSum>
      <InitgPty><Nm>${xe(run.creditor_name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${run.run_number}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${amt(total)}</CtrlSum>
      <PmtTpInf>
        <LclInstrm><Prtry>${localInstrm}</Prtry></LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${run.collection_date}</ReqdColltnDt>
      <Cdtr><Nm>${xe(run.creditor_name)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${iban(run.creditor_iban)}</IBAN></Id></CdtrAcct>
      ${run.creditor_bic ? `<CdtrAgt><FinInstnId><BIC>${xe(run.creditor_bic)}</BIC></FinInstnId></CdtrAgt>` : `<CdtrAgt><FinInstnId><ClrSysMmbId><MmbId>NOTPROVIDED</MmbId></ClrSysMmbId></FinInstnId></CdtrAgt>`}
      <ChrgBr>SLEV</ChrgBr>
      ${txs}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

    await admin.from('finance_ch_dd_runs').update({
      status: 'exportiert', exported_at: new Date().toISOString(),
      total_amount: total, item_count: items.length,
    }).eq('id', run_id);
    await admin.from('finance_ch_dd_run_items').update({ status: 'exportiert' }).eq('run_id', run_id);

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${run.run_number}.xml"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
