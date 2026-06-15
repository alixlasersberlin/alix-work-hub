import { useState } from "react";
import {
  Package,
  Users,
  Euro,
  TrendingUp,
  Sparkles,
  PlusCircle,
  Inbox,
  Rocket,
} from "lucide-react";
import { PageHeader } from "@/components/infinity/PageHeader";
import { KpiTile } from "@/components/infinity/KpiTile";
import { StatusBadge, type StatusKind } from "@/components/infinity/StatusBadge";
import { EmptyState } from "@/components/infinity/EmptyState";
import {
  Skeleton,
  SkeletonKpiGrid,
  SkeletonTable,
} from "@/components/infinity/Skeleton";
import { InfinityTable, type InfinityColumn } from "@/components/infinity/InfinityTable";
import { Button } from "@/components/ui/button";
import { notifyBus } from "@/hooks/useNotifications";

type Row = { id: string; order: string; customer: string; status: StatusKind; total: number };

const DEMO: Row[] = [
  { id: "1", order: "SO-2026-1042", customer: "Klinikum München",   status: "open",      total: 12450.0 },
  { id: "2", order: "SO-2026-1041", customer: "Praxis Dr. Becker",  status: "progress",  total:  3290.5 },
  { id: "3", order: "SO-2026-1040", customer: "Sanitätshaus Wien",  status: "shipped",   total:  6710.0 },
  { id: "4", order: "SO-2026-1039", customer: "Reha Zentrum Süd",   status: "done",      total: 18900.0 },
  { id: "5", order: "SO-2026-1038", customer: "Apotheke Engel",     status: "pending",   total:   840.0 },
  { id: "6", order: "SO-2026-1037", customer: "Universitätsklinik", status: "warning",   total:  5500.0 },
  { id: "7", order: "SO-2026-1036", customer: "Pflegeheim Lerchen", status: "cancelled", total:   220.0 },
];

const COLS: InfinityColumn<Row>[] = [
  { key: "order",    header: "Auftrag",  sortable: true },
  { key: "customer", header: "Kunde",    sortable: true },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusBadge kind={r.status} size="sm" />,
  },
  {
    key: "total",
    header: "Betrag",
    align: "right",
    sortable: true,
    cell: (r) => `${r.total.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`,
  },
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-amber-400/80">
      {title}
    </h2>
    {children}
  </section>
);

export default function InfinityShowcase() {
  const [showSkeleton, setShowSkeleton] = useState(false);

  const fireToast = () =>
    notifyBus.push({
      title: "Showcase-Notification",
      body: "Du hast den Notification-Bus erfolgreich getestet.",
      kind: "success",
      module: "Showcase",
    });

  const allStatuses: StatusKind[] = [
    "draft","open","pending","progress","shipped","done",
    "approved","warning","error","cancelled","onhold","neutral",
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-10">
      <PageHeader
        title="Infinity Showcase"
        subtitle="Übersicht aller Premium-Komponenten aus dem Infinity Design Engine."
        icon={Sparkles}
        meta={<StatusBadge kind="approved" label="LIVE" pulse dotOnly />}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowSkeleton((v) => !v)}>
              {showSkeleton ? "Inhalt zeigen" : "Skeleton zeigen"}
            </Button>
            <Button
              onClick={fireToast}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold"
            >
              <Rocket className="h-4 w-4 mr-2" />
              Test-Notification
            </Button>
          </>
        }
      />

      {/* KPI Tiles */}
      <Section title="KPI Tiles & Sparklines">
        {showSkeleton ? (
          <SkeletonKpiGrid count={4} gold />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Umsatz heute"
              value="42.380"
              unit="€"
              icon={Euro}
              delta={12.4}
              trend={[20, 24, 22, 28, 31, 29, 36, 42]}
              accent="gold"
            />
            <KpiTile
              label="Neue Aufträge"
              value={17}
              icon={Package}
              delta={4.2}
              trend={[3, 4, 2, 6, 5, 7, 8, 7]}
              accent="sky"
            />
            <KpiTile
              label="Aktive Kunden"
              value="1.284"
              icon={Users}
              delta={-1.8}
              deltaInverted
              trend={[12, 14, 13, 11, 15, 12, 10, 11]}
              accent="emerald"
            />
            <KpiTile
              label="Überfällig"
              value={6}
              icon={TrendingUp}
              delta={2.0}
              deltaInverted
              trend={[2, 3, 3, 4, 5, 4, 6, 6]}
              accent="rose"
            />
          </div>
        )}
      </Section>

      {/* Status Badges */}
      <Section title="Status Badges (12 Kinds × 3 Varianten)">
        <div className="rounded-2xl border border-amber-500/15 bg-background/40 backdrop-blur p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((k) => <StatusBadge key={k} kind={k} />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((k) => <StatusBadge key={k} kind={k} dotOnly pulse={k === "progress" || k === "open"} />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((k) => <StatusBadge key={k} kind={k} size="sm" bare />)}
          </div>
        </div>
      </Section>

      {/* Infinity Table */}
      <Section title="Infinity Table 2.0">
        {showSkeleton ? (
          <SkeletonTable rows={6} cols={4} />
        ) : (
          <InfinityTable<Row>
            rows={DEMO}
            columns={COLS}
            rowKey={(r) => r.id}
            searchKeys={["order", "customer"]}
            pageSize={10}
            onRowClick={(r) =>
              notifyBus.push({
                title: `Zeile geöffnet: ${r.order}`,
                body: r.customer,
                kind: "info",
                module: "Showcase",
              })
            }
          />
        )}
      </Section>

      {/* Skeletons standalone */}
      <Section title="Skeletons">
        <div className="rounded-2xl border border-amber-500/15 bg-background/40 backdrop-blur p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="title" style={{ width: "40%" }} />
              <Skeleton variant="text" style={{ width: "70%" }} />
            </div>
          </div>
          <Skeleton variant="card" gold />
        </div>
      </Section>

      {/* Empty State */}
      <Section title="Empty State">
        <EmptyState
          icon={Inbox}
          title="Noch keine Daten vorhanden"
          description="Lege deinen ersten Eintrag an, um loszulegen. Du kannst später jederzeit ändern."
          action={{ label: "Eintrag anlegen", onClick: fireToast, icon: PlusCircle }}
          secondary={{ label: "Mehr erfahren", onClick: () => {} }}
        />
      </Section>

      <p className="text-center text-[11px] text-muted-foreground pt-6">
        Tipp: <kbd className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200">?</kbd>{" "}
        für Shortcuts ·{" "}
        <kbd className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200">⌘K</kbd>{" "}
        Command Palette ·{" "}
        <kbd className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-200">⌘J</kbd>{" "}
        AI Copilot
      </p>
    </div>
  );
}
