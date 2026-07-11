import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Copy, RefreshCw, Package as PackageIcon, CheckCircle2, Mail, MessageCircle, Check, Lock, UserPlus, CalendarClock, AlertTriangle, Download, Eye, History as HistoryIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import MediapaketReviewPanel, { SECTION_LABEL } from './MediapaketReviewPanel';
import MediapaketExtrasPanel from './MediapaketExtrasPanel';
import { notifyBus } from '@/hooks/useNotifications';

interface Props {
  orderId: string;
  customerId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Nicht begonnen',
  in_progress: 'In Bearbeitung',
  question_required: 'Rückfrage nötig',
  customer_correction: 'Korrektur beim Kunden',
  submitted: 'Eingereicht',
  in_review: 'In Prüfung',
  approval_pending: 'Freigabe ausstehend',
  in_production: 'In Produktion',
  completed: 'Abgeschlossen',
};

export default function MediapaketOrderTab({ orderId, customerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [mp, setMp] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('media_packages')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    setMp(data);
    if (data?.id) {
      const { data: prog } = await supabase.rpc('calc_media_package_progress', { _mp_id: data.id });
      setProgress(Number(prog) || 0);
      const [services, studio, devices, prices, contact, hours, treatments, team, branding, files, consents] = await Promise.all([
        supabase.from('media_package_services').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_studio_data').select('*').eq('media_package_id', data.id).maybeSingle(),
        supabase.from('media_package_devices').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_prices').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_contact_data').select('*').eq('media_package_id', data.id).maybeSingle(),
        supabase.from('media_package_opening_hours').select('*').eq('media_package_id', data.id).order('weekday'),
        supabase.from('media_package_treatments').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_team_members').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_branding').select('*').eq('media_package_id', data.id).maybeSingle(),
        supabase.from('media_package_files').select('*').eq('media_package_id', data.id),
        supabase.from('media_package_consents').select('*').eq('media_package_id', data.id),
      ]);
      setSections({
        services: services.data || [], studio: studio.data, devices: devices.data || [],
        prices: prices.data || [], contact: contact.data, hours: hours.data || [],
        treatments: treatments.data || [], team: team.data || [], branding: branding.data,
        files: files.data || [], consents: consents.data || [],
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  // Comments (realtime): unread customer answers + section-grouped thread + internal staff thread
  const [unread, setUnread] = useState<any[]>([]);
  const [commentsBySection, setCommentsBySection] = useState<Record<string, any[]>>({});
  const [internalThread, setInternalThread] = useState<any[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const loadComments = useCallback(async (mpId: string) => {
    const { data } = await supabase
      .from('media_package_comments')
      .select('id, subject, comment, created_at, read_at, answered_at, author_type, recipient_type, internal_only, related_field, author_id')
      .eq('media_package_id', mpId)
      .order('created_at', { ascending: false });
    const all = data || [];
    setUnread(all.filter(c => c.author_type === 'customer' && c.recipient_type === 'staff' && !c.internal_only && !c.read_at));
    const grouped: Record<string, any[]> = {};
    for (const c of all) {
      if (c.internal_only) continue;
      const key = c.related_field && SECTION_LABEL[c.related_field] ? c.related_field : null;
      if (!key) continue;
      (grouped[key] ||= []).push(c);
    }
    setCommentsBySection(grouped);
    const internals = all.filter(c => c.internal_only).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setInternalThread(internals);
    // Resolve author display names
    const uids = Array.from(new Set(internals.map(c => c.author_id).filter(Boolean))) as string[];
    if (uids.length) {
      const { data: profs } = await supabase.from('user_profiles').select('id, full_name, email').in('id', uids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p.full_name || p.email || 'Mitarbeiter'; });
      setAuthorNames(prev => ({ ...prev, ...map }));
    }
  }, []);

  // Staff list for assignment
  const [staffList, setStaffList] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, is_active')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      setStaffList((data || []).map((p: any) => ({ id: p.id, label: p.full_name || p.email || 'Unbenannt' })));
    })();
  }, []);

  const assignUser = async (userId: string | null) => {
    if (!mp?.id) return;
    const { error } = await supabase.from('media_packages').update({ assigned_user_id: userId }).eq('id', mp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(userId ? 'Mitarbeiter zugewiesen' : 'Zuweisung entfernt');
    load();
  };

  const setDueDate = async (d: Date | undefined) => {
    if (!mp?.id) return;
    const iso = d ? format(d, 'yyyy-MM-dd') : null;
    const { error } = await supabase.from('media_packages').update({ due_date: iso }).eq('id', mp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(iso ? `Frist gesetzt: ${format(d as Date, 'dd.MM.yyyy')}` : 'Frist entfernt');
    load();
  };


  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!mp?.id) { setUnread([]); setCommentsBySection({}); notifiedIdsRef.current.clear(); initializedRef.current = false; return; }
    initializedRef.current = false;
    loadComments(mp.id).then(() => { initializedRef.current = true; });
    const ch = supabase
      .channel(`mp-comments-${mp.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'media_package_comments',
        filter: `media_package_id=eq.${mp.id}`,
      }, (payload) => {
        const row: any = payload.new;
        if (
          initializedRef.current &&
          row &&
          row.author_type === 'customer' &&
          row.recipient_type === 'staff' &&
          !row.internal_only &&
          !row.read_at &&
          !notifiedIdsRef.current.has(row.id)
        ) {
          notifiedIdsRef.current.add(row.id);
          const sectionLabel = row.related_field ? SECTION_LABEL[row.related_field] : null;
          notifyBus.push({
            title: 'Neue Kundenantwort (Mediapaket)',
            body: sectionLabel ? `${sectionLabel}: ${row.subject || row.comment || ''}` : (row.subject || row.comment || ''),
            kind: 'warning',
            module: 'Mediapaket',
            href: `/auftraege/${orderId}?tab=mediapaket`,
          });
          toast.info('Neue Kundenantwort eingetroffen');
        }
        loadComments(mp.id);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'media_package_comments',
        filter: `media_package_id=eq.${mp.id}`,
      }, () => loadComments(mp.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mp?.id, loadComments, orderId]);

  const markIdsRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase
      .from('media_package_comments')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    if (mp?.id) loadComments(mp.id);
    toast.success(ids.length === 1 ? 'Als gelesen markiert' : `${ids.length} als gelesen markiert`);
  }, [mp?.id, loadComments]);

  const markAllRead = () => markIdsRead(unread.map(u => u.id));

  const scrollToSection = (key: string) => {
    const el = document.getElementById(`mp-section-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-2', 'ring-amber-500/60');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500/60'), 1800);
  };

  const createPackage = async () => {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('media_packages').insert({
      order_id: orderId,
      customer_id: customerId,
      status: 'not_started',
      created_by: userData.user?.id,
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mediapaket erstellt');
    setMp(data);
    load();
  };

  const copyCustomerLink = async () => {
    if (!mp?.id) return;
    setIssuing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mediapaket-portal', {
        body: { action: 'issue_token', mp_id: mp.id },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Fehler');
      const fullUrl = `${window.location.origin}${data.url}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Kundenlink kopiert', { description: fullUrl });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIssuing(false);
    }
  };

  const [emailing, setEmailing] = useState(false);
  const emailCustomerLink = async () => {
    if (!mp?.id) return;
    if (!confirm('Kundenlink per E-Mail an den Kunden versenden?')) return;
    setEmailing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mediapaket-portal', {
        body: { action: 'notify_customer', mp_id: mp.id, base_url: window.location.origin },
      });
      if (error || !data?.ok) throw new Error(error?.message || data?.error || 'Fehler');
      toast.success('E-Mail gesendet an ' + data.email);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setEmailing(false); }
  };

  // Internal staff-only thread
  const [internalDraft, setInternalDraft] = useState('');
  const [postingInternal, setPostingInternal] = useState(false);
  const postInternal = async () => {
    const text = internalDraft.trim();
    if (!text || !mp?.id) return;
    setPostingInternal(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('media_package_comments').insert({
      media_package_id: mp.id,
      author_id: userData.user?.id ?? null,
      author_type: 'staff',
      recipient_type: 'staff',
      internal_only: true,
      subject: null,
      comment: text,
    });
    setPostingInternal(false);
    if (error) { toast.error(error.message); return; }
    setInternalDraft('');
    loadComments(mp.id);
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Mediapaket...</div>;
  }

  if (!mp) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
        <PackageIcon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Kein Mediapaket vorhanden</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Erstelle ein neues Mediapaket für diesen Auftrag und teile den Kundenlink zur Datenerfassung.
        </p>
        <Button onClick={createPackage} disabled={creating} className="gold-gradient text-primary-foreground">
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Mediapaket erstellen
        </Button>
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[mp.status] ?? mp.status;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 card-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PackageIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Mediapaket</h3>
              <Badge variant="outline">{statusLabel}</Badge>
              {mp.submitted_at && <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Eingereicht</Badge>}
              {unread.length > 0 && (
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 animate-pulse">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  {unread.length} neue Kundenantwort{unread.length === 1 ? '' : 'en'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">ID: {mp.id}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Aktualisieren</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`/mediapaket/print/${mp.id}`, '_blank')}>
              <FileText className="w-4 h-4 mr-2" />PDF-Export
            </Button>
            <Button variant="outline" size="sm" onClick={emailCustomerLink} disabled={emailing}>
              {emailing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Per E-Mail senden
            </Button>
            <Button size="sm" onClick={copyCustomerLink} disabled={issuing} className="gold-gradient text-primary-foreground">
              {issuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
              Kundenlink kopieren
            </Button>
          </div>
        </div>
        {/* Assignment + Due date */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Zuständig</label>
              <Select value={mp.assigned_user_id ?? '__none__'} onValueChange={(v) => assignUser(v === '__none__' ? null : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nicht zugewiesen" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">— Nicht zugewiesen —</SelectItem>
                  {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className={cn('w-4 h-4 shrink-0', mp.due_date && new Date(mp.due_date) < new Date() && mp.status !== 'completed' ? 'text-red-500' : 'text-muted-foreground')} />
            <div className="flex-1 min-w-0">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Frist</label>
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('h-8 text-xs justify-start flex-1', !mp.due_date && 'text-muted-foreground')}>
                      {mp.due_date ? format(new Date(mp.due_date), 'dd.MM.yyyy') : 'Frist setzen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={mp.due_date ? new Date(mp.due_date) : undefined} onSelect={setDueDate} initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
                {mp.due_date && (
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setDueDate(undefined)}>×</Button>
                )}
              </div>
            </div>
          </div>
        </div>
        {mp.due_date && new Date(mp.due_date) < new Date() && mp.status !== 'completed' && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-400">Frist überschritten seit {format(new Date(mp.due_date), 'dd.MM.yyyy')}</span>
          </div>
        )}
        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Fortschritt</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full gold-gradient transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Unread customer answers banner */}
      {unread.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 card-glow">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-foreground">
                {unread.length} ungelesene Kundenantwort{unread.length === 1 ? '' : 'en'}
              </h4>
            </div>
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <Check className="w-4 h-4 mr-2" /> Alle als gelesen markieren
            </Button>
          </div>
          <div className="space-y-2">
            {unread.slice(0, 5).map(u => {
              const key = u.related_field && SECTION_LABEL[u.related_field] ? u.related_field : null;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => key ? scrollToSection(key) : undefined}
                  className={`w-full text-left rounded-lg border border-amber-500/30 bg-background/60 p-2 ${key ? 'hover:bg-background/80 hover:border-amber-500/50 cursor-pointer' : ''} transition`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {key && (
                      <Badge variant="secondary" className="text-[10px]">Bezug: {SECTION_LABEL[key]}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(u.created_at).toLocaleString('de-DE')}</span>
                  </div>
                  {u.subject && <div className="text-xs font-medium text-foreground">{u.subject}</div>}
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{u.comment}</p>
                </button>
              );
            })}
            {unread.length > 5 && (
              <p className="text-xs text-muted-foreground">…und {unread.length - 5} weitere im Kommentarverlauf unten.</p>
            )}
          </div>
        </div>
      )}

      {/* Interner Staff-Thread (nicht sichtbar für Kunde) */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 card-glow">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-sky-400" />
          <h4 className="text-sm font-semibold text-foreground">Interne Notizen (nur Team)</h4>
          <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-400">
            {internalThread.length} {internalThread.length === 1 ? 'Notiz' : 'Notizen'}
          </Badge>
        </div>
        {internalThread.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-3">Noch keine internen Notizen. Nutze diesen Bereich für Absprachen — Kunden sehen nichts davon.</p>
        ) : (
          <div className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
            {internalThread.map(c => (
              <div key={c.id} className="rounded-lg border border-sky-500/20 bg-background/60 p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">
                    {c.author_id ? (authorNames[c.author_id] || 'Mitarbeiter') : 'System'}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleString('de-DE')}</span>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.comment}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <textarea
            value={internalDraft}
            onChange={(e) => setInternalDraft(e.target.value)}
            placeholder="Interne Notiz schreiben (nur intern sichtbar)…"
            rows={2}
            className="w-full text-sm rounded-lg border border-sky-500/30 bg-background/60 p-2 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={postInternal} disabled={!internalDraft.trim() || postingInternal}>
              {postingInternal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Interne Notiz posten
            </Button>
          </div>
        </div>
      </div>

      {/* Extras: Workflow, Timeline, Versionen, Tools */}
      <MediapaketExtrasPanel mpId={mp.id} status={mp.status} onChanged={load} />

      {/* Review-Panel: Status, Kommentare, Rückfragen, Verlauf */}
      <MediapaketReviewPanel mpId={mp.id} currentStatus={mp.status} onChanged={load} />

      {/* Sections */}
      <SectionCard sectionKey="services" title="Leistungsauswahl" empty={!sections.services?.length} comments={commentsBySection.services} onMarkRead={markIdsRead}>
        {sections.services?.map((s: any) => (
          <div key={s.id} className="flex justify-between text-sm">
            <span>{s.service_type}</span>
            <span className="text-muted-foreground">{s.selected ? '✓' : '—'}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard sectionKey="studio" title="Studio-Daten" empty={!sections.studio} comments={commentsBySection.studio} onMarkRead={markIdsRead}>
        {sections.studio && <KV data={sections.studio} skip={['id','media_package_id','created_at','updated_at']} />}
      </SectionCard>

      <SectionCard sectionKey="devices" title="Geräte" empty={!sections.devices?.length} comments={commentsBySection.devices} onMarkRead={markIdsRead}>
        {sections.devices?.map((d: any) => (
          <div key={d.id} className="text-sm">
            <span className="font-medium">{d.entered_model_name || '—'}</span>
            {d.serial_number && <span className="text-muted-foreground"> · SN: {d.serial_number}</span>}
          </div>
        ))}
      </SectionCard>

      <SectionCard sectionKey="prices" title="Preisliste" empty={!sections.prices?.length} comments={commentsBySection.prices} onMarkRead={markIdsRead}>
        {sections.prices?.map((p: any) => (
          <div key={p.id} className="flex justify-between text-sm">
            <span>{p.description || p.category}</span>
            <span className="text-muted-foreground">{p.price != null ? `${p.price} €` : '—'}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard sectionKey="contact" title="Kontaktdaten" empty={!sections.contact} comments={commentsBySection.contact} onMarkRead={markIdsRead}>
        {sections.contact && <KV data={sections.contact} skip={['id','media_package_id','created_at','updated_at']} />}
      </SectionCard>

      <SectionCard sectionKey="hours" title="Öffnungszeiten" empty={!sections.hours?.length} comments={commentsBySection.hours} onMarkRead={markIdsRead}>
        {sections.hours?.map((h: any) => (
          <div key={h.id} className="flex justify-between text-sm">
            <span>Tag {h.weekday}</span>
            <span className="text-muted-foreground">
              {h.closed ? 'Geschlossen' : `${h.first_start ?? ''}–${h.first_end ?? ''}${h.second_start ? ` / ${h.second_start}–${h.second_end ?? ''}` : ''}`}
            </span>
          </div>
        ))}
      </SectionCard>

      <SectionCard sectionKey="treatments" title="Fremdbehandlungen" empty={!sections.treatments?.length} comments={commentsBySection.treatments} onMarkRead={markIdsRead}>
        {sections.treatments?.map((t: any) => (
          <div key={t.id} className="text-sm">{t.description || t.category}</div>
        ))}
      </SectionCard>

      <SectionCard sectionKey="team" title="Team / Über mich" empty={!sections.team?.length && !sections.branding?.about_me} comments={commentsBySection.team} onMarkRead={markIdsRead}>
        {sections.branding?.about_me && <p className="text-sm whitespace-pre-wrap">{sections.branding.about_me}</p>}
        {sections.team?.map((m: any) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</span>
            {m.role && <span className="text-muted-foreground"> · {m.role}</span>}
          </div>
        ))}
      </SectionCard>

      <SectionCard sectionKey="branding" title="Branding / Anmerkungen" empty={!sections.branding} comments={commentsBySection.branding} onMarkRead={markIdsRead}>
        {sections.branding && <KV data={sections.branding} skip={['id','media_package_id','created_at','updated_at']} />}
      </SectionCard>

      <SectionCard sectionKey="files" title="Dateien" empty={!sections.files?.length} comments={commentsBySection.files} onMarkRead={markIdsRead}>
        {sections.files?.map((f: any) => (
          <FileRow key={f.id} file={f} mpId={mp.id} />
        ))}
      </SectionCard>

      <SectionCard sectionKey="consents" title="Einwilligungen" empty={!sections.consents?.length} comments={commentsBySection.consents} onMarkRead={markIdsRead}>
        {sections.consents?.map((c: any) => (
          <div key={c.id} className="flex justify-between text-sm">
            <span>{c.consent_type}</span>
            <span className="text-muted-foreground">{c.accepted ? '✓ erteilt' : '—'}</span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, empty, children, comments, sectionKey, onMarkRead }: {
  title: string; empty?: boolean; children: React.ReactNode;
  comments?: any[]; sectionKey?: string;
  onMarkRead?: (ids: string[]) => void;
}) {
  const list = comments || [];
  const openQuestions = list.filter(c => c.author_type === 'staff' && !c.internal_only && !c.answered_at).length;
  const unreadIds = list.filter(c => c.author_type === 'customer' && !c.read_at).map(c => c.id);
  const unreadAnswers = unreadIds.length;
  return (
    <div id={sectionKey ? `mp-section-${sectionKey}` : undefined} className="rounded-xl border border-border bg-card p-4 card-glow transition-shadow scroll-mt-24">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <div className="flex items-center gap-1.5">
          {unreadAnswers > 0 && (
            <>
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 animate-pulse text-[10px]">
                <MessageCircle className="w-3 h-3 mr-1" />{unreadAnswers} neue Antwort{unreadAnswers === 1 ? '' : 'en'}
              </Badge>
              {onMarkRead && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onMarkRead(unreadIds)}>
                  <Check className="w-3 h-3 mr-1" /> gelesen
                </Button>
              )}
            </>
          )}
          {openQuestions > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {openQuestions} offene Rückfrage{openQuestions === 1 ? '' : 'n'}
            </Badge>
          )}
        </div>
      </div>
      {empty ? <p className="text-xs text-muted-foreground">— Noch keine Angaben —</p> : <div className="space-y-1.5">{children}</div>}
      {list.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
          {list.slice(0, 4).map(c => (
            <div key={c.id} className={`rounded-lg border p-2 text-xs ${
              c.author_type === 'customer' && !c.read_at
                ? 'border-amber-500/40 bg-amber-500/10'
                : c.internal_only
                  ? 'border-border/40 bg-secondary/40'
                  : 'border-border/40 bg-background/40'
            }`}>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge variant="outline" className="capitalize text-[10px]">{c.author_type}</Badge>
                {c.internal_only && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px]"><Lock className="w-2.5 h-2.5 mr-1" />intern</Badge>}
                {c.answered_at && <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">beantwortet</Badge>}
                <span className="text-[10px] text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleString('de-DE')}</span>
              </div>
              {c.subject && <div className="text-xs font-medium text-foreground">{c.subject}</div>}
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{c.comment}</p>
            </div>
          ))}
          {list.length > 4 && (
            <p className="text-[10px] text-muted-foreground">…{list.length - 4} weitere im Kommentarverlauf.</p>
          )}
        </div>
      )}
    </div>
  );
}

function KV({ data, skip = [] }: { data: Record<string, any>; skip?: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      {Object.entries(data).filter(([k, v]) => !skip.includes(k) && v !== null && v !== '' && v !== false).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-border/40 py-1">
          <span className="text-muted-foreground text-xs">{k}</span>
          <span className="text-right truncate max-w-[60%]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function FileRow({ file, mpId }: { file: any; mpId: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [logs, setLogs] = useState<any[] | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isImage = (file.mime_type || '').startsWith('image/');
  const isPdf = file.mime_type === 'application/pdf';

  const getSignedUrl = async (): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('mediapaket-files').createSignedUrl(file.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error(error?.message || 'Signed URL fehlgeschlagen'); return null; }
    return data.signedUrl;
  };

  const logDownload = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) return;
    await supabase.from('media_package_file_downloads').insert({
      file_id: file.id,
      media_package_id: mpId,
      downloaded_by: userData.user.id,
      downloader_type: 'staff',
      user_agent: navigator.userAgent.slice(0, 500),
    });
  };

  const preview = async () => {
    setBusy(true);
    const url = await getSignedUrl();
    setBusy(false);
    if (!url) return;
    setPreviewUrl(url);
    setPreviewOpen(true);
    logDownload();
  };

  const download = async () => {
    setBusy(true);
    const url = await getSignedUrl();
    setBusy(false);
    if (!url) return;
    logDownload();
    const a = document.createElement('a');
    a.href = url;
    a.download = file.original_filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const loadLogs = async () => {
    setLogsOpen(true);
    const { data } = await supabase
      .from('media_package_file_downloads')
      .select('id, downloaded_by, downloader_type, created_at, user_agent')
      .eq('file_id', file.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const rows = data || [];
    const uids = Array.from(new Set(rows.map((r: any) => r.downloaded_by).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (uids.length) {
      const { data: profs } = await supabase.from('user_profiles').select('id, full_name, email').in('id', uids);
      (profs || []).forEach((p: any) => { names[p.id] = p.full_name || p.email || 'Mitarbeiter'; });
    }
    setLogs(rows.map((r: any) => ({ ...r, _name: r.downloaded_by ? (names[r.downloaded_by] || 'Mitarbeiter') : 'System' })));
  };

  return (
    <div className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/30 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate">
          {file.original_filename}
          <span className="text-muted-foreground text-xs ml-2">({file.category})</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {file.file_size ? `${Math.round(file.file_size / 1024)} KB` : ''}
          {file.mime_type ? ` · ${file.mime_type}` : ''}
          {file.version ? ` · v${file.version}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {(isImage || isPdf) && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={preview} disabled={busy} title="Vorschau">
            <Eye className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={download} disabled={busy} title="Herunterladen">
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={loadLogs} title="Download-Historie">
          <HistoryIcon className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="truncate">{file.original_filename}</DialogTitle></DialogHeader>
          {previewUrl && isImage && <img src={previewUrl} alt={file.original_filename} className="max-h-[75vh] w-full object-contain rounded" />}
          {previewUrl && isPdf && <iframe src={previewUrl} title={file.original_filename} className="w-full h-[75vh] rounded border border-border" />}
        </DialogContent>
      </Dialog>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Download-Historie · {file.original_filename}</DialogTitle></DialogHeader>
          {logs === null ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Downloads protokolliert.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {logs.map(l => (
                <div key={l.id} className="rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{l._name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('de-DE')}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] mr-1">{l.downloader_type}</Badge>
                    {l.user_agent && <span className="truncate inline-block max-w-full align-middle">{l.user_agent}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
