import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Key, BookOpen, Zap } from 'lucide-react';
import { toast } from 'sonner';

const BASE = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/sig-partner-api`;

const CURL_CREATE = `curl -X POST '${BASE}/requests' \\
  -H 'x-api-key: <DEIN_API_KEY>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Kaufvertrag Muster",
    "signer_email": "kunde@example.com",
    "signer_name": "Max Mustermann",
    "document_url": "https://…/vertrag.pdf",
    "document_type": "contract"
  }'`;

const CURL_STATUS = `curl '${BASE}/requests/<REQUEST_ID>' \\
  -H 'x-api-key: <DEIN_API_KEY>'`;

type Partner = { id: string; name: string; status: string; monthly_quota: number; used_quota: number };

export default function SignApiDocs() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sig_partners')
        .select('id, name, status, monthly_quota, used_quota')
        .order('created_at', { ascending: false }).limit(50);
      setPartners((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success('Kopiert'); };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6" />
        <h1 className="text-2xl font-bold">ALIX SIGN PRO – Partner-API</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Endpunkt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">{BASE}</code>
            <Button size="sm" variant="outline" onClick={() => copy(BASE)}><Copy className="h-3 w-3" /></Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Authentifizierung über Header <code className="bg-muted px-1">x-api-key</code>. Kontingent pro Partner wird monatlich abgerechnet.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>POST /requests – Signatur-Anfrage erstellen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre">{CURL_CREATE}</pre>
          <Button size="sm" variant="outline" onClick={() => copy(CURL_CREATE)}><Copy className="h-3 w-3 mr-1" /> cURL kopieren</Button>
          <p className="text-sm text-muted-foreground">
            Antwort: <code className="bg-muted px-1">{`{ ok, request_id, sign_url }`}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>GET /requests/&lt;id&gt; – Status abfragen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre">{CURL_STATUS}</pre>
          <Button size="sm" variant="outline" onClick={() => copy(CURL_STATUS)}><Copy className="h-3 w-3 mr-1" /> cURL kopieren</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-4 w-4" /> Aktive Partner-Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : partners.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Noch keine Partner. Lege welche unter <code>/admin/sign-marketplace</code> an.
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Nutzung</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {partners.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{p.used_quota} / {p.monthly_quota}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rate Limits & Fehlercodes</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><code className="bg-muted px-1">401 invalid_api_key</code> – Header fehlt oder ungültig</div>
          <div><code className="bg-muted px-1">429 quota_exceeded</code> – Monatskontingent aufgebraucht</div>
          <div><code className="bg-muted px-1">400</code> – Pflichtfelder <code>title</code>, <code>signer_email</code> fehlen</div>
          <div><code className="bg-muted px-1">404 not_found</code> – Request-ID nicht gefunden</div>
        </CardContent>
      </Card>
    </div>
  );
}
