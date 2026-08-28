import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2, CalendarClock, MapPin, Loader2, ClipboardList, UserRound, Info,
} from 'lucide-react';
import type { DeliveryJourneyPayload } from '@/lib/portal/delivery-types';

interface Creds { order_number: string; zip: string; email: string }

interface Props {
  creds: Creds | null;
  delivery: DeliveryJourneyPayload;
  onDone?: () => void;
}

const CONDITION_FIELDS: { key: string; label: string }[] = [
  { key: 'elevator', label: 'Aufzug vorhanden' },
  { key: 'stairs', label: 'Treppen vorhanden' },
  { key: 'parking', label: 'Parkmöglichkeit vorhanden' },
  { key: 'loading_zone', label: 'Ladezone vorhanden' },
  { key: 'access_limited', label: 'Zufahrt eingeschränkt' },
  { key: 'door_narrow', label: 'Türbreite problematisch' },
  { key: 'reception', label: 'Empfang / Anmeldung erforderlich' },
  { key: 'appointment_only', label: 'Zutritt nur nach Anmeldung' },
];

const RESCHEDULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'other_date', label: 'Anderes Datum gewünscht' },
  { value: 'morning', label: 'Vormittags' },
  { value: 'afternoon', label: 'Nachmittags' },
  { value: 'weekdays', label: 'Bestimmte Wochentage' },
  { value: 'callback', label: 'Rückruf erforderlich' },
  { value: 'other', label: 'Sonstiger Grund' },
];

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

export function CustomerActions({ creds, delivery, onDone }: Props) {
  const [open, setOpen] = useState<null | 'address' | 'conditions' | 'contact' | 'reschedule'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAddressOpen, setConfirmAddressOpen] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [addr, setAddr] = useState({
    company: delivery.address?.company ?? '',
    street: delivery.address?.street ?? '',
    zip: delivery.address?.zip ?? '',
    city: delivery.address?.city ?? '',
    country: delivery.address?.country ?? '',
    attention: delivery.address?.attention ?? '',
    phone: delivery.address?.phone ?? '',
  });
  const [addrNote, setAddrNote] = useState('');
  const [cond, setCond] = useState<Record<string, boolean | string>>(
    (delivery.conditions as Record<string, boolean | string>) ?? {},
  );
  const [floor, setFloor] = useState(String((delivery.conditions as any)?.floor ?? ''));
  const [condNote, setCondNote] = useState(String((delivery.conditions as any)?.note ?? ''));
  const [contact, setContact] = useState({
    name: delivery.onsite_contact?.name ?? '',
    phone: delivery.onsite_contact?.phone ?? '',
    email: delivery.onsite_contact?.email ?? '',
    role: delivery.onsite_contact?.role ?? '',
  });
  const [reKind, setReKind] = useState('other_date');
  const [reDate, setReDate] = useState('');
  const [reDays, setReDays] = useState<string[]>([]);
  const [reNote, setReNote] = useState('');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  async function send(action: string, payload: Record<string, unknown>, successText: string) {
    if (!creds) return;
    setBusy(action);
    setError('');
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/portal-delivery-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ ...creds, action, ...payload }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setError('Ihre Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es später erneut.');
      } else {
        setFlash(successText);
        setOpen(null);
        onDone?.();
      }
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
    setBusy(null);
  }

  if (!creds) return null;

  const todos = delivery.todos ?? [];
  const address = delivery.address;

  return (
    <div className="space-y-3">
      {/* Was muss ich tun? */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="w-4 h-4 text-primary" aria-hidden="true" /> Was muss ich tun?
          </div>
          {todos.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
              Aktuell ist keine Aktion von Ihnen erforderlich.
            </p>
          ) : (
            <ul className="space-y-1.5" aria-label="Offene Aufgaben">
              {todos.map((t) => (
                <li key={t.key} className="text-sm flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />
                  <span><span className="font-medium">{t.label}:</span> {t.text}</span>
                </li>
              ))}
            </ul>
          )}
          {flash && <p className="text-sm text-primary">{flash}</p>}
        </CardContent>
      </Card>

      {/* Ihre Lieferung */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-medium">Ihre Lieferung</div>

          {/* Lieferadresse */}
          {address && (address.street || address.city) && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4" aria-hidden="true" /> Lieferadresse
                {address.confirmed && <Badge variant="outline" className="ml-1">bestätigt</Badge>}
              </div>
              <address className="text-sm not-italic text-muted-foreground leading-relaxed">
                {address.company && <>{address.company}<br /></>}
                {address.attention && <>{address.attention}<br /></>}
                {address.street && <>{address.street}<br /></>}
                {[address.zip, address.city].filter(Boolean).join(' ')}<br />
                {address.country}
                {address.phone && <><br />{address.phone}</>}
              </address>
              {!address.confirmed && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setConfirmAddressOpen(true)} disabled={busy === 'confirm_address'}>
                    {busy === 'confirm_address' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Adresse ist korrekt
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === 'address' ? null : 'address')}>
                    Änderung melden
                  </Button>
                </div>
              )}
              {open === 'address' && (
                <div className="space-y-2 pt-1">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><Label className="text-xs">Firma</Label><Input value={addr.company} onChange={(e) => setAddr({ ...addr, company: e.target.value })} /></div>
                    <div><Label className="text-xs">Ansprechpartner</Label><Input value={addr.attention} onChange={(e) => setAddr({ ...addr, attention: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Straße und Hausnummer</Label><Input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></div>
                    <div><Label className="text-xs">PLZ</Label><Input value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} /></div>
                    <div><Label className="text-xs">Ort</Label><Input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></div>
                    <div><Label className="text-xs">Land</Label><Input value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} /></div>
                    <div><Label className="text-xs">Telefon</Label><Input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} /></div>
                  </div>
                  <Textarea rows={2} placeholder="Hinweis (optional)" value={addrNote} maxLength={500} onChange={(e) => setAddrNote(e.target.value)} />
                  <Button
                    size="sm"
                    disabled={busy === 'address_change'}
                    onClick={() => send('address_change', { address: addr, note: addrNote || undefined }, 'Ihre Adressänderung wurde übermittelt und wird geprüft.')}
                  >
                    {busy === 'address_change' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Änderung senden
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Änderungen werden von unserem Team geprüft und nicht automatisch übernommen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Termin passt nicht */}
          {delivery.customer_response?.can_confirm && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="w-4 h-4" aria-hidden="true" /> Termin passt nicht
              </div>
              {open === 'reschedule' ? (
                <div className="space-y-2">
                  <div className="grid gap-1.5 sm:grid-cols-2" role="group" aria-label="Terminwunsch">
                    {RESCHEDULE_OPTIONS.map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="reschedule"
                          value={o.value}
                          checked={reKind === o.value}
                          onChange={() => setReKind(o.value)}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  {reKind === 'other_date' && (
                    <div><Label className="text-xs">Wunschtermin</Label><Input type="date" value={reDate} onChange={(e) => setReDate(e.target.value)} /></div>
                  )}
                  {reKind === 'weekdays' && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {WEEKDAYS.map((d) => (
                        <label key={d} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={reDays.includes(d)}
                            onCheckedChange={() => setReDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  )}
                  <Textarea rows={2} placeholder="Ihre Nachricht (optional)" maxLength={500} value={reNote} onChange={(e) => setReNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy === 'reschedule'}
                      onClick={() => send('reschedule', {
                        note: reNote || undefined,
                        reschedule: {
                          kind: reKind,
                          alternative_date: reKind === 'other_date' && reDate ? reDate : undefined,
                          weekdays: reKind === 'weekdays' ? reDays : undefined,
                        },
                      }, 'Ihre Terminänderung wurde übermittelt.')}
                    >
                      {busy === 'reschedule' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Anfrage senden
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Abbrechen</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setOpen('reschedule')}>Termin passt nicht</Button>
              )}
            </div>
          )}

          {/* Lieferbedingungen */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="w-4 h-4" aria-hidden="true" /> Gegebenheiten vor Ort
            </div>
            {open === 'conditions' ? (
              <div className="space-y-2">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {CONDITION_FIELDS.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(cond[f.key])}
                        onCheckedChange={(v) => setCond((p) => ({ ...p, [f.key]: Boolean(v) }))}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><Label className="text-xs">Etage</Label><Input value={floor} onChange={(e) => setFloor(e.target.value)} /></div>
                  <div><Label className="text-xs">Besondere Zugangshinweise</Label><Input value={condNote} maxLength={200} onChange={(e) => setCondNote(e.target.value)} /></div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy === 'conditions'}
                    onClick={() => send('conditions', { conditions: { ...cond, floor, note: condNote } }, 'Vielen Dank – Ihre Angaben liegen unserer Tourenplanung vor.')}
                  >
                    {busy === 'conditions' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Angaben speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Abbrechen</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setOpen('conditions')}>Angaben machen</Button>
            )}
          </div>

          {/* Ansprechpartner */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserRound className="w-4 h-4" aria-hidden="true" /> Ansprechpartner am Liefertag
            </div>
            {open === 'contact' ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><Label className="text-xs">Name</Label><Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
                  <div><Label className="text-xs">Telefon</Label><Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
                  <div><Label className="text-xs">E-Mail</Label><Input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
                  <div><Label className="text-xs">Funktion</Label><Input value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} /></div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy === 'contact' || !contact.name}
                    onClick={() => send('contact', { contact }, 'Vielen Dank – wir haben Ihren Ansprechpartner hinterlegt.')}
                  >
                    {busy === 'contact' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Abbrechen</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {delivery.onsite_contact?.name && (
                  <span className="text-sm text-muted-foreground">{delivery.onsite_contact.name}</span>
                )}
                <Button size="sm" variant="outline" onClick={() => setOpen('contact')}>
                  {delivery.onsite_contact?.name ? 'Ändern' : 'Ansprechpartner benennen'}
                </Button>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <AlertDialog open={confirmAddressOpen} onOpenChange={setConfirmAddressOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lieferadresse bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Bitte bestätigen Sie, dass die angezeigte Lieferadresse korrekt ist und Sie zum angegebenen Liefertermin erreichbar sind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => send('confirm_address', {}, 'Vielen Dank – Ihre Lieferadresse ist bestätigt.')}
            >
              Adresse ist korrekt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CustomerActions;
