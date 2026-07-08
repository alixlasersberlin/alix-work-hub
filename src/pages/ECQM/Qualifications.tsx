import { useMemo } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ecqm } from "@/lib/ecqm/store";

export default function Qualifications() {
  const trainings = ecqm.trainings.list();

  const matrix = useMemo(() => {
    const employees = Array.from(new Set(trainings.map((t) => t.employee))).sort();
    const skills = Array.from(new Set(trainings.map((t) => t.training))).sort();
    const now = new Date();
    return { employees, skills, cell: (emp: string, sk: string) => {
      const t = trainings.find((x) => x.employee === emp && x.training === sk);
      if (!t) return { state: "none" as const };
      if (t.status === "abgelaufen" || (t.expiresAt && new Date(t.expiresAt) < now)) return { state: "expired" as const, t };
      if (t.expiresAt && (new Date(t.expiresAt).getTime() - now.getTime()) / 86400000 < 30) return { state: "warn" as const, t };
      if (t.status === "absolviert") return { state: "ok" as const, t };
      return { state: "open" as const, t };
    }};
  }, [trainings]);

  const clsFor: Record<string, string> = {
    ok: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
    warn: "bg-amber-500/20 text-amber-500 border-amber-500/30",
    expired: "bg-rose-500/20 text-rose-500 border-rose-500/30",
    open: "bg-muted text-muted-foreground border-border/60",
    none: "bg-transparent border-dashed border-border/40 text-muted-foreground/50",
  };

  return (
    <>
      <EcqmPageHeader title="Qualifikationsmatrix" subtitle="Mitarbeiter × Qualifikation × Ablauf – Visualisierung des Schulungsstatus." />
      <Card>
        <CardContent className="p-3 overflow-x-auto">
          <table className="text-xs min-w-full">
            <thead>
              <tr>
                <th className="p-2 text-left text-muted-foreground">Mitarbeiter</th>
                {matrix.skills.map((s) => (<th key={s} className="p-2 text-left text-muted-foreground whitespace-nowrap">{s}</th>))}
              </tr>
            </thead>
            <tbody>
              {matrix.employees.map((emp) => (
                <tr key={emp} className="border-t border-border/40">
                  <td className="p-2 font-medium whitespace-nowrap">{emp}</td>
                  {matrix.skills.map((sk) => {
                    const c = matrix.cell(emp, sk);
                    const label = c.state === "ok" ? "gültig" : c.state === "warn" ? "ablaufend" : c.state === "expired" ? "abgelaufen" : c.state === "open" ? "offen" : "-";
                    return (
                      <td key={sk} className="p-1">
                        <div className={`px-2 py-1 text-[10px] rounded border ${clsFor[c.state]}`}>
                          {label}
                          {"t" in c && c.t?.expiresAt && <div className="text-[9px] opacity-70">bis {c.t.expiresAt}</div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {matrix.employees.length === 0 && (
                <tr><td className="p-6 text-center text-muted-foreground">Noch keine Schulungsdaten.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
