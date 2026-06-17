import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3, Boxes, Building2, ClipboardList, Crown, FileText, Gauge, Home, Package,
  Receipt, Settings, ShieldCheck, Sparkles, Ticket, Truck, User, Users, Wrench,
} from "lucide-react";

type Hit =
  | { kind: "customer"; id: string; label: string; sub?: string }
  | { kind: "order"; id: string; label: string; sub?: string }
  | { kind: "ticket"; id: string; label: string; sub?: string }
  | { kind: "repair"; id: string; label: string; sub?: string }
  | { kind: "invoice"; id: string; label: string; sub?: string };

const NAV: { label: string; to: string; icon: any; roles?: string[]; group: string }[] = [
  { label: "Dashboard", to: "/dashboard", icon: Home, group: "Navigation" },
  { label: "Verkauf · Anfragen", to: "/verkauf/anfragen", icon: ClipboardList, group: "Navigation" },
  { label: "Kunden", to: "/kunden", icon: Users, group: "Navigation" },
  { label: "Aufträge", to: "/auftraege", icon: Package, group: "Navigation" },
  { label: "Tickets", to: "/tickets", icon: Ticket, group: "Navigation" },
  { label: "Tourenplanung", to: "/tourenplanung", icon: Truck, group: "Navigation" },
  { label: "Lager / Ersatzteile", to: "/lager", icon: Boxes, group: "Navigation" },
  { label: "Reparatur", to: "/reparatur", icon: Wrench, group: "Navigation" },
  { label: "Finance", to: "/finance", icon: Receipt, group: "Navigation" },
  { label: "Finance · Cockpit", to: "/finance/cockpit", icon: BarChart3, group: "Navigation" },
  { label: "Mandanten", to: "/mandanten", icon: Building2, group: "Navigation" },
  { label: "ISO 13485 / MDR", to: "/iso", icon: ShieldCheck, group: "Navigation" },
  { label: "Bug & CAPA", to: "/bug-capa", icon: ShieldCheck, group: "Navigation" },
  { label: "AI Center", to: "/ai-center", icon: Sparkles, group: "Navigation" },
  { label: "Executive Command Center", to: "/executive", icon: Crown, roles: ["Super Admin"], group: "Admin" },
  { label: "Management Dashboard", to: "/management-dashboard", icon: Gauge, roles: ["Super Admin"], group: "Admin" },
  { label: "Einstellungen", to: "/einstellungen", icon: Settings, group: "Einstellungen" },
];

export function GlobalCommandBar() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  // ⌘K / Ctrl+K Toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced live search
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const like = `%${term}%`;
        const [cust, ord, tk, rep, inv] = await Promise.all([
          supabase.from("customers" as any).select("id,customer_name,email,city").or(
            `customer_name.ilike.${like},email.ilike.${like},city.ilike.${like}`
          ).limit(6),
          supabase.from("orders" as any).select("id,order_number,customer_name,source_system").or(
            `order_number.ilike.${like},customer_name.ilike.${like}`
          ).limit(6),
          supabase.from("tickets" as any).select("id,subject,status").ilike("subject", like).limit(6),
          supabase.from("repair_orders" as any).select("id,repair_number,customer_name,device_model,repair_status").or(
            `repair_number.ilike.${like},customer_name.ilike.${like},device_model.ilike.${like}`
          ).limit(6),
          supabase.from("zoho_invoices" as any).select("id,invoice_number,customer_name,balance,status").or(
            `invoice_number.ilike.${like},customer_name.ilike.${like}`
          ).limit(6),
        ]);
        const out: Hit[] = [];
        for (const c of (cust.data ?? []) as any[]) {
          out.push({ kind: "customer", id: c.id, label: c.customer_name || c.email || c.id, sub: [c.email, c.city].filter(Boolean).join(" · ") });
        }
        for (const o of (ord.data ?? []) as any[]) {
          const at = o.source_system === "zoho_eu_2" ? "-AT" : "";
          out.push({ kind: "order", id: o.id, label: `${o.order_number || o.id}${at}`, sub: o.customer_name });
        }
        for (const t of (tk.data ?? []) as any[]) {
          out.push({ kind: "ticket", id: t.id, label: t.subject || t.id, sub: t.status });
        }
        for (const r of (rep.data ?? []) as any[]) {
          out.push({ kind: "repair", id: r.id, label: r.repair_number || r.id, sub: [r.customer_name, r.device_model, r.repair_status].filter(Boolean).join(" · ") });
        }
        for (const i of (inv.data ?? []) as any[]) {
          out.push({ kind: "invoice", id: i.id, label: i.invoice_number || i.id, sub: [i.customer_name, i.status].filter(Boolean).join(" · ") });
        }
        setHits(out);
      } catch (e) {
        console.error(e);
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [q, open]);

  const navItems = useMemo(
    () => NAV.filter(n => !n.roles || hasAnyRole(n.roles)),
    [hasAnyRole]
  );
  const navGroups = useMemo(() => {
    const m = new Map<string, typeof navItems>();
    for (const it of navItems) { const a = m.get(it.group) || []; a.push(it); m.set(it.group, a); }
    return Array.from(m.entries());
  }, [navItems]);

  const go = (to: string) => { setOpen(false); navigate(to); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Suche Kunden, Aufträge, Tickets … oder springe zu einem Modul"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Suche läuft …" : q.length >= 2 ? "Keine Treffer." : "Tippe min. 2 Zeichen für Live-Suche."}
        </CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="Live-Treffer">
              {hits.map((h) => (
                <CommandItem
                  key={`${h.kind}-${h.id}`}
                  value={`${h.kind}-${h.label}-${h.id}`}
                  onSelect={() => {
                    if (h.kind === "customer") go(`/kunden/${h.id}`);
                    else if (h.kind === "order") go(`/auftraege/${h.id}`);
                    else if (h.kind === "repair") go(`/reparatur/${h.id}`);
                    else if (h.kind === "invoice") go(`/finance/belege?invoice=${h.id}`);
                    else go(`/tickets/${h.id}`);
                  }}
                >
                  {h.kind === "customer" && <User className="mr-2 h-4 w-4 text-sky-400" />}
                  {h.kind === "order" && <FileText className="mr-2 h-4 w-4 text-amber-400" />}
                  {h.kind === "ticket" && <Ticket className="mr-2 h-4 w-4 text-rose-400" />}
                  {h.kind === "repair" && <Wrench className="mr-2 h-4 w-4 text-emerald-400" />}
                  {h.kind === "invoice" && <Receipt className="mr-2 h-4 w-4 text-violet-400" />}
                  <div className="flex flex-col">
                    <span>{h.label}</span>
                    {h.sub && <span className="text-xs text-muted-foreground">{h.sub}</span>}
                  </div>
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
                    {h.kind}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {navGroups.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((it) => (
              <CommandItem key={it.to} value={`${group}-${it.label}`} onSelect={() => go(it.to)}>
                <it.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {it.label}
                <span className="ml-auto text-[10px] text-muted-foreground">{it.to}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
