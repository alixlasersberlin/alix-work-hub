import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DiffMatchPatch from 'diff-match-patch';
import { History } from 'lucide-react';

export function VersionDiff({ documentId, versions }: { documentId: string; versions: any[] }) {
  const sorted = useMemo(() => [...versions].sort((a, b) => a.version - b.version), [versions]);
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (sorted.length >= 2 && !a && !b) {
      setA(String(sorted[sorted.length - 2].version));
      setB(String(sorted[sorted.length - 1].version));
    }
  }, [sorted, a, b]);

  useEffect(() => {
    (async () => {
      if (!a || !b) return;
      // Use note field as diff proxy if versions don't carry text; fall back to current ocr_text for latest
      const { data: doc } = await supabase.from('alixdocs2_documents').select('ocr_text').eq('id', documentId).maybeSingle();
      const tA = sorted.find(v => String(v.version) === a)?.note ?? '';
      const tB = sorted.find(v => String(v.version) === b)?.note ?? doc?.ocr_text ?? '';
      setTextA(tA);
      setTextB(tB);
      const dmp = new DiffMatchPatch();
      const diffs = dmp.diff_main(tA, tB);
      dmp.diff_cleanupSemantic(diffs);
      setHtml(dmp.diff_prettyHtml(diffs));
    })();
  }, [a, b, documentId, sorted]);

  if (sorted.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Versions-Diff</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground">Mindestens zwei Versionen erforderlich.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Versions-Diff</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-center text-xs">
          <span>Von</span>
          <Select value={a} onValueChange={setA}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{sorted.map(v => <SelectItem key={v.id} value={String(v.version)}>v{v.version}</SelectItem>)}</SelectContent>
          </Select>
          <span>Zu</span>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{sorted.map(v => <SelectItem key={v.id} value={String(v.version)}>v{v.version}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div
          className="text-sm max-h-96 overflow-auto p-3 border rounded bg-muted/30 whitespace-pre-wrap [&_ins]:bg-green-500/20 [&_ins]:no-underline [&_del]:bg-red-500/20 [&_del]:line-through"
          dangerouslySetInnerHTML={{ __html: html || '<span class="text-muted-foreground text-xs">Kein Unterschied.</span>' }}
        />
      </CardContent>
    </Card>
  );
}
