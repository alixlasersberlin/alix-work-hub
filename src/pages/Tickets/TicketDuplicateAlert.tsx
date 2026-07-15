import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, GitMerge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RmModal } from '@/components/esc/resources/RmModal';

interface DuplicateHit {
  duplicate_of_id: string;
  duplicate_of_number: string | null;
  duplicate_of_created_at: string;
}

interface Props {
  ticketId: string;
  customerEmail: string | null;
  onMerged?: () => void;
}

export function TicketDuplicateAlert({ ticketId, customerEmail, onMerged }: Props) {
  const [dups, setDups] = useState<DuplicateHit[]>([]);
  const [open, setOpen] = useState(false);
  const [mergeInto, setMergeInto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ticketId || !customerEmail) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('ticket_potential_duplicates')
        .select('duplicate_of_id, duplicate_of_number, duplicate_of_created_at')
        .eq('ticket_id', ticketId)
        .limit(5);
      setDups((data ?? []) as DuplicateHit[]);
    })();
  }, [ticketId, customerEmail]);

  if (!dups.length) return null;

  const doMerge = async () => {
    if (!mergeInto) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('ticket_merge', {
      _source_id: ticketId,
      _target_id: mergeInto,
    });
    setBusy(false);
    if (error) return toast.error('Zusammenführen fehlgeschlagen: ' + error.message);
    toast.success('Tickets zusammengeführt');
    setOpen(false);
    onMerged?.();
  };

  return (
    <>
      <Alert className="border-amber-500/40 bg-amber-500/10">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <AlertDescription className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Möglicher Duplikat: Vom selben Kunden gibt es {dups.length === 1 ? 'ein weiteres offenes Ticket' : `${dups.length} weitere offene Tickets`} aus den letzten 48 Stunden
            {dups[0]?.duplicate_of_number ? <> (z.B. <strong>{dups[0].duplicate_of_number}</strong>)</> : null}.
          </span>
          <Button size="sm" variant="outline" onClick={() => { setMergeInto(dups[0].duplicate_of_id); setOpen(true); }}>
            <GitMerge className="w-3.5 h-3.5 mr-1" /> Zusammenführen
          </Button>
        </AlertDescription>
      </Alert>

      <RmModal
        open={open}
        onClose={() => setOpen(false)}
        title="Ticket zusammenführen"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button disabled={!mergeInto || busy} onClick={doMerge}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Zusammenführen
            </Button>
          </>
        }
      >
        <p>Wähle das Haupt-Ticket. Nachrichten und Anhänge aus <em>diesem</em> Ticket werden dorthin verschoben. Dieses Ticket wird geschlossen und als Duplikat markiert.</p>
        <div className="space-y-2">
          {dups.map(d => (
            <label key={d.duplicate_of_id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
              <input type="radio" name="merge" checked={mergeInto === d.duplicate_of_id} onChange={() => setMergeInto(d.duplicate_of_id)} />
              <span className="font-mono text-xs">{d.duplicate_of_number ?? d.duplicate_of_id.slice(0,8)}</span>
              <span className="text-muted-foreground text-xs">{new Date(d.duplicate_of_created_at).toLocaleString('de-DE')}</span>
            </label>
          ))}
        </div>
      </RmModal>
    </>
  );
}
