import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileDown, Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createPDF } from '@/lib/pdf-utils';

export type WareneingangDialogHandle = {
  open: () => void;
  generatePdf: () => void;
  generatePdfFor: (args: { order?: any; device?: { serial_number?: string | null; model_name?: string | null } }) => void;
};

interface Props {
  order: any;
  customer?: any;
  devices?: Array<{ serial_number?: string | null; model_name?: string | null }>;
  hideTrigger?: boolean;
}

type JN = 'ja' | 'nein' | '';
type Quality = 'freigegeben' | 'mit_auflage' | 'gesperrt' | 'reklamation' | 'ruecksendung' | '';

const createInitialState = () => ({
  // Lieferant
  lieferant: '',
  ansprechpartner: '',
  adresse: '',
  telefon: '',
  email: '',
  // Lieferdaten
  datum_wareneingang: new Date().toISOString().split('T')[0],
  lieferschein_nr: '',
  bestellnummer: '',
  versanddienstleister: '',
  // Gerätedaten
  geraetebezeichnung: '',
  modell: '',
  hersteller: '',
  seriennummer: '',
  ce_kennzeichnung: '' as JN,
  // Zubehör
  handstueck: '' as JN,
  fussschalter: '' as JN,
  netzkabel: '' as JN,
  schutzbrillen: '' as JN,
  bedienungsanleitung: '' as JN,
  konformitaetserklaerung: '' as JN,
  // Verpackungs- / Sichtprüfung
  aussenverpackung: '' as JN,
  durchfeuchtung: '' as JN,
  manipulationsspuren: '' as JN,
  gehaeuse: '' as JN,
  display: '' as JN,
  typenschild: '' as JN,
  // Qualitätsbewertung
  qualitaet: '' as Quality,
  // Bemerkungen
  bemerkungen: '',
  // Desinfektion
  geraet_desinfiziert: '' as JN,
  zubehoer_desinfiziert: '' as JN,
  verpackung_desinfiziert: '' as JN,
  brillen_desinfiziert: '' as JN,
  anleitung_desinfiziert: '' as JN,
  // Freigabe
  geprueft_durch: '',
  freigabe_datum: new Date().toISOString().split('T')[0],
  unterschrift: '',
});

type WareneingangState = ReturnType<typeof createInitialState>;

const WareneingangDialog = forwardRef<WareneingangDialogHandle, Props>(({ order, customer, devices = [], hideTrigger }, ref) => {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<WareneingangState>(() => createInitialState());

  const buildPrefilledState = (base: WareneingangState = createInitialState()) => {
    const firstDev = devices[0];
    const firstItem = order?.items?.[0];
    return {
      ...base,
      datum_wareneingang: base.datum_wareneingang || new Date().toISOString().split('T')[0],
      freigabe_datum: base.freigabe_datum || new Date().toISOString().split('T')[0],
      bestellnummer: base.bestellnummer || order?.order_number || '',
      geraetebezeichnung: base.geraetebezeichnung || firstDev?.model_name || firstItem?.item_name || '',
      modell: base.modell || firstDev?.model_name || firstItem?.item_name || '',
      seriennummer: base.seriennummer || firstDev?.serial_number || '',
    } as WareneingangState;
  };

  useEffect(() => {
    if (!open || !order?.id) return;
    setState(s => buildPrefilledState(s));
    if (devices.length > 0) return;
    let cancelled = false;
    (async () => {
      // Prefill from order + reservierte Geräte
      const { data: devs } = await supabase
        .from('lager_devices')
        .select('serial_number, model_name')
        .eq('reserved_order_id', order.id);
      if (cancelled) return;
      const firstDev = (devs || [])[0];
      const firstItem = order.items?.[0];
      setState(s => ({
        ...s,
        bestellnummer: order.order_number || '',
        geraetebezeichnung: firstDev?.model_name || firstItem?.item_name || '',
        modell: firstDev?.model_name || firstItem?.item_name || '',
        seriennummer: firstDev?.serial_number || '',
      }));
    })();
    return () => { cancelled = true; };
  }, [open, order?.id, devices.length, devices[0]?.serial_number, devices[0]?.model_name]);

  const set = <K extends keyof typeof state>(k: K, v: (typeof state)[K]) =>
    setState(s => ({ ...s, [k]: v }));

  const JNRow = ({ label, k }: { label: string; k: keyof typeof state }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-foreground">{label}</span>
      <RadioGroup
        value={state[k] as string}
        onValueChange={(v) => set(k, v as any)}
        className="flex gap-3"
      >
        <Label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <RadioGroupItem value="ja" /> Ja
        </Label>
        <Label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <RadioGroupItem value="nein" /> Nein
        </Label>
      </RadioGroup>
    </div>
  );

  const generatePdf = async (pdfState: WareneingangState = state, closeDialog = true) => {
    setGenerating(true);
    try {
      const doc = createPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 18;

      doc.setFont('Inter', 'bold');
      doc.setFontSize(15);
      doc.text('WARENEINGANGSSCHEIN – LASERGERÄT', pageW / 2, y, { align: 'center' });
      y += 6;
      doc.setFont('Inter', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text('Alix Lasers GmbH', pageW / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 8;

      const section = (title: string) => {
        if (y > 265) { doc.addPage(); y = 18; }
        doc.setFont('Inter', 'bold');
        doc.setFontSize(11);
        doc.setFillColor(245, 245, 245);
        doc.rect(15, y - 4, pageW - 30, 6, 'F');
        doc.text(title, 17, y);
        y += 6;
        doc.setFont('Inter', 'normal');
        doc.setFontSize(10);
      };

      const field = (label: string, value: string) => {
        if (y > 280) { doc.addPage(); y = 18; }
        doc.setTextColor(110);
        doc.text(label, 17, y);
        doc.setTextColor(0);
        doc.text(value || '—', 75, y);
        // underline
        doc.setDrawColor(220);
        doc.line(75, y + 1, pageW - 17, y + 1);
        y += 6;
      };

      const jn = (v: JN) => v === 'ja' ? 'Ja' : v === 'nein' ? 'Nein' : '—';
      const jnField = (label: string, v: JN) => field(label, jn(v));

      section('1. Lieferantendaten');
      field('Lieferant:', pdfState.lieferant);
      field('Ansprechpartner:', pdfState.ansprechpartner);
      field('Adresse:', pdfState.adresse);
      field('Telefon:', pdfState.telefon);
      field('E-Mail:', pdfState.email);
      y += 2;

      section('2. Lieferdaten');
      field('Datum Wareneingang:', pdfState.datum_wareneingang);
      field('Lieferschein-Nr.:', pdfState.lieferschein_nr);
      field('Bestellnummer:', pdfState.bestellnummer);
      field('Versanddienstleister:', pdfState.versanddienstleister);
      y += 2;

      section('3. Gerätedaten');
      field('Gerätebezeichnung:', pdfState.geraetebezeichnung);
      field('Modell:', pdfState.modell);
      field('Hersteller:', pdfState.hersteller);
      field('Seriennummer:', pdfState.seriennummer);
      jnField('CE-Kennzeichnung vorhanden:', pdfState.ce_kennzeichnung);
      y += 2;

      section('4. Zubehörkontrolle');
      jnField('Handstück(e):', pdfState.handstueck);
      jnField('Fußschalter:', pdfState.fussschalter);
      jnField('Netzkabel:', pdfState.netzkabel);
      jnField('Schutzbrillen:', pdfState.schutzbrillen);
      jnField('Bedienungsanleitung:', pdfState.bedienungsanleitung);
      jnField('Konformitätserklärung:', pdfState.konformitaetserklaerung);
      y += 2;

      section('5. Verpackungs- und Sichtprüfung');
      jnField('Außenverpackung unbeschädigt:', pdfState.aussenverpackung);
      jnField('Durchfeuchtung:', pdfState.durchfeuchtung);
      jnField('Manipulationsspuren:', pdfState.manipulationsspuren);
      jnField('Gehäuse unbeschädigt:', pdfState.gehaeuse);
      jnField('Display unbeschädigt:', pdfState.display);
      jnField('Typenschild vorhanden:', pdfState.typenschild);
      y += 2;

      section('6. Qualitätsbewertung');
      const qOpts: Array<[Quality, string]> = [
        ['freigegeben', 'Freigegeben'],
        ['mit_auflage', 'Freigegeben mit Auflage'],
        ['gesperrt', 'Gesperrt'],
        ['reklamation', 'Reklamation erforderlich'],
        ['ruecksendung', 'Rücksendung erforderlich'],
      ];
      qOpts.forEach(([k, lbl]) => {
        if (y > 280) { doc.addPage(); y = 18; }
        const checked = pdfState.qualitaet === k;
        doc.setDrawColor(0);
        doc.rect(17, y - 3.2, 3.5, 3.5);
        if (checked) {
          doc.setFillColor(0, 0, 0);
          doc.rect(17.4, y - 2.8, 2.7, 2.7, 'F');
        }
        doc.text(lbl, 23, y);
        y += 5;
      });
      y += 2;

      section('7. Bemerkungen');
      const lines = doc.splitTextToSize(pdfState.bemerkungen || '—', pageW - 34);
      lines.forEach((l: string) => {
        if (y > 280) { doc.addPage(); y = 18; }
        doc.text(l, 17, y);
        y += 5;
      });
      y += 2;

      section('8. Desinfektion');
      jnField('Geräte desinfiziert:', pdfState.geraet_desinfiziert);
      jnField('Zubehör desinfiziert:', pdfState.zubehoer_desinfiziert);
      jnField('Original Verpackung desinfiziert:', pdfState.verpackung_desinfiziert);
      jnField('Schutzbrillen desinfiziert:', pdfState.brillen_desinfiziert);
      jnField('Bedienungsanleitung:', pdfState.anleitung_desinfiziert);
      y += 2;

      section('9. Freigabe');
      field('Geprüft durch:', pdfState.geprueft_durch);
      field('Datum:', pdfState.freigabe_datum);
      field('Unterschrift:', pdfState.unterschrift);

      const fileName = `Wareneingang_${pdfState.seriennummer || order.order_number || 'Geraet'}.pdf`;
      // Blob-Download statt doc.save() — funktioniert auch in sandboxed iframes
      const blob = doc.output('blob') as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      // Zusätzlich in neuem Tab öffnen, falls Download blockiert
      try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
      toast.success('Wareneingangsschein erzeugt');
      if (closeDialog) setOpen(false);
    } catch (e: any) {
      console.error('Wareneingang PDF error:', e);
      toast.error('PDF-Erzeugung fehlgeschlagen: ' + (e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    generatePdf: () => generatePdf(buildPrefilledState(createInitialState()), false),
    generatePdfFor: ({ order: o, device }) => {
      const base = createInitialState();
      const prefilled: WareneingangState = {
        ...base,
        bestellnummer: o?.order_number || '',
        geraetebezeichnung: device?.model_name || o?.items?.[0]?.item_name || '',
        modell: device?.model_name || o?.items?.[0]?.item_name || '',
        seriennummer: device?.serial_number || '',
      };
      generatePdf(prefilled, false);
    },
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary" /> Wareneingang
          </DialogTitle>
          <DialogDescription>
            Wareneingangsschein – Lasergerät. Felder ausfüllen und PDF erzeugen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 1. Lieferantendaten */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">1. Lieferantendaten</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Lieferant</Label><Input value={state.lieferant} onChange={e => set('lieferant', e.target.value)} /></div>
              <div><Label>Ansprechpartner</Label><Input value={state.ansprechpartner} onChange={e => set('ansprechpartner', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Adresse</Label><Input value={state.adresse} onChange={e => set('adresse', e.target.value)} /></div>
              <div><Label>Telefon</Label><Input value={state.telefon} onChange={e => set('telefon', e.target.value)} /></div>
              <div><Label>E-Mail</Label><Input value={state.email} onChange={e => set('email', e.target.value)} /></div>
            </div>
          </section>

          {/* 2. Lieferdaten */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">2. Lieferdaten</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Datum Wareneingang</Label><Input type="date" value={state.datum_wareneingang} onChange={e => set('datum_wareneingang', e.target.value)} /></div>
              <div><Label>Lieferschein-Nr.</Label><Input value={state.lieferschein_nr} onChange={e => set('lieferschein_nr', e.target.value)} /></div>
              <div><Label>Bestellnummer</Label><Input value={state.bestellnummer} onChange={e => set('bestellnummer', e.target.value)} /></div>
              <div><Label>Versanddienstleister</Label><Input value={state.versanddienstleister} onChange={e => set('versanddienstleister', e.target.value)} /></div>
            </div>
          </section>

          {/* 3. Gerätedaten */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">3. Gerätedaten</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Gerätebezeichnung</Label><Input value={state.geraetebezeichnung} onChange={e => set('geraetebezeichnung', e.target.value)} /></div>
              <div><Label>Modell</Label><Input value={state.modell} onChange={e => set('modell', e.target.value)} /></div>
              <div><Label>Hersteller</Label><Input value={state.hersteller} onChange={e => set('hersteller', e.target.value)} /></div>
              <div>
                <Label className="text-primary">Seriennummer *</Label>
                <Input
                  value={state.seriennummer}
                  onChange={e => set('seriennummer', e.target.value)}
                  className="border-primary/40 focus-visible:ring-primary"
                  placeholder="z. B. SN-123456"
                />
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <JNRow label="CE-Kennzeichnung vorhanden" k="ce_kennzeichnung" />
            </div>
          </section>

          {/* 4. Zubehörkontrolle */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">4. Zubehörkontrolle</h3>
            <div className="rounded-md border border-border p-3">
              <JNRow label="Handstück(e)" k="handstueck" />
              <JNRow label="Fußschalter" k="fussschalter" />
              <JNRow label="Netzkabel" k="netzkabel" />
              <JNRow label="Schutzbrillen" k="schutzbrillen" />
              <JNRow label="Bedienungsanleitung" k="bedienungsanleitung" />
              <JNRow label="Konformitätserklärung" k="konformitaetserklaerung" />
            </div>
          </section>

          {/* 5. Verpackungs- und Sichtprüfung */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">5. Verpackungs- und Sichtprüfung</h3>
            <div className="rounded-md border border-border p-3">
              <JNRow label="Außenverpackung unbeschädigt" k="aussenverpackung" />
              <JNRow label="Durchfeuchtung" k="durchfeuchtung" />
              <JNRow label="Manipulationsspuren" k="manipulationsspuren" />
              <JNRow label="Gehäuse unbeschädigt" k="gehaeuse" />
              <JNRow label="Display unbeschädigt" k="display" />
              <JNRow label="Typenschild vorhanden" k="typenschild" />
            </div>
          </section>

          {/* 6. Qualitätsbewertung */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">6. Qualitätsbewertung</h3>
            <RadioGroup value={state.qualitaet} onValueChange={(v) => set('qualitaet', v as Quality)} className="space-y-1.5">
              {[
                ['freigegeben', 'Freigegeben'],
                ['mit_auflage', 'Freigegeben mit Auflage'],
                ['gesperrt', 'Gesperrt'],
                ['reklamation', 'Reklamation erforderlich'],
                ['ruecksendung', 'Rücksendung erforderlich'],
              ].map(([v, l]) => (
                <Label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value={v} /> {l}
                </Label>
              ))}
            </RadioGroup>
          </section>

          {/* 7. Bemerkungen */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">7. Bemerkungen</h3>
            <Textarea rows={3} value={state.bemerkungen} onChange={e => set('bemerkungen', e.target.value)} />
          </section>

          {/* 8. Desinfektion */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">8. Desinfektion</h3>
            <div className="rounded-md border border-border p-3">
              <JNRow label="Geräte desinfiziert" k="geraet_desinfiziert" />
              <JNRow label="Zubehör desinfiziert" k="zubehoer_desinfiziert" />
              <JNRow label="Original Verpackung desinfiziert" k="verpackung_desinfiziert" />
              <JNRow label="Schutzbrillen desinfiziert" k="brillen_desinfiziert" />
              <JNRow label="Bedienungsanleitung" k="anleitung_desinfiziert" />
            </div>
          </section>

          {/* 9. Freigabe */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-primary">9. Freigabe</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div><Label>Geprüft durch</Label><Input value={state.geprueft_durch} onChange={e => set('geprueft_durch', e.target.value)} /></div>
              <div><Label>Datum</Label><Input type="date" value={state.freigabe_datum} onChange={e => set('freigabe_datum', e.target.value)} /></div>
              <div><Label>Unterschrift (Name)</Label><Input value={state.unterschrift} onChange={e => set('unterschrift', e.target.value)} /></div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>Abbrechen</Button>
          <Button onClick={() => generatePdf(state, true)} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            PDF erzeugen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

WareneingangDialog.displayName = 'WareneingangDialog';
export default WareneingangDialog;
