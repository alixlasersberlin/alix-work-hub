import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MailX, Plus, Search, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Row = {
  id: string;
  email: string;
  customer_id: string | null;
  reason: string | null;
  source: string | null;
  created_at: string | null;
};

export default function MailCenterAbmeldungen() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mail_unsubscribes')
      .select('id,email,customer_id,reason,source,created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error('Abmeldungen konnten nicht geladen werden');
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.source) set.add(r.source);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceFilter !== 'all' && (r.source ?? '') !== sourceFilter) return false;
      if (!q) return true;
      return (r.email + ' ' + (r.reason ?? '')).toLowerCase().includes(q);
    });
  }, [rows, search, sourceFilter]);

  const addUnsubscribe = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Bitte eine gültige E-Mail eingeben');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('mail_unsubscribes').insert({
      email,
      reason: newReason.trim() || null,
      source: 'manual',
      status: 'unsubscribed',
    });
    setSaving(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success('Abmeldung hinzugefügt');
    setAddOpen(false);
    setNewEmail('');
    setNewReason('');
    reload();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('mail_unsubscribes').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) return toast.error('Löschen fehlgeschlagen: ' + error.message);
    toast.success('Eintrag entfernt');
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Abmeldungen</h2>
          <p className="text-sm text-muted-foreground">
            DSGVO-Opt-out für Werbe-E-Mails. Transaktionale E-Mails (Rechnungen, Lieferung,
            Reparatur, Mahnung) werden weiterhin zugestellt.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Manuell hinzufügen
        </Button>
      </div>

      <Card className="card-glow">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="E-Mail oder Grund suchen…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="w-24 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <MailX className="w-8 h-8 opacity-40 mb-2" />
                        <p className="text-sm">Keine Abmeldungen vorhanden.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.customer_id ? r.customer_id.slice(0, 8) + '…' : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate">{r.reason ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{r.source ?? '—'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString('de-DE') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="icon"
                          title={isSuperAdmin ? 'Entfernen' : 'Nur Super Admin'}
                          disabled={!isSuperAdmin}
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abmeldung hinzufügen</DialogTitle>
            <DialogDescription>
              Der Empfänger erhält keine Werbe- oder Newsletter-Mails mehr.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-Mail</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder="empfaenger@example.com" />
            </div>
            <div>
              <Label>Grund (optional)</Label>
              <Input value={newReason} onChange={(e) => setNewReason(e.target.value)}
                placeholder="z. B. auf Wunsch des Kunden" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
            <Button onClick={addUnsubscribe} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abmeldung entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Empfänger kann danach wieder Werbe-Mails erhalten. Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
