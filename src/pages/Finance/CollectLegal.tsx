import { useEffect, useState } from 'react';
import { Gavel, Plus, Scale, ShieldAlert, Trash2 } from 'lucide-react';
import { useCanDelete } from '@/hooks/useCanDelete';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const fmt = (n: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n ?? 0));
const date = (d: any) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

const KIND_LABEL: Record<string, string> = { inkasso: 'Inkasso', anwalt: 'Anwalt', mahnbescheid: 'Mahnbescheid', klage: 'Klage', vollstreckung: 'Vollstreckung' };
const STATUS_VARIANT: Record<string, any> = { open: 'default', in_progress: 'secondary', recovered: 'outline', lost: 'destructive', closed: 'outline' };

export default function FinanceCollectLegal() {
  const canDelete = useCanDelete();
  const [legal, setLegal] = useState<any[]>([]);
  const [insol, setInsol] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [delTarget, setDelTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);


  const [name, setName] = useState('');
  const [kind, setKind] = useState('inkasso');
  const [partner, setPartner] = useState('');
  const [amount, setAmount] = useState('');

  const load = async () => {
    setLoading(true);
    const [l, i] = await Promise.all([
      supabase.from('collect_legal_cases' as any).select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('collect_insolvencies' as any).select('*').order('created_at', { ascending: false }).limit(300),
    ]);
    if (l.error) toast({ title: 'Laden fehlgeschlagen', description: l.error.message, variant: 'destructive' });
    setLegal((l.data as any) ?? []);
    setInsol((i.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) { toast({ title: 'Kundenname fehlt', variant: 'destructive' }); return; }
    const { error } = await supabase.from('collect_legal_cases' as any).insert({
      customer_name: name.trim(),
      kind,
      partner_name: partner.trim() || null,
      claim_amount: amount ? Number(amount.replace(',', '.')) : null,
      status: 'open',
      handed_over_at: new Date().toISOString(),
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setName(''); setPartner(''); setAmount('');
    toast({ title: 'Fall angelegt' });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'closed' || status === 'recovered' || status === 'lost') patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from('collect_legal_cases' as any).update(patch).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('collect_legal_cases' as any).delete().eq('id', delTarget.id);
    setDeleting(false);
    if (error) { toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Rechtsfall gelöscht' });
    setDelTarget(null);
    load();
  };

  const openClaims = legal.filter((r) => !['closed', 'recovered', 'lost'].includes(r.status)).reduce((a, r) => a + Number(r.claim_amount ?? 0), 0);
  const recovered = legal.reduce((a, r) => a + Number(r.recovered_amount ?? 0), 0);
  const insolSum = insol.reduce((a, r) => a + Number(r.claim_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Recht & Inkasso" subtitle="Übergaben an Anwalt/Inkasso, Titel und Insolvenzverfahren" icon={Gavel} />

      <div className="grid gap-4 md:grid-cols-3">
        <DataCard title="Offene Forderungen in Rechtsverfolgung"><div className="text-2xl font-semibold">{fmt(openClaims)}</div></DataCard>
        <DataCard title="Realisiert"><div className="text-2xl font-semibold text-emerald-500">{fmt(recovered)}</div></DataCard>
        <DataCard title="Insolvenzforderungen"><div className="text-2xl font-semibold">{fmt(insolSum)}</div></DataCard>
      </div>

      <DataCard title="Neuen Fall übergeben" icon={<Plus className="h-4 w-4 text-primary" />}>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Kunde" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Partner / Kanzlei" value={partner} onChange={(e) => setPartner(e.target.value)} />
          <Input placeholder="Forderung €" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button onClick={create}>Übergeben</Button>
        </div>
      </DataCard>

      <DataCard title={`Rechtsfälle (${legal.length})`} icon={<Scale className="h-4 w-4 text-primary" />}>
        {loading ? <SkeletonTable /> : legal.length === 0 ? (
          <EmptyState title="Keine Rechtsfälle" description="Es wurden noch keine Forderungen an Anwalt oder Inkasso übergeben." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">Kunde</th>
                  <th className="text-left">Art</th>
                  <th className="text-left">Partner</th>
                  <th className="text-left">Aktenzeichen</th>
                  <th className="text-right">Forderung</th>
                  <th className="text-right">Realisiert</th>
                  <th className="text-left">Übergeben</th>
                  <th className="text-left">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {legal.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? 'bg-muted/20' : ''}>
                    <td className="py-2 font-medium">{r.customer_name ?? '—'}</td>
                    <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td>{r.partner_name ?? '—'}</td>
                    <td className="font-mono text-xs">{r.file_number ?? '—'}</td>
                    <td className="text-right">{fmt(r.claim_amount)}</td>
                    <td className="text-right">{fmt(r.recovered_amount)}</td>
                    <td>{date(r.handed_over_at)}</td>
                    <td><Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Offen</SelectItem>
                            <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                            <SelectItem value="recovered">Realisiert</SelectItem>
                            <SelectItem value="lost">Ausfall</SelectItem>
                            <SelectItem value="closed">Abgeschlossen</SelectItem>
                          </SelectContent>
                        </Select>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Rechtsfall löschen"
                            onClick={() => setDelTarget(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard title={`Insolvenzen (${insol.length})`} icon={<ShieldAlert className="h-4 w-4 text-primary" />}>
        {insol.length === 0 ? (
          <EmptyState title="Keine Insolvenzverfahren" description="Aktuell sind keine Insolvenzen erfasst." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">Kunde</th>
                  <th className="text-left">Verwalter</th>
                  <th className="text-left">Aktenzeichen</th>
                  <th className="text-right">Forderung</th>
                  <th className="text-right">Quote</th>
                  <th className="text-left">Frist</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {insol.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? 'bg-muted/20' : ''}>
                    <td className="py-2 font-medium">{r.customer_name ?? '—'}</td>
                    <td>{r.administrator_name ?? '—'}</td>
                    <td className="font-mono text-xs">{r.file_number ?? '—'}</td>
                    <td className="text-right">{fmt(r.claim_amount)}</td>
                    <td className="text-right">{r.quota_pct != null ? `${r.quota_pct} %` : '—'}</td>
                    <td>{date(r.deadline_at)}</td>
                    <td><Badge variant="secondary">{r.status ?? '—'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <AlertDialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechtsfall löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Fall <strong>{delTarget?.customer_name ?? ''}</strong> ({KIND_LABEL[delTarget?.kind] ?? delTarget?.kind}) wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
