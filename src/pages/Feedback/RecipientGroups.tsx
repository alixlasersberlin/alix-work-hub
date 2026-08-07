import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Search, Trash2, Users, UserPlus, Send, RefreshCw } from 'lucide-react';
import { FeedbackHeader, Kpi } from './_shared';

type Group = { id: string; name: string; description: string | null; created_at: string };
type Member = {
  id: string; group_id: string; customer_id: string | null; customer_number: string | null;
  company_name: string | null; contact_name: string | null; email: string | null; source: string | null;
};
type Customer = {
  id: string; external_customer_id: string | null; company_name: string | null;
  contact_name: string | null; email: string | null; source_system: string | null;
  accounting_region: string | null; is_vip: boolean | null;
};

const PAGE_SIZES = [100, 250, 500, 1000, 2500, 5000];

export default function RecipientGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Group dialog
  const [dlgOpen, setDlgOpen] = useState(false);
  const [gName, setGName] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Customer search
  const [term, setTerm] = useState('');
  const [fSepa, setFSepa] = useState(false);
  const [fRecurring, setFRecurring] = useState(false);
  const [fVip, setFVip] = useState(false);
  const [fEmail, setFEmail] = useState(true);
  const [region, setRegion] = useState<'alle' | 'EU' | 'CH'>('alle');
  const [source, setSource] = useState<'alle' | 'zoho_eu_1' | 'zoho_eu_2'>('alle');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [maxRows, setMaxRows] = useState(1000);

  // Transfer to survey
  const [surveys, setSurveys] = useState<{ id: string; name: string }[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSurvey, setTransferSurvey] = useState('');
  const [transferring, setTransferring] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeId) || null;

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    const { data } = await (supabase as any)
      .from('survey_recipient_groups').select('id,name,description,created_at').order('created_at', { ascending: false });
    const list = (data || []) as Group[];
    setGroups(list);
    setActiveId((cur) => cur ?? list[0]?.id ?? null);
    setLoadingGroups(false);
  }, []);

  const loadMembers = useCallback(async (gid: string | null) => {
    if (!gid) { setMembers([]); return; }
    const { data } = await (supabase as any)
      .from('survey_recipient_group_members').select('*').eq('group_id', gid).order('company_name');
    setMembers((data || []) as Member[]);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { loadMembers(activeId); }, [activeId, loadMembers]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('surveys').select('id,name').is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
      setSurveys((data || []) as any);
    })();
  }, []);

  async function createGroup() {
    if (!gName.trim()) { toast.error('Bitte einen Gruppennamen eingeben'); return; }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('survey_recipient_groups')
      .insert({ name: gName.trim(), description: gDesc.trim() || null })
      .select('id,name,description,created_at').maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setGroups((g) => [data as Group, ...g]);
    setActiveId((data as Group).id);
    setDlgOpen(false); setGName(''); setGDesc('');
    toast.success('Gruppe angelegt');
  }

  async function deleteGroup(id: string) {
    if (!confirm('Gruppe wirklich löschen?')) return;
    const { error } = await (supabase as any).from('survey_recipient_groups').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setGroups((g) => g.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
    toast.success('Gruppe gelöscht');
  }

  async function runSearch() {
    setSearching(true);
    try {
      let limitIds: string[] | null = null;

      if (fSepa) {
        const { data } = await (supabase as any)
          .from('finance_sepa_mandates').select('customer_id').not('customer_id', 'is', null).limit(5000);
        const ids = Array.from(new Set((data || []).map((r: any) => r.customer_id))) as string[];
        limitIds = limitIds ? limitIds.filter((i) => ids.includes(i)) : ids;
      }

      if (fRecurring) {
        const { data } = await (supabase as any)
          .from('zoho_recurring_profiles').select('customer_id').not('customer_id', 'is', null).limit(5000);
        const zohoIds = Array.from(new Set((data || []).map((r: any) => String(r.customer_id)))) as string[];
        const matched: string[] = [];
        for (let i = 0; i < zohoIds.length; i += 400) {
          const { data: cs } = await (supabase as any)
            .from('customers').select('id').in('external_customer_id', zohoIds.slice(i, i + 400));
          (cs || []).forEach((c: any) => matched.push(c.id));
        }
        limitIds = limitIds ? limitIds.filter((i) => matched.includes(i)) : matched;
      }

      if (limitIds && limitIds.length === 0) { setResults([]); return; }

      const t = term.trim();
      const buildQuery = (from: number, to: number) => {
        let q = (supabase as any)
          .from('customers')
          .select('id,external_customer_id,company_name,contact_name,email,source_system,accounting_region,is_vip')
          .order('company_name')
          .range(from, to);
        if (limitIds) q = q.in('id', limitIds.slice(0, 1000));
        if (fVip) q = q.eq('is_vip', true);
        if (fEmail) q = q.not('email', 'is', null);
        if (region !== 'alle') q = q.in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]);
        if (source !== 'alle') q = q.eq('source_system', source);
        if (t.length >= 2) {
          q = q.or(`company_name.ilike.%${t}%,contact_name.ilike.%${t}%,email.ilike.%${t}%,external_customer_id.ilike.%${t}%`);
        }
        return q;
      };

      const CHUNK = 1000;
      const all: Customer[] = [];
      for (let from = 0; from < maxRows; from += CHUNK) {
        const to = Math.min(from + CHUNK, maxRows) - 1;
        const { data, error } = await buildQuery(from, to);
        if (error) throw error;
        const batch = (data || []) as Customer[];
        all.push(...batch);
        if (batch.length < to - from + 1) break;
      }
      setResults(all);
      setSelected({});
    } catch (e: any) {
      toast.error(e?.message || 'Suche fehlgeschlagen');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => { runSearch(); /* eslint-disable-next-line */ }, []);

  const memberIds = useMemo(() => new Set(members.map((m) => m.customer_id).filter(Boolean) as string[]), [members]);
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allChecked = results.length > 0 && results.every((r) => selected[r.id]);

  async function assignSelected() {
    if (!activeId) { toast.error('Bitte zuerst eine Gruppe wählen'); return; }
    const rows = results.filter((r) => selected[r.id] && !memberIds.has(r.id)).map((r) => ({
      group_id: activeId,
      customer_id: r.id,
      customer_number: r.external_customer_id,
      company_name: r.company_name,
      contact_name: r.contact_name,
      email: r.email,
      source: [fSepa && 'SEPA', fRecurring && 'Ratenzahler', fVip && 'VIP'].filter(Boolean).join(' + ') || 'Suche',
    }));
    if (!rows.length) { toast.info('Keine neuen Kunden zur Zuordnung'); return; }
    const { error } = await (supabase as any).from('survey_recipient_group_members').insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} Kunden zugeordnet`);
    setSelected({});
    loadMembers(activeId);
  }

  async function removeMember(id: string) {
    const { error } = await (supabase as any).from('survey_recipient_group_members').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  async function transferToSurvey() {
    if (!transferSurvey || !members.length) return;
    setTransferring(true);
    const seen = new Set<string>();
    const rows = members
      .filter((m) => {
        const mail = String(m.email ?? '').trim().toLowerCase();
        if (!mail || seen.has(mail)) return false;
        seen.add(mail);
        return true;
      })
      .map((m) => ({
        survey_id: transferSurvey,
        customer_id: m.customer_id,
        customer_number: m.customer_number,
        company_name: m.company_name,
        last_name: m.contact_name,
        email: String(m.email).trim(),
        status: 'neu',
      }));
    if (!rows.length) { setTransferring(false); toast.info('Keine Empfänger mit E-Mail-Adresse vorhanden'); return; }
    const { data: inserted, error } = await (supabase as any)
      .from('survey_recipients')
      .upsert(rows, { onConflict: 'survey_id,email', ignoreDuplicates: true })
      .select('id');
    setTransferring(false);
    if (error) { toast.error(error.message); return; }
    const added = inserted?.length ?? 0;
    toast.success(`${added} Empfänger übertragen${rows.length - added > 0 ? `, ${rows.length - added} bereits vorhanden` : ''}`);
    setTransferOpen(false);
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <FeedbackHeader
        title="Empfängerliste"
        subtitle="Empfängergruppen festlegen und Kunden gezielt zuordnen (z. B. alle Kunden mit SEPA-Mandat)."
        action={
          <Button onClick={() => setDlgOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Neue Gruppe
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Gruppen" value={groups.length} icon={Users} />
        <Kpi label="Mitglieder aktive Gruppe" value={members.length} icon={UserPlus} />
        <Kpi label="Suchtreffer" value={results.length} icon={Search} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Groups */}
        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Gruppen</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {loadingGroups && <div className="text-xs text-muted-foreground py-4">Lade…</div>}
            {!loadingGroups && groups.length === 0 && (
              <div className="text-xs text-muted-foreground py-4">Noch keine Gruppe angelegt.</div>
            )}
            {groups.map((g) => (
              <div
                key={g.id}
                className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  g.id === activeId ? 'border-primary/50 bg-primary/10' : 'border-border/60 hover:bg-accent'
                }`}
                onClick={() => setActiveId(g.id)}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{g.name}</div>
                  {g.description && <div className="text-[11px] text-muted-foreground truncate">{g.description}</div>}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Kunden suchen &amp; markieren</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8" placeholder="Firma, Name, E-Mail oder Kundennummer…" value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
                </div>
                <select value={region} onChange={(e) => setRegion(e.target.value as any)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="alle">Region: alle</option>
                  <option value="EU">Buchhaltung EU</option>
                  <option value="CH">Buchhaltung CH</option>
                </select>
                <select value={source} onChange={(e) => setSource(e.target.value as any)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="alle">Mandant: alle</option>
                  <option value="zoho_eu_1">Alix Deutschland</option>
                  <option value="zoho_eu_2">Alix Austria</option>
                </select>
                <select value={maxRows} onChange={(e) => setMaxRows(Number(e.target.value))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>max. {n} Treffer</option>)}
                </select>
                <Button onClick={runSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Suchen
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={fSepa} onCheckedChange={(v) => setFSepa(!!v)} /> SEPA-Mandat vorhanden
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={fRecurring} onCheckedChange={(v) => setFRecurring(!!v)} /> Ratenzahler / wiederkehrend
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={fVip} onCheckedChange={(v) => setFVip(!!v)} /> Nur VIP
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={fEmail} onCheckedChange={(v) => setFEmail(!!v)} /> Nur mit E-Mail
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Treffer ({results.length}) · markiert: {selectedIds.length}</CardTitle>
              <Button size="sm" onClick={assignSelected} disabled={!selectedIds.length || !activeId}>
                <UserPlus className="h-4 w-4 mr-2" />
                {activeGroup ? `Zu „${activeGroup.name}" zuordnen` : 'Gruppe wählen'}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allChecked}
                          onCheckedChange={(v) => {
                            const next: Record<string, boolean> = {};
                            if (v) results.forEach((r) => { next[r.id] = true; });
                            setSelected(next);
                          }} />
                      </TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Ansprechpartner</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Kd.-Nr.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((c) => (
                      <TableRow key={c.id} className={memberIds.has(c.id) ? 'opacity-60' : ''}>
                        <TableCell>
                          <Checkbox checked={!!selected[c.id]}
                            onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))} />
                        </TableCell>
                        <TableCell className="font-medium">{c.company_name || '—'}</TableCell>
                        <TableCell>{c.contact_name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{c.email || '—'}</TableCell>
                        <TableCell className="text-xs">{c.external_customer_id || '—'}</TableCell>
                        <TableCell>
                          {memberIds.has(c.id)
                            ? <Badge variant="outline">bereits in Gruppe</Badge>
                            : c.is_vip ? <Badge>VIP</Badge> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                    {results.length === 0 && !searching && (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Keine Treffer.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">
                Mitglieder {activeGroup ? `· ${activeGroup.name}` : ''} ({members.length})
              </CardTitle>
              <Button size="sm" variant="outline" disabled={!members.length} onClick={() => setTransferOpen(true)}>
                <Send className="h-4 w-4 mr-2" />An Umfrage übertragen
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[360px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Firma</TableHead>
                      <TableHead>Ansprechpartner</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.company_name || '—'}</TableCell>
                        <TableCell>{m.contact_name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{m.email || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.source || '—'}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Noch keine Mitglieder in dieser Gruppe.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New group dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Empfängergruppe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name (z. B. Kunden mit SEPA-Mandat)" value={gName} onChange={(e) => setGName(e.target.value)} />
            <Textarea placeholder="Beschreibung (optional)" value={gDesc} onChange={(e) => setGDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Abbrechen</Button>
            <Button onClick={createGroup} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gruppe an Umfrage übertragen</DialogTitle></DialogHeader>
          <select value={transferSurvey} onChange={(e) => setTransferSurvey(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Umfrage wählen…</option>
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{members.length} Mitglieder werden als Empfänger angelegt.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Abbrechen</Button>
            <Button onClick={transferToSurvey} disabled={!transferSurvey || transferring}>
              {transferring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Übertragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
