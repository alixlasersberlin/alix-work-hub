import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Download, Search, Rows3, Rows2, Rows } from "lucide-react";

export type InfinityColumn<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  cell?: (row: T) => ReactNode;
  csv?: (row: T) => string | number;
};

export type InfinityTableProps<T> = {
  rows: T[];
  columns: InfinityColumn<T>[];
  rowKey: (row: T) => string;
  searchKeys?: (keyof T & string)[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  pageSize?: number;
  exportFileName?: string;
  emptyText?: string;
  toolbarExtra?: ReactNode;
  density?: "compact" | "normal" | "comfortable";
};

type Density = "compact" | "normal" | "comfortable";

export function InfinityTable<T extends Record<string, any>>({
  rows, columns, rowKey, searchKeys, initialSort, onRowClick,
  pageSize = 50, exportFileName = "export.csv", emptyText = "Keine Daten.",
  toolbarExtra, density: initialDensity = "normal",
}: InfinityTableProps<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [density, setDensity] = useState<Density>(initialDensity);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const term = q.trim().toLowerCase();
    const keys = searchKeys ?? (columns.map(c => c.key));
    return rows.filter(r => keys.some(k => String(r[k] ?? "").toLowerCase().includes(term)));
  }, [rows, q, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sort.key]; const vb = b[sort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      return sort.dir === "asc"
        ? String(va).localeCompare(String(vb), "de", { numeric: true })
        : String(vb).localeCompare(String(va), "de", { numeric: true });
    });
    return arr;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(col: InfinityColumn<T>) {
    if (!col.sortable) return;
    setSort(s => {
      if (!s || s.key !== col.key) return { key: col.key, dir: "asc" };
      if (s.dir === "asc") return { key: col.key, dir: "desc" };
      return null;
    });
  }

  function exportCSV() {
    const head = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(";");
    const lines = sorted.map(r =>
      columns.map(c => {
        const v = c.csv ? c.csv(r) : (r[c.key] ?? "");
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(";")
    );
    const blob = new Blob(["\uFEFF" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = exportFileName; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="itable-wrap">
      <div className="itable-toolbar">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Suchen …"
            className="pl-8 h-8 text-sm"
          />
        </div>
        {toolbarExtra}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={density === "compact" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => setDensity("compact")} title="Kompakt">
            <Rows3 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={density === "normal" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => setDensity("normal")} title="Normal">
            <Rows2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={density === "comfortable" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => setDensity("comfortable")} title="Komfortabel">
            <Rows className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 gap-1" onClick={exportCSV} title="CSV-Export">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="itable-scroll">
        <table className="itable" data-density={density}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    data-sortable={c.sortable ? "true" : undefined}
                    data-align={c.align}
                    style={c.width ? { width: c.width } : undefined}
                    onClick={() => toggleSort(c)}
                  >
                    {c.header}
                    {c.sortable && (
                      <span className="sort-indicator">
                        {active ? (sort?.dir === "asc" ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />) : "↕"}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length}><div className="itable-empty">{emptyText}</div></td></tr>
            ) : paged.map((r) => (
              <tr
                key={rowKey(r)}
                data-clickable={onRowClick ? "true" : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} data-align={c.align}>
                    {c.cell ? c.cell(r) : (r[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="itable-footer">
        <div>
          {sorted.length === 0 ? "0 Einträge"
            : `${safePage * pageSize + 1}–${Math.min(sorted.length, (safePage + 1) * pageSize)} von ${sorted.length}`}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>‹ Zurück</Button>
          <span className="px-2">Seite {safePage + 1} / {pageCount}</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>Weiter ›</Button>
        </div>
      </div>
    </div>
  );
}
