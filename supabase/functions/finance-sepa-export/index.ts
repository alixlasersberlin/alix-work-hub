import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { financeRoles, financeRegionAllowed, tenantObjectAllowed } from '../_shared/process-access.ts';

const xmlEscape = (s: string) => (s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
const fmtAmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const normIban = (s: string) => (s ?? '').replace(/\s+/g, '').toUpperCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders, financeRoles);
  if ('response' in access) return access.response;

  try {
    const body = await req.json();
    const runId: string = body.run_id;
    if (typeof runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(runId)) return new Response(JSON.stringify({ error: 'run_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = access.caller;
    const { data: run, error: runErr } = await admin.from('finance_sepa_runs').select('*').eq('id', runId).maybeSingle();
    if (runErr || !run) throw new Error(runErr?.message ?? 'run not found');
    const tenantIds = access.tenants.map((t: any) => t.id);
    if (!tenantObjectAllowed(tenantIds, run.tenant_id) || !financeRegionAllowed(access.roles, run.accounting_region ?? 'EU')) return new Response('Run scope denied', { status: 403, headers: corsHeaders });

    const { data: items, error: itemsErr } = await admin
      .from('finance_sepa_run_items')
      .select('*, mandate:mandate_id(*), customer:customer_id(company_name, contact_name)')
      .eq('run_id', runId);
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) throw new Error('Keine Positionen im Lauf');
    if (items.some((it: any) => it.tenant_id !== run.tenant_id || !it.mandate || it.mandate.tenant_id !== run.tenant_id)) return new Response('Run item ownership unconfirmed', { status: 403, headers: corsHeaders });

    const scheme = (items[0] as any).mandate?.scheme ?? 'CORE';
    const seqType = (items[0] as any).mandate?.sequence_type ?? 'RCUR';
    const msgId = `MSG-${run.run_number}-${Date.now()}`;
    const pmtInfId = `PMT-${run.run_number}`;
    const createdAt = new Date().toISOString();
    const totalAmt = items.reduce((s: number, it: any) => s + Number(it.amount), 0);

    const txs = items.map((it: any) => {
      const name = it.customer?.company_name || it.customer?.contact_name || 'Kunde';
      const eteId = it.end_to_end_id || `${run.run_number}-${it.id.slice(0, 8)}`;
      return `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${xmlEscape(eteId)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${fmtAmt(Number(it.amount))}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${xmlEscape(it.mandate.mandate_reference)}</MndtId>
            <DtOfSgntr>${it.mandate.signed_at}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        ${it.mandate.bic ? `<DbtrAgt><FinInstnId><BIC>${xmlEscape(it.mandate.bic)}</BIC></FinInstnId></DbtrAgt>` : `<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>`}
        <Dbtr><Nm>${xmlEscape(it.mandate.account_holder || name)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${normIban(it.mandate.iban)}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${xmlEscape(it.remittance_info || it.reference || '')}</Ustrd></RmtInf>
      </DrctDbtTxInf>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${createdAt}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${fmtAmt(totalAmt)}</CtrlSum>
      <InitgPty><Nm>${xmlEscape(run.creditor_name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${fmtAmt(totalAmt)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>${scheme}</Cd></LclInstrm>
        <SeqTp>${seqType}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${run.collection_date}</ReqdColltnDt>
      <Cdtr><Nm>${xmlEscape(run.creditor_name)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${normIban(run.creditor_iban)}</IBAN></Id></CdtrAcct>
      ${run.creditor_bic ? `<CdtrAgt><FinInstnId><BIC>${xmlEscape(run.creditor_bic)}</BIC></FinInstnId></CdtrAgt>` : `<CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>`}
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id><PrvtId><Othr><Id>${xmlEscape(run.creditor_id)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id>
      </CdtrSchmeId>
      ${txs}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

    // mark run + items as exported, total/count
    await admin.from('finance_sepa_runs').update({
      status: 'exportiert',
      exported_at: new Date().toISOString(),
      total_amount: totalAmt,
      item_count: items.length,
    }).eq('id', runId);
    await admin.from('finance_sepa_run_items').update({ status: 'exportiert' }).eq('run_id', runId);

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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
