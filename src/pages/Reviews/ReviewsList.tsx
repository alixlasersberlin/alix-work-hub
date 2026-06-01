import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, RotateCw, Eye, Archive, Trash2, Star, Loader2, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';
import { sendReviewInvitation } from '@/lib/review-invitation';
import { Link } from 'react-router-dom';

type Review = {
  id: string;
  order_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  delivery_date: string | null;
  invitation_status: string;
  invitation_sent_at: string | null;
  status: string;
  rating_delivery: number | null;
  rating_driver_friendliness: number | null;
  training_answer: string | null;
  improvement_text: string | null;
  rating_training_text: string | null;
  submitted_at: string | null;
  created_at: string;
};

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={i < value ? 'h-3.5 w-3.5 fill-current' : 'h-3.5 w-3.5 opacity-30'} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value}/5</span>
    </span>
  );
}

const FILTERS = [
  { v: 'all', l: 'Alle Bewertungen' },
  { v: 'pending', l: 'Noch nicht versendet' },
  { v: 'sent', l: 'Einladung versendet' },
  { v: 'submitted', l: 'Bewertung erhalten' },
  { v: 'no_answer', l: 'Keine Bewertung erhalten' },
] as const;

const STAR_FILTERS = ['', '1', '2', '3', '4', '5'] as const;

export default function ReviewsList() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<typeof FILTERS[number]['v']>('all');
  const [search, setSearch] = useState('');
  const [starFilter, setStarFilter] = useState<typeof STAR_FILTERS[number]>('');
  const [editing, setEditing] = useState<Review | null>(null);
  const [detail, setDetail] = useState<Review | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error('Bewertungen laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Review[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'pending') list = list.filter(r => !r.invitation_sent_at);
    else if (filter === 'sent') list = list.filter(r => r.invitation_sent_at && !r.submitted_at);
    else if (filter === 'submitted') list = list.filter(r => !!r.submitted_at);
    else if (filter === 'no_answer') {
      const sevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter(r => r.invitation_sent_at && !r.submitted_at && new Date(r.invitation_sent_at).getTime() < sevenDays);
    }
    if (starFilter) {
      const n = parseInt(starFilter, 10);
      list = list.filter(r => r.rating_delivery === n);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.product_name || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, starFilter, search]);

  async function sendInvite(orderId: string, reviewId?: string) {
    setBusy(reviewId || orderId);
    const r = await sendReviewInvitation(orderId, { manual: true });
    setBusy(null);
    if (r.ok) { toast.success('Einladung versendet'); load(); }
    else toast.error('Versand fehlgeschlagen: ' + (r.message || ''));
  }

  async function archive(r: Review) {
    if (!confirm('Bewertung wirklich archivieren?')) return;
    const { error } = await (supabase as any).from('reviews').update({ status: 'archived' }).eq('id', r.id);
    if (error) toast.error(error.message); else { toast.success('Archiviert'); load(); }
  }

  async function remove(r: Review) {
    if (!confirm('Bewertung wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    const { error } = await (supabase as any).from('reviews').delete().eq('id', r.id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-400" />
            Bewertungen
          </h1>
          <p className="text-sm text-muted-foreground">Kundenbewertungen zu ausgelieferten Aufträgen</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map(f => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={starFilter || 'any'} onValueChange={(v: any) => setStarFilter(v === 'any' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Sterne" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Alle Sterne</SelectItem>
              {['1','2','3','4','5'].map(n => <SelectItem key={n} value={n}>{n} Sterne (Lieferung)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Lieferdatum</TableHead>
              <TableHead>Einladung</TableHead>
              <TableHead>Bewertung</TableHead>
              <TableHead>Lieferung</TableHead>
              <TableHead>Fahrer</TableHead>
              <TableHead>Einweisung</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={11} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Keine Bewertungen.</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id} className={r.status === 'archived' ? 'opacity-50' : ''}>
                <TableCell>
                  <Link to={`/auftraege/${r.order_id}`} className="font-mono text-xs hover:underline">
                    {r.order_number || '—'}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{r.customer_name || '—'}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{r.product_name || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.delivery_date ? new Date(r.delivery_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.invitation_status === 'sent' || r.invitation_status === 'resent' ? 'bg-emerald-500/15 text-emerald-400' :
                    r.invitation_status === 'failed' ? 'bg-red-500/15 text-red-400' :
                    'bg-muted text-muted-foreground'
                  }`}>{r.invitation_status}</span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'submitted' ? 'bg-emerald-500/15 text-emerald-400' :
                    r.status === 'archived' ? 'bg-muted text-muted-foreground' :
                    'bg-amber-500/15 text-amber-400'
                  }`}>{r.status === 'submitted' ? 'abgegeben' : r.status === 'archived' ? 'archiviert' : 'offen'}</span>
                </TableCell>
                <TableCell><Stars value={r.rating_delivery} /></TableCell>
                <TableCell><Stars value={r.rating_driver_friendliness} /></TableCell>
                <TableCell className="text-xs">{r.training_answer || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('de-DE') : '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)} title="Ansehen"><Eye className="h-4 w-4" /></Button>
                    {isSuperAdmin && !r.submitted_at && (
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => sendInvite(r.order_id, r.id)} title={r.invitation_sent_at ? 'Erneut senden' : 'Senden'}>
                        {r.invitation_sent_at ? <RotateCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Bearbeiten"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => archive(r)} title="Archivieren"><Archive className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r)} title="Löschen"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReviewDetailDialog review={detail} onClose={() => setDetail(null)} />
      <ReviewEditDialog review={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function ReviewDetailDialog({ review, onClose }: { review: Review | null; onClose: () => void }) {
  if (!review) return null;
  return (
    <Dialog open={!!review} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bewertung – {review.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">Kunde:</span> {review.customer_name || '—'}</div>
          <div><span className="text-muted-foreground">Produkt:</span> {review.product_name || '—'}</div>
          <div><span className="text-muted-foreground">Lieferdatum:</span> {review.delivery_date ? new Date(review.delivery_date).toLocaleDateString('de-DE') : '—'}</div>
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2"><span className="text-muted-foreground w-40">Lieferung:</span><Stars value={review.rating_delivery} /></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground w-40">Fahrer freundlich:</span><Stars value={review.rating_driver_friendliness} /></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground w-40">Einweisung:</span><span>{review.training_answer || '—'}</span></div>
            {review.rating_training_text && (
              <div className="mt-2"><span className="text-muted-foreground">Anmerkung Einweisung:</span><p className="mt-1 whitespace-pre-wrap">{review.rating_training_text}</p></div>
            )}
            {review.improvement_text && (
              <div className="mt-2"><span className="text-muted-foreground">Verbesserungswünsche:</span><p className="mt-1 whitespace-pre-wrap">{review.improvement_text}</p></div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewEditDialog({ review, onClose, onSaved }: { review: Review | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    rating_delivery: '', rating_driver_friendliness: '', training_answer: '',
    rating_training_text: '', improvement_text: '',
  });
  useEffect(() => {
    if (review) setForm({
      rating_delivery: String(review.rating_delivery ?? ''),
      rating_driver_friendliness: String(review.rating_driver_friendliness ?? ''),
      training_answer: review.training_answer || '',
      rating_training_text: review.rating_training_text || '',
      improvement_text: review.improvement_text || '',
    });
  }, [review]);
  if (!review) return null;

  async function save() {
    const payload: any = {
      rating_delivery: form.rating_delivery ? parseInt(form.rating_delivery, 10) : null,
      rating_driver_friendliness: form.rating_driver_friendliness ? parseInt(form.rating_driver_friendliness, 10) : null,
      training_answer: form.training_answer || null,
      rating_training_text: form.rating_training_text || null,
      improvement_text: form.improvement_text || null,
    };
    const { error } = await (supabase as any).from('reviews').update(payload).eq('id', review!.id);
    if (error) toast.error(error.message); else { toast.success('Gespeichert'); onSaved(); }
  }

  return (
    <Dialog open={!!review} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Bewertung bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Lieferung (1–5)</label>
              <Input type="number" min={1} max={5} value={form.rating_delivery} onChange={e => setForm(f => ({ ...f, rating_delivery: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fahrer (1–5)</label>
              <Input type="number" min={1} max={5} value={form.rating_driver_friendliness} onChange={e => setForm(f => ({ ...f, rating_driver_friendliness: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Einweisung</label>
            <Select value={form.training_answer || 'none'} onValueChange={v => setForm(f => ({ ...f, training_answer: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="ja">Ja</SelectItem>
                <SelectItem value="teilweise">Teilweise</SelectItem>
                <SelectItem value="nein">Nein</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Anmerkung Einweisung</label>
            <Textarea value={form.rating_training_text} onChange={e => setForm(f => ({ ...f, rating_training_text: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Verbesserungswunsch</label>
            <Textarea value={form.improvement_text} onChange={e => setForm(f => ({ ...f, improvement_text: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
