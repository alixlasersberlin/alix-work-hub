import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { changeInvoiceDueDates, parseDueDate, type DueDateInvoice } from '@/lib/finance/invoice-due-date';

export function InvoiceDueDateDialog({ invoice, invoices, onClose, onSaved }: {
  invoice?: DueDateInvoice | null;
  invoices?: DueDateInvoice[];
  onClose: () => void;
  onSaved: (ids: string[]) => Promise<void>;
}) {
  const [dateText, setDateText] = useState('');
  const [note, setNote] = useState('');
  const date = parseDueDate(dateText);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof changeInvoiceDueDates>> | null>(null);
  const targets = invoices ?? (invoice ? [invoice] : []);
  useEffect(() => {
    const initial = invoices?.length === 1 ? invoices[0] : invoice;
    setDateText(initial?.due_date ? format(new Date(`${initial.due_date}T00:00:00`), 'dd.MM.yyyy') : '');
    setError(null);
    setNote('');
    setResult(null); setDone(0); setCalendarOpen(false);
  }, [invoice, invoices]);
  const save = async () => {
    if (!targets.length || inFlight.current || result) return;
    if (!date) { setError('Bitte ein gültiges Datum im Format TT.MM.JJJJ eingeben.'); return; }
    const checkedNote = z.string().trim().max(2000).safeParse(note);
    if (!checkedNote.success) { setError('Bemerkung darf höchstens 2000 Zeichen enthalten.'); return; }
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const outcome = await changeInvoiceDueDates(targets, format(date, 'yyyy-MM-dd'), async (target, dueDate) => {
        const { error: failure } = await supabase.rpc('fibu_light_set_due_date_with_note', {
          p_invoice_id: target.id, p_due_date: dueDate, p_expected_due_date: target.due_date,
          p_note: checkedNote.data || null,
        });
        if (failure) throw failure;
      }, setDone);
      setResult(outcome);
      if (outcome.succeeded.length) await onSaved(outcome.succeeded);
      if (!outcome.failed.length) onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String((failure as { message?: string })?.message || failure)); }
    finally { setBusy(false); inFlight.current = false; }
  };
  return <Dialog open={targets.length > 0} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Fälligkeit ändern · {invoices ? `${targets.length} markierte Rechnungen` : invoice?.legal_invoice_number || invoice?.invoice_number}</DialogTitle></DialogHeader>
      {invoice && <div className="text-sm text-muted-foreground">Bisherige Fälligkeit: {invoice.due_date ? format(new Date(`${invoice.due_date}T00:00:00`), 'dd.MM.yyyy') : 'Nicht hinterlegt'}</div>}
      {invoices && <div className="max-h-40 overflow-auto text-sm divide-y divide-border">{targets.map(target => <div key={target.id} className="flex justify-between gap-3 py-2"><span>{target.legal_invoice_number || target.invoice_number}</span><span className="text-muted-foreground">{target.due_date ? format(new Date(`${target.due_date}T00:00:00`), 'dd.MM.yyyy') : '—'}</span></div>)}</div>}
      <Label htmlFor="invoice-new-due-date">Neue Fälligkeit</Label>
      <div className="flex gap-2">
      <Input id="invoice-new-due-date" value={dateText} onChange={event => { setDateText(event.target.value); setError(null); }} placeholder="TT.MM.JJJJ" maxLength={10} disabled={busy || !!result} aria-invalid={!!error} />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild><Button variant="outline" size="icon" title="Kalender öffnen" aria-label="Kalender öffnen" disabled={busy || !!result}>
          <CalendarClock className="h-4 w-4" />
        </Button></PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <Calendar locale={de} mode="single" selected={date} defaultMonth={date} onSelect={value => { if (value) { setDateText(format(value, 'dd.MM.yyyy')); setError(null); setCalendarOpen(false); } }} disabled={invoice?.invoice_date ? { before: new Date(`${invoice.invoice_date}T00:00:00`) } : undefined} initialFocus className="pointer-events-auto" />
        </PopoverContent>
      </Popover>
      </div>
      <Label htmlFor="invoice-due-date-note">Bemerkung / Notiz (optional)</Label>
      <Textarea id="invoice-due-date-note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={3} disabled={busy || !!result} />
      {busy && <p role="status" className="text-sm text-muted-foreground">Festschreiben: {done} / {targets.length}</p>}
      {result && <div role="status" className="text-sm">{result.succeeded.length} festgeschrieben · {result.failed.length} nicht geändert<div className="max-h-48 overflow-auto">{result.failed.map(failure => <p key={failure.invoice.id} className="mt-2 text-destructive">{failure.invoice.legal_invoice_number || failure.invoice.invoice_number}: {failure.message}</p>)}</div></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>{result ? 'Schließen' : 'Abbrechen'}</Button>{!result && <Button disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Fälligkeit festschreiben</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}