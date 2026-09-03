/**
 * MAGIC SEARCH (Prompt 6) – eine serverseitige Abfrage über Kunden, Geräte,
 * Tickets, Aufträge und Conversations. Tolerant gegenüber Schreibweise,
 * Bindestrichen und Telefonformaten. Treffer werden nie automatisch geöffnet.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Loader2, History, Trash2, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { magicSearch, EMPTY_RESULTS, type MagicResults } from '@/lib/mobil/command';

const HISTORY_KEY = 'alix.magic.history';

function readHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function pushHistory(term: string) {
  const list = [term, ...readHistory().filter((t) => t !== term)].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

export default function MobilMagicSuche() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [res, setRes] = useState<MagicResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(readHistory());

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(EMPTY_RESULTS); setError(null); return; }
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await magicSearch(term);
        setRes(r);
        setError(null);
        pushHistory(term);
        setHistory(readHistory());
      } catch (e: any) {
        setError(e?.message ?? 'Suche nicht möglich.');
      } finally { setLoading(false); }
    }, 280);
    return () => window.clearTimeout(t);
  }, [q]);

  const total = useMemo(
    () => res.customers.length + res.devices.length + res.tickets.length + res.orders.length + res.conversations.length,
    [res],
  );

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><Search className="w-5 h-5" /> Magic Search</h1>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kunde, Telefon, Seriennummer, Ticket, Auftrag suchen…"
          className="pl-9 h-12 text-base"
          inputMode="search"
        />
      </div>

      {q.trim().length < 2 && history.length > 0 && (
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Letzte Suchen
            </span>
            <Button
              variant="ghost" size="sm" className="h-8 text-xs"
              onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Verlauf löschen
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <button key={h} onClick={() => setQ(h)} className="px-3 py-1.5 rounded-full border border-border text-xs min-h-[34px]">
                {h}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Nur auf diesem Gerät gespeichert.</p>
        </Card>
      )}

      {loading && <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>}
      {error && <Card className="p-4 text-sm text-destructive border-destructive/40">{error}</Card>}
      {!loading && !error && q.trim().length >= 2 && total === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Treffer.</Card>
      )}

      <Group title="Kunden" n={res.customers.length}>
        {res.customers.map((c) => (
          <Row key={c.id} onClick={() => nav(`/customers/${c.id}`)}
            title={c.company || c.contact || 'Kunde'}
            sub={[c.contact, c.number, c.email].filter(Boolean).join(' · ')}
            right={c.phone ? (
              <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} aria-label="Anrufen"
                 className="h-10 w-10 rounded-full border border-border flex items-center justify-center">
                <Phone className="h-4 w-4 text-primary" />
              </a>
            ) : null}
          />
        ))}
      </Group>

      <Group title="Geräte" n={res.devices.length}>
        {res.devices.map((d) => (
          <Row key={d.id} onClick={() => nav(`/mobil/geraet/${d.id}`)}
            title={d.model || 'Gerät'}
            sub={[d.serial, d.customer, d.status].filter(Boolean).join(' · ')} />
        ))}
      </Group>

      <Group title="Tickets" n={res.tickets.length}>
        {res.tickets.map((t) => (
          <Row key={t.id} onClick={() => nav(`/tickets?ticket=${t.id}`)}
            title={`${t.number || t.case || 'Ticket'} · ${t.subject || ''}`.trim()}
            sub={[t.customer, t.serial, t.status].filter(Boolean).join(' · ')}
            right={t.priority ? <Badge variant={t.priority === 'P1' ? 'destructive' : 'secondary'} className="text-[10px]">{t.priority}</Badge> : null} />
        ))}
      </Group>

      <Group title="Aufträge" n={res.orders.length}>
        {res.orders.map((o) => (
          <Row key={o.id} onClick={() => nav(`/orders/${o.id}`)}
            title={o.number || 'Auftrag'}
            sub={[o.status, o.magic_status ? `Magic: ${o.magic_status}` : null, o.date].filter(Boolean).join(' · ')} />
        ))}
      </Group>

      <Group title="Conversations" n={res.conversations.length}>
        {res.conversations.map((c) => (
          <Row key={c.id} onClick={() => nav(`/mobil/inbox/${c.id}`)}
            title={c.preview || 'WhatsApp-Chat'}
            sub={[c.status, c.at ? new Date(c.at).toLocaleString('de-DE') : null].filter(Boolean).join(' · ')}
            right={c.priority ? <Badge variant={c.priority === 'P1' ? 'destructive' : 'secondary'} className="text-[10px]">{c.priority}</Badge> : null} />
        ))}
      </Group>
    </div>
  );
}

function Group({ title, n, children }: { title: string; n: number; children: React.ReactNode }) {
  if (!n) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground pt-2">{title} ({n})</div>
      {children}
    </div>
  );
}

function Row({ title, sub, right, onClick }: { title: string; sub?: string; right?: React.ReactNode; onClick: () => void }) {
  return (
    <Card className="p-3 flex items-center gap-3 active:bg-muted/40 min-h-[60px]">
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium truncate">{title}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </button>
      {right}
    </Card>
  );
}
