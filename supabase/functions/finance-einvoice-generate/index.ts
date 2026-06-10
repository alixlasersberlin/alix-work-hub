// Generates an XRechnung (UN/CEFACT CII) XML from an invoice payload
// Optional: archives the XML in finance-documents storage + finance_documents table
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const xmlEscape = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const fmt2 = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
const dateBasic = (d: string) => d.replace(/-/g, '').slice(0, 8); // YYYYMMDD

interface LineItem { name: string; quantity: number; unit_price: number; tax_percent?: number; unit?: string; }
interface InvoicePayload {
  invoice_number: string;
  invoice_date: string;          // YYYY-MM-DD
  due_date?: string;
  currency?: string;
  seller: { name: string; vat_id?: string; tax_number?: string; iban?: string; bic?: string; address: { street: string; city: string; postal: string; country: string; }; email?: string; phone?: string; };
  buyer:  { name: string; vat_id?: string; reference?: string; address: { street: string; city: string; postal: string; country: string; }; email?: string; };
  items: LineItem[];
  payment_terms?: string;
  note?: string;
  tenant_id?: string;
  customer_id?: string;
  archive?: boolean;             // store result in finance-documents + finance_documents
}

function buildCII(p: InvoicePayload): { xml: string; totals: { net: number; tax: number; gross: number; }; } {
  const cur = p.currency ?? 'EUR';
  // Group by tax_percent
  const groups = new Map<number, { net: number; tax: number; }>();
  let net = 0;
  for (const it of p.items) {
    const lineNet = it.quantity * it.unit_price;
    const rate = it.tax_percent ?? 19;
    const g = groups.get(rate) ?? { net: 0, tax: 0 };
    g.net += lineNet;
    g.tax += lineNet * (rate / 100);
    groups.set(rate, g);
    net += lineNet;
  }
  let tax = 0;
  for (const g of groups.values()) tax += g.tax;
  const gross = net + tax;

  const itemsXml = p.items.map((it, i) => {
    const lineNet = it.quantity * it.unit_price;
    const rate = it.tax_percent ?? 19;
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${xmlEscape(it.name)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${fmt2(it.unit_price)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${xmlEscape(it.unit ?? 'C62')}">${it.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt2(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmt2(lineNet)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  const taxGroupsXml = [...groups.entries()].map(([rate, g]) => `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${fmt2(g.tax)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount>${fmt2(g.net)}</ram:BasisAmount>
      <ram:CategoryCode>S</ram:CategoryCode>
      <ram:RateApplicablePercent>${fmt2(rate)}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(p.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${dateBasic(p.invoice_date)}</udt:DateTimeString></ram:IssueDateTime>
    ${p.note ? `<ram:IncludedNote><ram:Content>${xmlEscape(p.note)}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${itemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      ${p.buyer.reference ? `<ram:BuyerReference>${xmlEscape(p.buyer.reference)}</ram:BuyerReference>` : '<ram:BuyerReference>N/A</ram:BuyerReference>'}
      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(p.seller.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${xmlEscape(p.seller.address.postal)}</ram:PostcodeCode>
          <ram:LineOne>${xmlEscape(p.seller.address.street)}</ram:LineOne>
          <ram:CityName>${xmlEscape(p.seller.address.city)}</ram:CityName>
          <ram:CountryID>${xmlEscape(p.seller.address.country)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${p.seller.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xmlEscape(p.seller.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(p.buyer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${xmlEscape(p.buyer.address.postal)}</ram:PostcodeCode>
          <ram:LineOne>${xmlEscape(p.buyer.address.street)}</ram:LineOne>
          <ram:CityName>${xmlEscape(p.buyer.address.city)}</ram:CityName>
          <ram:CountryID>${xmlEscape(p.buyer.address.country)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${p.buyer.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xmlEscape(p.buyer.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${cur}</ram:InvoiceCurrencyCode>
      ${p.seller.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xmlEscape(p.seller.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
        ${p.seller.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${xmlEscape(p.seller.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      ${taxGroupsXml}
      ${p.payment_terms ? `<ram:SpecifiedTradePaymentTerms><ram:Description>${xmlEscape(p.payment_terms)}</ram:Description>${p.due_date ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${dateBasic(p.due_date)}</udt:DateTimeString></ram:DueDateDateTime>` : ''}</ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt2(net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt2(net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${cur}">${fmt2(tax)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt2(gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt2(gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return { xml, totals: { net, tax, gross } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = (await req.json()) as InvoicePayload;
    if (!payload?.invoice_number || !payload?.invoice_date || !Array.isArray(payload?.items) || payload.items.length === 0) {
      return new Response(JSON.stringify({ error: 'invoice_number, invoice_date, items[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { xml, totals } = buildCII(payload);

    let archived: { path?: string; document_id?: string } | undefined;
    if (payload.archive) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const filename = `xrechnung/${payload.invoice_number.replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.xml`;
      const bytes = new TextEncoder().encode(xml);
      const up = await supabase.storage.from('finance-documents').upload(filename, bytes, { contentType: 'application/xml', upsert: false });
      if (up.error) throw up.error;
      // hash
      const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      const ins = await supabase.from('finance_documents').insert({
        document_type: 'XRechnung',
        tenant_id: payload.tenant_id ?? null,
        customer_id: payload.customer_id ?? null,
        reference: payload.invoice_number,
        document_date: payload.invoice_date,
        amount: totals.gross,
        currency: payload.currency ?? 'EUR',
        file_path: filename,
        file_name: filename.split('/').pop()!,
        file_size: bytes.byteLength,
        mime_type: 'application/xml',
        hash_sha256: hash,
        meta: { format: 'XRechnung 2.3 (CII)', totals },
      }).select('id').single();
      archived = { path: filename, document_id: ins.data?.id };
    }

    return new Response(JSON.stringify({ xml, totals, archived }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('einvoice-generate error', e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
