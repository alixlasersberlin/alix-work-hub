import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Erstellt aus einem AlixDocs-Dokument (nur PDF) einen ALIX SIGN PRO sig_request.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (s: number, b: unknown) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json(401, { error: 'unauthorized' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await asUser.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: 'unauthorized' });

    const { document_id, signer_email, signer_name, subject, message } = await req.json();
    if (!document_id || !signer_email) return json(400, { error: 'document_id + signer_email required' });

    const svc = createClient(url, service);
    const { data: doc, error: dErr } = await svc.from('alixdocs_documents').select('*').eq('id', document_id).single();
    if (dErr || !doc) return json(404, { error: 'document not found' });
    if (doc.mime_type !== 'application/pdf') return json(400, { error: 'nur PDF-Dokumente können signiert werden' });

    // Copy latest version into sig-documents bucket
    const { data: ver } = await svc.from('alixdocs_versions').select('storage_path').eq('document_id', document_id).eq('version_number', doc.current_version).single();
    if (!ver) return json(500, { error: 'version not found' });

    const { data: fileBlob, error: dlErr } = await svc.storage.from('alixdocs-private').download(ver.storage_path);
    if (dlErr) throw dlErr;

    const sigDocId = crypto.randomUUID();
    const sigPath = `bridge/${sigDocId}.pdf`;
    const { error: upErr } = await svc.storage.from('sig-documents').upload(sigPath, fileBlob, { contentType: 'application/pdf', upsert: false });
    if (upErr) throw upErr;

    // Create sig_documents row
    const { data: sigDoc, error: sdErr } = await svc.from('sig_documents').insert({
      id: sigDocId, title: doc.title, storage_path: sigPath, mime_type: 'application/pdf',
      file_size: (fileBlob as Blob).size, created_by: user.id, status: 'entwurf',
    }).select('id').single();
    if (sdErr) throw sdErr;

    // Create sig_request linked back to alixdocs_document
    const { data: sigReq, error: rErr } = await svc.from('sig_requests').insert({
      document_id: sigDoc.id, alixdocs_document_id: document_id,
      status: 'versendet', subject: subject ?? `Signatur: ${doc.title}`,
      message: message ?? null, created_by: user.id,
    }).select('id').single();
    if (rErr) throw rErr;

    await svc.from('sig_signers').insert({
      request_id: sigReq.id, email: signer_email, name: signer_name ?? null, order_index: 0, status: 'pending',
    });

    await svc.from('alixdocs_audit_log').insert({ document_id, user_id: user.id, action: 'sign_request_created', metadata: { sig_request_id: sigReq.id, signer_email } });

    return json(200, { ok: true, sig_request_id: sigReq.id, sig_document_id: sigDoc.id });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
