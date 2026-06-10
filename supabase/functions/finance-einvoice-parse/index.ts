// Parses an inbound XRechnung / ZUGFeRD CII XML and returns extracted fields
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const pick = (xml: string, tag: string): string | null => {
  // tag may have namespace: try ram:Name or Name
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
};
const pickAll = (xml: string, tag: string): string[] => {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, 'gi');
  return [...xml.matchAll(re)].map(m => m[1].trim());
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { xml } = await req.json();
    if (!xml || typeof xml !== 'string') {
      return new Response(JSON.stringify({ error: 'xml required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const isCII = /CrossIndustryInvoice|urn:cen.eu:en16931/i.test(xml);
    const isUBL = /<(?:[a-z]+:)?Invoice[\s>]/i.test(xml) && /urn:oasis:names:specification:ubl/i.test(xml);

    let format = 'unbekannt';
    if (isCII) format = 'CII (XRechnung/ZUGFeRD)';
    else if (isUBL) format = 'UBL';

    const invoiceNumber = pick(xml, 'ID') ?? pick(xml, 'cbc:ID');
    const issueDate = (pick(xml, 'DateTimeString') ?? pick(xml, 'IssueDate'))?.replace(/^(\d{4})(\d{2})(\d{2}).*$/, '$1-$2-$3') ?? null;
    const dueDate = pickAll(xml, 'DateTimeString')[1]?.replace(/^(\d{4})(\d{2})(\d{2}).*$/, '$1-$2-$3') ?? pick(xml, 'DueDate') ?? null;
    const grand = pick(xml, 'GrandTotalAmount') ?? pick(xml, 'PayableAmount');
    const taxTotal = pick(xml, 'TaxTotalAmount') ?? pick(xml, 'TaxAmount');
    const netTotal = pick(xml, 'LineTotalAmount') ?? pick(xml, 'LineExtensionAmount');
    const currency = (xml.match(/InvoiceCurrencyCode>([A-Z]{3})/i)?.[1]) ?? 'EUR';

    // Seller & buyer name (first occurrences)
    const names = pickAll(xml, 'Name');
    const seller = names[0] ?? null;
    const buyer = names[1] ?? null;

    const vatIds = pickAll(xml, 'ID').filter(v => /^[A-Z]{2}\d/.test(v));
    const sellerVat = vatIds[0] ?? null;

    const taxRate = pick(xml, 'RateApplicablePercent');

    return new Response(JSON.stringify({
      format,
      invoice_number: invoiceNumber,
      invoice_date: issueDate,
      due_date: dueDate,
      currency,
      amount_gross: grand ? Number(grand) : null,
      amount_net: netTotal ? Number(netTotal) : null,
      amount_tax: taxTotal ? Number(taxTotal) : null,
      tax_rate: taxRate ? Number(taxRate) : null,
      supplier_name: seller,
      supplier_vat_id: sellerVat,
      buyer_name: buyer,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
