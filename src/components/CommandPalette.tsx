import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Users, HardDrive, Ticket, Receipt, GraduationCap, FileText, Search,
} from 'lucide-react';

type Hit = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const useDebounce = <T,>(value: T, delay = 280) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return v;
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 280);
  const navigate = useNavigate();

  // Global hotkey Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bridge: external trigger via custom event
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('a2-open-cmdk', onOpen);
    return () => window.removeEventListener('a2-open-cmdk', onOpen);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const term = `%${q.trim()}%`;
    const out: Hit[] = [];
    try {
      const [customers, devices, tickets, invoices, sessions] = await Promise.all([
        supabase.from('customers')
          .select('id, company_name, contact_name, email')
          .or(`company_name.ilike.${term},contact_name.ilike.${term},email.ilike.${term}`)
          .limit(6),
        supabase.from('lager_devices')
          .select('id, serial_number, model_name')
          .or(`serial_number.ilike.${term},model_name.ilike.${term}`)
          .limit(6),
        supabase.from('tickets')
          .select('id, ticket_number, subject')
          .or(`ticket_number.ilike.${term},subject.ilike.${term}`)
          .limit(6),
        supabase.from('zoho_invoices')
          .select('id, invoice_number, customer_name')
          .or(`invoice_number.ilike.${term},customer_name.ilike.${term}`)
          .limit(6),
        supabase.from('academy_sessions')
          .select('id, title')
          .ilike('title', term)
          .limit(5),
      ]);

      (customers.data ?? []).forEach((c: any) => out.push({
        id: `cust-${c.id}`, group: 'Kunden',
        label: c.company_name || c.contact_name || c.email || 'Kunde',
        sub: c.email || c.contact_name || undefined,
        path: `/kunden/${c.id}`, icon: Users,
      }));
      (devices.data ?? []).forEach((d: any) => out.push({
        id: `dev-${d.id}`, group: 'Geräte',
        label: d.serial_number || d.model_name || 'Gerät',
        sub: d.model_name || undefined,
        path: `/lager`, icon: HardDrive,
      }));
      (tickets.data ?? []).forEach((t: any) => out.push({
        id: `tk-${t.id}`, group: 'Tickets',
        label: t.ticket_number ? `#${t.ticket_number}` : 'Ticket',
        sub: t.subject || undefined,
        path: `/tickets/${t.id}`, icon: Ticket,
      }));
      (invoices.data ?? []).forEach((i: any) => out.push({
        id: `inv-${i.id}`, group: 'Rechnungen',
        label: i.invoice_number || 'Rechnung',
        sub: i.customer_name || undefined,
        path: `/finance/rechnungen`, icon: Receipt,
      }));
      (sessions.data ?? []).forEach((s: any) => out.push({
        id: `acad-${s.id}`, group: 'Academy',
        label: s.title || 'Schulung',
        path: `/academy`, icon: GraduationCap,
      }));
    } catch {
      /* RLS-Fehler/Offline – einfach leere Liste */
    }
    setHits(out);
    setLoading(false);
  }, []);

  useEffect(() => { runSearch(debounced); }, [debounced, runSearch]);

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const groups = ['Kunden', 'Geräte', 'Tickets', 'Rechnungen', 'Academy'] as const;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Suche Kunden, Geräte, Tickets, Rechnungen, Academy…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Suche läuft…'
            : query.trim().length < 2
              ? 'Tippe mindestens 2 Zeichen…'
              : 'Keine Treffer.'}
        </CommandEmpty>
        {groups.map((g) => {
          const items = hits.filter((h) => h.group === g);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={g} heading={g}>
              {items.map((h) => {
                const Icon = h.icon;
                return (
                  <CommandItem
                    key={h.id}
                    value={`${h.group}-${h.label}-${h.id}`}
                    onSelect={() => go(h.path)}
                  >
                    <Icon className="mr-2 h-4 w-4 opacity-70" />
                    <span>{h.label}</span>
                    {h.sub && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        {h.sub}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
              <CommandSeparator />
            </CommandGroup>
          );
        })}
        {!loading && query.trim().length >= 2 && (
          <CommandGroup heading="Direktzugriff">
            <CommandItem onSelect={() => go('/detailsuche')}>
              <Search className="mr-2 h-4 w-4 opacity-70" />
              <span>Detailsuche öffnen</span>
            </CommandItem>
            <CommandItem onSelect={() => go('/dokumente')}>
              <FileText className="mr-2 h-4 w-4 opacity-70" />
              <span>Dokumente durchsuchen</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Floating Pill-Button oben rechts (nur Aurora 2) */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      className="a2-cmdk-trigger"
      onClick={() => window.dispatchEvent(new Event('a2-open-cmdk'))}
      aria-label="Globale Suche öffnen"
    >
      <Search className="w-4 h-4" />
      <span>Suche…</span>
      <kbd>⌘K</kbd>
    </button>
  );
}
