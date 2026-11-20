import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

export function InvoiceDueDateDialog({ invoice, onClose, onSaved }: {
  invoice: { id: string; invoice_number: string | null; legal_invoice_number: string | null; due_date: string | null; invoice_date: string | null } | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState<Date>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    setDate(invoice?.due_date ? new Date(`${invoice.due_date}T00:00:00`) : undefined);
    setError(null);
  }, [invoice]);
  const save = async () => {
    if (!invoice || !date || busy) return;
    setBusy(true); setError(null);
    try {
      const { error: failure } = await supabase.rpc('fibu_light_set_due_date', {
        p_invoice_id: invoice.id, p_due_date: format(date, 'yyyy-MM-dd'), p_expected_due_date: invoice.due_date,
      });
      if (failure) throw failure;
      await onSaved();
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String((failure as { message?: string })?.message || failure)); }
    finally { setBusy(false); }
  };
  return <Dialog open={!!invoice} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Fälligkeit ändern · {invoice?.legal_invoice_number || invoice?.invoice_number}</DialogTitle></DialogHeader>
      <div className="text-sm text-muted-foreground">Bisherige Fälligkeit: {invoice?.due_date ? format(new Date(`${invoice.due_date}T00:00:00`), 'dd.MM.yyyy') : 'Nicht hinterlegt'}</div>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start" disabled={busy}>
          <CalendarClock className="mr-2 h-4 w-4" />{date ? format(date, 'dd.MM.yyyy') : 'Neue Fälligkeit auswählen'}
        </Button></PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <Calendar locale={de} mode="single" selected={date} defaultMonth={date} onSelect={value => { setDate(value); if (value) setCalendarOpen(false); }} disabled={invoice?.invoice_date ? { before: new Date(`${invoice.invoice_date}T00:00:00`) } : undefined} initialFocus className="pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Abbrechen</Button><Button disabled={!date || busy} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Fälligkeit festschreiben</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}