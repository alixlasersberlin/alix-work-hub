import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Search, Users, ShoppingCart, LifeBuoy, Cpu, FileText, Package, Loader2,
} from 'lucide-react';

type Hit = {
  id: string;
  group: string;
  icon: any;
  title: string;
  subtitle?: string;
  to: string;
};

const GROUPS = ['Kunden', 'Aufträge', 'Tickets', 'Geräte', 'Dokumente', 'Belege', 'Artikel'];

/**
 * Mandantenabhängige globale Suche (Phase 4).
 * Sucht über Kunden, Aufträge, Tickets, Seriennummern, Dokumente,
 * Mandanten-Belege (CMR/Medical) und Artikel.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { current, sourceFilter } = useTenant();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tenantCode = current?.code ?? null;
  const sources = useMemo(() => sourceFilter, [sourceFilter]);

  const run = useCallback(async (term: string) => {
    const t = term.trim();
    if (t.length < 2) { setHits([]); setBusy(false); return; }
    const rid = ++reqRef.current;
    setBusy(true);
    const like = `%${t}%`;
    const out: Hit[] = [];

    const applySource = (query: any) =>
      sources && sources.length > 0 ? query.in('source_system', sources) : query;

    const showZoho = !tenantCode || ['DE', 'AT', 'VN', 'DXB'].includes(tenantCode);
    const showCmr = !tenantCode || tenantCode === 'CMR';
    const showMed = !tenantCode || tenantCode === 'MED';

    const tasks: Promise<void>[] = [];

    if (showZoho) {
      tasks.push((async () => {
        const { data } = await applySource(
          supabase.from('customers').select('id, company_name, contact_name, email, source_system')
            .or(`company_name.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`).limit(6));
        (data || []).forEach((c: any) => out.push({
          id: `cust-${c.id}`, group: 'Kunden', icon: Users,
          title: c.company_name || c.contact_name || 'Kunde',
          subtitle: c.email || c.contact_name || undefined,
          to: `/kunden/${c.id}`,
        }));
      })());

      tasks.push((async () => {
        const { data } = await applySource(
          supabase.from('orders').select('id, order_number, internal_number, order_status, source_system')
            .or(`order_number.ilike.${like},internal_number.ilike.${like}`).limit(6));
        (data || []).forEach((o: any) => out.push({
          id: `ord-${o.id}`, group: 'Aufträge', icon: ShoppingCart,
          title: o.order_number || o.internal_number || 'Auftrag',
          subtitle: o.order_status || undefined,
          to: `/auftraege/${o.id}`,
        }));
      })());

      tasks.push((async () => {
        const { data } = await supabase.from('tickets')
          .select('id, ticket_number, subject, title, status')
          .or(`ticket_number.ilike.${like},subject.ilike.${like},title.ilike.${like}`).limit(6);
        (data || []).forEach((t2: any) => out.push({
          id: `tic-${t2.id}`, group: 'Tickets', icon: LifeBuoy,
          title: t2.subject || t2.title || t2.ticket_number || 'Ticket',
          subtitle: t2.ticket_number || t2.status || undefined,
          to: `/tickets/${t2.id}`,
        }));
      })());

      tasks.push((async () => {
        const { data } = await supabase.from('lager_devices')
          .select('id, serial_number, model_name, device_status')
          .or(`serial_number.ilike.${like},model_name.ilike.${like}`).limit(6);
        (data || []).forEach((d: any) => out.push({
          id: `dev-${d.id}`, group: 'Geräte', icon: Cpu,
          title: d.serial_number || d.model_name || 'Gerät',
          subtitle: d.model_name || d.device_status || undefined,
          to: `/lager/lagergeraete?q=${encodeURIComponent(d.serial_number || d.model_name || '')}`,
        }));
      })());

      tasks.push((async () => {
        const { data } = await supabase.from('alixdocs_documents')
          .select('id, title, original_filename, serial_number')
          .or(`title.ilike.${like},original_filename.ilike.${like},serial_number.ilike.${like}`)
          .is('deleted_at', null).limit(6);
        (data || []).forEach((d: any) => out.push({
          id: `doc-${d.id}`, group: 'Dokumente', icon: FileText,
          title: d.title || d.original_filename || 'Dokument',
          subtitle: d.serial_number || undefined,
          to: `/alixdocs?doc=${d.id}`,
        }));
      })());

      tasks.push((async () => {
        const { data } = await supabase.from('alixdocs2_documents' as any)
          .select('id, title')
          .ilike('title', like).is('deleted_at', null).limit(6);
        ((data as any[]) || []).forEach((d: any) => out.push({
          id: `doc2-${d.id}`, group: 'Dokumente', icon: FileText,
          title: d.title || 'Dokument',
          subtitle: 'AlixDocs',
          to: `/alixdocs2/dokument/${d.id}`,
        }));
      })());


    }

    if (showCmr) {
      tasks.push((async () => {
        const { data } = await supabase.from('cmr_documents' as any)
          .select('id, doc_number, doc_type, customer_name')
          .or(`doc_number.ilike.${like},customer_name.ilike.${like}`).limit(5);
        ((data as any[]) || []).forEach((d: any) => out.push({
          id: `cmrdoc-${d.id}`, group: 'Belege', icon: FileText,
          title: `CMR · ${d.doc_number || d.doc_type}`,
          subtitle: d.customer_name || undefined,
          to: '/cmr/dokumente',
        }));
      })());
    }

    if (showMed) {
      tasks.push((async () => {
        const [{ data: docs }, { data: items }] = await Promise.all([
          supabase.from('med_documents' as any).select('id, doc_number, doc_type, customer_name')
            .or(`doc_number.ilike.${like},customer_name.ilike.${like}`).limit(5),
          supabase.from('med_items' as any).select('id, name, sku')
            .or(`name.ilike.${like},sku.ilike.${like}`).limit(5),
        ]);
        ((docs as any[]) || []).forEach((d: any) => out.push({
          id: `meddoc-${d.id}`, group: 'Belege', icon: FileText,
          title: `Medical · ${d.doc_number || d.doc_type}`,
          subtitle: d.customer_name || undefined,
          to: '/med/belege',
        }));
        ((items as any[]) || []).forEach((i: any) => out.push({
          id: `meditem-${i.id}`, group: 'Artikel', icon: Package,
          title: i.name, subtitle: i.sku || 'Alix Medical', to: '/med/artikel',
        }));
      })());
    }

    await Promise.allSettled(tasks);
    if (rid !== reqRef.current) return;
    setHits(out);
    setBusy(false);
  }, [sources, tenantCode]);

  useEffect(() => {
    const h = setTimeout(() => run(q), 300);
    return () => clearTimeout(h);
  }, [q, run]);

  const go = (to: string) => { setOpen(false); setQ(''); setHits([]); navigate(to); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Globale Suche"
        className="inline-flex items-center gap-2 h-9 rounded-md border border-border bg-secondary px-2 md:px-3 text-sm text-muted-foreground hover:text-foreground transition-colors md:w-[240px]"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline truncate">Suche… </span>
        <kbd className="hidden md:inline ml-auto text-[10px] border border-border rounded px-1">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={`Suchen in ${current ? current.name : 'Alix World'} …`}
              className="border-0 focus-visible:ring-0 h-12 px-0"
            />
            {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Mindestens 2 Zeichen eingeben — Kunden, Aufträge, Tickets, Seriennummern, Dokumente, Belege, Artikel.
              </div>
            )}
            {q.trim().length >= 2 && !busy && hits.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Keine Treffer</div>
            )}
            {GROUPS.map(g => {
              const items = hits.filter(h => h.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g} className="mb-2">
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">{g}</div>
                  {items.map(h => (
                    <button
                      key={h.id}
                      onClick={() => go(h.to)}
                      className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors"
                    >
                      <h.icon className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm truncate">{h.title}</span>
                      {h.subtitle && <span className="ml-auto text-xs text-muted-foreground truncate max-w-[45%]">{h.subtitle}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
