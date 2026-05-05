import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { z } from 'zod';
import { PageHeader } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';

type LagerDevice = {
  id: string;
  serial_number: string;
  model_name: string;
  airtable_record_id: string | null;
  entry_date: string;
  notes: string | null;
  created_at: string;
};

const formSchema = z.object({
  serial_number: z.string().trim().min(1, 'Seriennummer erforderlich').max(100),
  model_name: z.string().trim().min(1, 'Modell erforderlich').max(200),
  entry_date: z.string().min(1, 'Eingangsdatum erforderlich'),
  notes: z.string().max(1000).optional().nullable(),
});

export default function Lagergeraete() {
  const [devices, setDevices] = useState<LagerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [serial, setSerial] = useState('');
  const [modelName, setModelName] = useState<string>('');
  const [entryDate, setEntryDate] = useState(today);
  const [notes, setNotes] = useState('');

  const loadDevices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lager_devices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Fehler beim Laden: ' + error.message);
    } else {
      setDevices((data ?? []) as LagerDevice[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const resetForm = () => {
    setSerial('');
    setModelName('');
    setEntryDate(today);
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse({
      serial_number: serial,
      model_name: modelName,
      entry_date: entryDate,
      notes: notes || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe');
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('lager_devices').insert([
      {
        serial_number: parsed.data.serial_number,
        model_name: parsed.data.model_name,
        airtable_record_id: null,
        entry_date: parsed.data.entry_date,
        notes: parsed.data.notes ?? null,
        created_by: userData.user?.id,
        updated_by: userData.user?.id,
      },
    ]);
    setSaving(false);

    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success('Lagergerät erfasst');
    resetForm();
    setOpen(false);
    loadDevices();
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={<Warehouse className="w-6 h-6 text-primary" />}
          title="Lagergeräte"
          subtitle="Erfassung und Übersicht aller Lagergeräte"
        />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Neues Lagergerät
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lagergerät erfassen</DialogTitle>
              <DialogDescription>
                Bitte alle Pflichtfelder ausfüllen.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serial">Seriennummer *</Label>
                <Input
                  id="serial"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="z. B. SN-123456"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modell *</Label>
                <Select value={modelName} onValueChange={setModelName}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Modell auswählen" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {ALIX_MODEL_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.models.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-date">Eingangsdatum *</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notizen</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Speichern
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Noch keine Lagergeräte erfasst.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seriennummer</TableHead>
                <TableHead>Modell</TableHead>
                <TableHead>Eingangsdatum</TableHead>
                <TableHead>Notizen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.serial_number}</TableCell>
                  <TableCell>{d.model_name}</TableCell>
                  <TableCell>
                    {format(new Date(d.entry_date), 'dd.MM.yyyy', { locale: de })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.notes ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
