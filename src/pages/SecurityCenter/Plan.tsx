import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SecurityPlan() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Migrationsplan — Reihenfolge für Phase 2 ff.</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Empfohlene Reihenfolge. Jeder Schritt wird als eigene Migration mit Rollback-Skript vorbereitet und
          <strong> erst nach ausdrücklicher Freigabe</strong> aktiviert. AlixWork bleibt jederzeit produktiv.
        </p>

        <Step n={1} title="Ticket-Metadaten scopen" risk="hoch" impact="mittel"
          detail="ticket_history / ticket_participants: SELECT-Policy an tickets-Scope koppeln (JOIN + can_manage_tickets)."
          test="Techniker sieht nur Historie eigener Abteilung. Finance sieht nur eigene." />

        <Step n={2} title="Security-Core produktiv schalten" risk="niedrig" impact="niedrig"
          detail="Bestehende roles + user_roles bleiben. Zusätzlich Mapping-Job: bestehende Rollen → security_roles (Super Admin → super_admin, QM → auditor+…)."
          test="Simulation zeigt korrekte Rechte für alle 13 aktiven Rollen." />

        <Step n={3} title="Mandanten-Feld ergänzen" risk="hoch" impact="hoch"
          detail="tenant_id auf Kern-Tabellen (customers, orders, tickets, offers, finance_*) nachziehen. Backfill aus source_system (zoho_eu_1 → DE, zoho_eu_2 → AT). Erst als nullable, dann NOT NULL."
          test="Alix-DE-User sieht keine AT-Datensätze im Simulator." />

        <Step n={4} title="Klasse-4-Härtung" risk="mittel" impact="niedrig"
          detail="user_mfa_secrets, otp_challenges, customer_bank_details, alix_sign_signatures: SELECT nur eigene Zeile; DELETE ausschließlich Super Admin (heute teils breiter)."
          test="Support-User kann fremde MFA-Secrets nicht lesen." />

        <Step n={5} title="Audit-Log & 2FA-Enforcement" risk="niedrig" impact="mittel"
          detail="security_audit_log-Tabelle + Trigger auf sensiblen Tabellen. MFA-Pflicht für super_admin, finance, human_resources."
          test="Alle Änderungen an tickets/orders/finance_* erscheinen im Log. Super Admin ohne MFA wird zum Enrollment gezwungen." />

        <Step n={6} title="Storage-Signed-URLs vereinheitlichen" risk="niedrig" impact="niedrig"
          detail="Alle Buckets bereits privat. Nur Ablauf-Zeiten für signed URLs harmonisieren (Kundenportal 15 Min, Team 24 h)."
          test="Ein alter signed URL läuft ab und liefert 403." />

        <div className="rounded border p-3 bg-muted/30 text-xs">
          <strong>Stoppregel:</strong> Bevor eine Policy ersetzt wird, muss die Simulation für alle 13 produktiv genutzten Rollen den erwarteten Zugriff bestätigen. Andernfalls: nicht aktivieren.
        </div>
      </CardContent>
    </Card>
  );
}

function Step({ n, title, risk, impact, detail, test }: { n: number; title: string; risk: string; impact: string; detail: string; test: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">{n}</div>
        <div className="font-semibold">{title}</div>
        <Badge variant="outline" className="ml-auto">Risiko: {risk}</Badge>
        <Badge variant="outline">Impact: {impact}</Badge>
      </div>
      <div className="text-xs text-muted-foreground pl-8">{detail}</div>
      <div className="text-xs pl-8 mt-1"><span className="text-muted-foreground">Test:</span> {test}</div>
    </div>
  );
}
