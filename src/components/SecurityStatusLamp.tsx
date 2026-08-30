import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ampel-Lampe im Header: grün = keine offenen kritischen/hohen Findings,
 * rot = Sicherheitsbedenken im System.
 */
export function SecurityStatusLamp() {
  const { data } = useQuery({
    queryKey: ["security-lamp"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("security_audit_findings")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .in("severity", ["critical", "high"]);
      if (error) return { count: 0, unknown: true };
      return { count: count ?? 0, unknown: false };
    },
  });

  const alert = (data?.count ?? 0) > 0;
  const label = alert
    ? `${data?.count} offene Sicherheits-Findings (kritisch/hoch)`
    : "Alle Sicherheitssysteme OK";

  return (
    <Link
      to="/security-center/findings"
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
    >
      <span className="relative flex h-3 w-3">
        {alert && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
        )}
        <span
          className={
            "relative inline-flex h-3 w-3 rounded-full ring-2 " +
            (alert
              ? "bg-destructive ring-destructive/30 shadow-[0_0_10px_hsl(var(--destructive))]"
              : "bg-emerald-500 ring-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.8)]")
          }
        />
      </span>
    </Link>
  );
}

export default SecurityStatusLamp;
