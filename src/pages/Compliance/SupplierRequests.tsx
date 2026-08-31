import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logCompliance, useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

interface Request {
  id: string; project_id: string; request_code: string; topic: string; requirement: string | null;
  supplier_user_id: string | null; status: string; answer: string | null; file_url: string | null;
  na_requested: boolean; na_reason: string | null;
}

export default function ComplianceSupplierRequests() {
  const { user } = useAuth();
  const c = useComplianceProfile();
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('compliance_supplier_requests').select('*').order('request_code', { ascending: true });
    setRows((data as Request[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = useMemo(() => rows.filter((r) => r.status !== 'answered'), [rows]);
  const answered = rows.length - open.length;
  const current = open[Math.min(idx, Math.max(open.length - 1, 0))] || null;

  useEffect(() => {
    setAnswer(current?.answer || '');
    setFileUrl(current?.file_url || '');
  }, [current?.id]);

  const save = async (submit: boolean) => {
    if (!current) return;
    if (submit && !answer.trim() && !fileUrl.trim()) { toast.error('Bitte Antwort oder Datei angeben.'); return; }
    await (supabase as any).from('compliance_supplier_requests').update({
      answer, file_url: fileUrl || null,
      status: submit ? 'answered' : 'in_progress',
      answered_at: submit ? new Date().toISOString() : null,
    }).eq('id', current.id);
    await logCompliance(submit ? 'supplier_request_submitted' : 'supplier_request_saved',
      { code: current.request_code }, { projectId: current.project_id });
    toast.success(submit ? 'Antwort eingereicht' : 'Gespeichert');
    load();
  };

  const requestNa = async () => {
    if (!current) return;
    await (supabase as any).from('compliance_supplier_requests').update({
      na_requested: true, na_reason: answer || null, status: 'na_requested',
    }).eq('id', current.id);
    toast.success('„Nicht anwendbar“ beantragt');
    load();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <div className="text-[11px] tracking-[0.3em] text-muted-foreground">ALIXWORK</div>
        <h1 className="text-xl font-semibold">Technical Information Request</h1>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Fortschritt</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Progress value={rows.length ? (answered / rows.length) * 100 : 0} className="h-2" />
          <div className="text-[12px] text-muted-foreground">{answered} / {rows.length} Anforderungen beantwortet</div>
        </CardContent>
      </Card>

      {loading && <div className="text-sm text-muted-foreground">Lädt…</div>}
      {!loading && !current && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Keine offenen Anforderungen.</CardContent></Card>
      )}

      {current && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{current.request_code}</Badge>
              <CardTitle className="text-[15px]">{current.topic}</CardTitle>
            </div>
            {current.requirement && <div className="text-[12px] text-muted-foreground whitespace-pre-wrap">{current.requirement}</div>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Antwort</Label>
              <Textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} />
              <AiAssistField
                value={answer}
                onChange={setAnswer}
                hint={`Lieferantenanfrage ${current.request_code}: ${current.topic}. Anforderung: ${current.requirement ?? '—'}`}
              />
            </div>
            <div>
              <Label>Datei-Link</Label>
              <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save(false)}>ANTWORT SPEICHERN</Button>
              <Button variant="outline" onClick={requestNa}>NICHT ANWENDBAR BEANTRAGEN</Button>
              <Button onClick={() => save(true)}>EINREICHEN</Button>
              <Button variant="ghost" disabled={idx >= open.length - 1} onClick={() => setIdx((i) => i + 1)}>NÄCHSTE AUFGABE</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!c.isSupplier && rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alle Anfragen</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[12px]">
                <span>{r.request_code} · {r.topic}</span>
                <Badge variant="outline">{r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
