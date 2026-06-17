import { useMemo, useState } from 'react';
import { Truck, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import alixLogo from '@/assets/alix-lasers-logo.png';
import lieferscheinBg from '@/assets/lieferschein-vorlage.png.asset.json';
import { createRestbestellungMarker } from '@/lib/restbestellung';

interface Props {
  order: any;
  customer: any;
  items: any[];
  onReload?: () => void;
}

type Decision = 'ausbuchen' | 'nachbestellen' | 'warten';

function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

function fmtAddress(a: any): string[] {
  if (!a || typeof a !== 'object') return [];
  const street = a.address || a.street || '';
  const zipCity = [a.zip || a.postal_code || '', a.city || ''].filter(Boolean).join(' ');
  const country = a.country || '';
  return [street, zipCity, country].filter(Boolean);
}

export default function DeliveryNoteTab({ order, customer, items, onReload }: Props) {
  const { user } = useAuth();
  const [allowPartial, setAllowPartial] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selection, setSelection] = useState<Record<string, { checked: boolean; qty: number }>>(
    () => Object.fromEntries(items.map(i => [i.id, { checked: true, qty: Number(i.quantity || 0) }])),
  );
  const [generating, setGenerating] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const leftover = useMemo(() => items
    .map(i => {
      const sel = selection[i.id] || { checked: false, qty: 0 };
      const ordered = Number(i.quantity || 0);
      const delivered = sel.checked ? Math.min(sel.qty, ordered) : 0;
      return { item: i, ordered, delivered, remain: Math.max(0, ordered - delivered) };
    })
    .filter(r => r.remain > 0), [items, selection]);

  const anyDelivered = useMemo(
    () => items.some(i => {
      const s = selection[i.id];
      return s?.checked && s.qty > 0;
    }),
    [items, selection],
  );

  const setQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setSelection(s => ({ ...s, [id]: { ...s[id], qty: clamped, checked: clamped > 0 } }));
  };

  const toggle = (id: string, checked: boolean, max: number) => {
    setSelection(s => ({ ...s, [id]: { checked, qty: checked ? (s[id]?.qty || max) : 0 } }));
  };

  async function handleStartGenerate() {
    if (!anyDelivered) { toast.error('Bitte mindestens einen Artikel auswählen.'); return; }
    if (leftover.length > 0) {
      // require allow partial OR ask user
      if (!allowPartial) {
        toast.error('Teillieferung nicht erlaubt – bitte alle Artikel vollständig auswählen.');
        return;
      }
      // pre-fill decisions
      const init: Record<string, Decision> = {};
      leftover.forEach(l => { init[l.item.id] = 'warten'; });
      setDecisions(init);
      setDecisionOpen(true);
      return;
    }
    await generateAndSave([]);
  }

  async function confirmDecisions() {
    setDecisionOpen(false);
    await generateAndSave(leftover.map(l => ({ ...l, decision: decisions[l.item.id] || 'warten' })));
  }

  async function generateAndSave(leftoverWithDecisions: Array<any>) {
    setGenerating(true);
    try {
      // Build PDF
      const doc = createPDF({ unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ml = 25;
      let y = 18;

      // Background template (full A4)
      try {
        const bgData = await loadImageAsBase64(lieferscheinBg.url);
        doc.addImage(bgData, 'PNG', 0, 0, pw, ph);
      } catch { /* ignore */ }

      // Title
      doc.setFont('Inter', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(0);
      doc.text('Lieferschein', ml, y + 6);
      y += 18;

      // Auftragsnummer
      doc.setFont('Inter', 'bold');
      doc.setFontSize(10);
      doc.text('Auftragsnr.', ml, y);
      doc.setFont('Inter', 'normal');
      doc.text(String(order.order_number || '—'), ml + 30, y);
      y += 8;

      // Rechnungsadresse
      doc.setFont('Inter', 'bold');
      doc.text('Rechnungsadresse', ml, y);
      y += 5;
      doc.setFont('Inter', 'normal');
      const c = customer || {};
      const lines: string[] = [];
      if (c.company_name) lines.push(c.company_name);
      if (c.contact_name) lines.push(c.contact_name);
      lines.push(...fmtAddress(c.billing_address || c.shipping_address));
      lines.forEach(ln => { doc.text(ln, ml, y); y += 5; });
      y += 4;

      // Items table
      const body = items
        .map((i, idx) => {
          const s = selection[i.id];
          if (!s?.checked || s.qty <= 0) return null;
          return [
            String(idx + 1),
            String(i.item_name || '—') + (i.description ? `\n${String(i.description).slice(0, 80)}` : ''),
            String(s.qty),
          ];
        })
        .filter(Boolean) as string[][];

      autoTable(doc, {
        startY: y,
        head: [['#', 'Artikel', 'Menge']],
        body,
        theme: 'grid',
        styles: { font: 'Inter', fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { cellWidth: 20, halign: 'right' },
        },
        margin: { left: ml, right: ml },
      });


      let fy = (doc as any).lastAutoTable.finalY + 10;

      // Confirmation text
      doc.setFont('Inter', 'normal');
      doc.setFontSize(9);
      const text = 'Der Kunde bestätigt den einwandfreien Erhalt der Geräte ohne sichtbare Mängel sowie die vollständige und zufriedenstellende Durchführung der Schulung.';
      const wrapped = doc.splitTextToSize(text, pw - ml * 2);
      doc.text(wrapped, ml, fy);
      fy += wrapped.length * 4 + 10;

      // Signature blocks
      doc.setFontSize(10);
      const dateLabel = deliveryDate
        ? new Date(deliveryDate + 'T00:00:00').toLocaleDateString('de-DE')
        : new Date().toLocaleDateString('de-DE');
      doc.text(`Datum: ${dateLabel}`, ml, fy);
      fy += 14;
      doc.line(ml, fy, ml + 70, fy);
      doc.line(pw - ml - 70, fy, pw - ml, fy);
      doc.setFontSize(9);
      doc.text('Unterschrift Kunde', ml, fy + 5);
      doc.text('Unterschrift Alix Lasers', pw - ml - 70, fy + 5);

      // Footer is part of the background template – no extra footer drawn.

      doc.save(`Lieferschein_${order.order_number || order.id}.pdf`);

      // Save audit note
      const deliveredSummary = items
        .filter(i => { const s = selection[i.id]; return s?.checked && s.qty > 0; })
        .map(i => `${i.item_name} × ${selection[i.id].qty}`)
        .join(', ');
      const leftoverSummary = leftoverWithDecisions
        .map(l => `${l.item.item_name} (offen: ${l.remain}, Aktion: ${l.decision})`)
        .join('; ');

      const noteText = [
        `Lieferschein erstellt.`,
        deliveredSummary ? `Geliefert: ${deliveredSummary}.` : '',
        leftoverSummary ? `Restposten: ${leftoverSummary}.` : '',
      ].filter(Boolean).join(' ');

      if (user) {
        await supabase.from('order_notes').insert({
          order_id: order.id,
          note_text: noteText,
          note_type: 'lieferschein',
          created_by: user.id,
        });
      }

      // Handle "nachbestellen" → Restbestellungs-Marker
      const nachbestellen = leftoverWithDecisions.filter(l => l.decision === 'nachbestellen');
      if (nachbestellen.length > 0) {
        try {
          await createRestbestellungMarker(order.id);
        } catch { /* ignore – marker optional */ }
      }

      toast.success('Lieferschein-PDF erstellt');
      onReload?.();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'Unbekannt'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> Lieferschein
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="delivery-date" className="text-sm">Datum</Label>
            <Input
              id="delivery-date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="h-8 w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="partial" checked={allowPartial} onCheckedChange={setAllowPartial} />
            <Label htmlFor="partial" className="text-sm">Teillieferung erlauben</Label>
          </div>
          <Button onClick={handleStartGenerate} disabled={generating || items.length === 0} className="gold-gradient text-primary-foreground">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            PDF erstellen
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Keine Artikel im Auftrag.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Artikel</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Bestellt</TableHead>
              <TableHead className="text-right w-32">Liefermenge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i, idx) => {
              const ordered = Number(i.quantity || 0);
              const s = selection[i.id] || { checked: false, qty: 0 };
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <Checkbox
                      checked={s.checked}
                      onCheckedChange={(v) => toggle(i.id, !!v, ordered)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{i.item_name || '—'}</div>
                    {i.description && <div className="text-xs text-muted-foreground truncate max-w-md">{i.description}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.sku || '—'}</TableCell>
                  <TableCell className="text-right">{ordered}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={ordered}
                      value={s.qty}
                      onChange={(e) => setQty(i.id, Number(e.target.value || 0), ordered)}
                      disabled={!allowPartial && s.checked ? false : false}
                      className="h-8 w-24 ml-auto text-right"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Offene Positionen behandeln</DialogTitle>
            <DialogDescription>
              Es bleiben Positionen offen. Bitte für jede Position eine Aktion wählen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-auto pr-1">
            {leftover.map(l => (
              <div key={l.item.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium mb-2">
                  {l.item.item_name} <span className="text-muted-foreground">· offen: {l.remain}</span>
                </div>
                <RadioGroup
                  value={decisions[l.item.id] || 'warten'}
                  onValueChange={(v) => setDecisions(d => ({ ...d, [l.item.id]: v as Decision }))}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-secondary/50">
                    <RadioGroupItem value="ausbuchen" /> Ausbuchen
                  </Label>
                  <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-secondary/50">
                    <RadioGroupItem value="nachbestellen" /> Nachbestellen
                  </Label>
                  <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-secondary/50">
                    <RadioGroupItem value="warten" /> Warten
                  </Label>
                </RadioGroup>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)}>Abbrechen</Button>
            <Button onClick={confirmDecisions} className="gold-gradient text-primary-foreground">
              Bestätigen & PDF erzeugen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
