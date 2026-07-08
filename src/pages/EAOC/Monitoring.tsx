import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Row = ({ label, value, status = "ok" as "ok" | "warn" | "err" }) => {
  const color = status === "ok" ? "text-emerald-400" : status === "warn" ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
};

export default function Monitoring() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Systemüberwachung</h1>
        <p className="text-sm text-muted-foreground mt-1">Live-Signalvorschau · CPU · RAM · Queues · Integrations-Status</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Infrastruktur</CardTitle></CardHeader>
          <CardContent>
            <Row label="CPU-Auslastung" value="34 %" />
            <Row label="RAM" value="6.2 / 16 GB" />
            <Row label="Antwortzeit p95" value="212 ms" />
            <Row label="Fehlerquote" value="0.12 %" />
            <Row label="Queue Backlog" value="12" />
            <Row label="Speicher" value="128 / 500 GB" />
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Dienste</CardTitle></CardHeader>
          <CardContent>
            <Row label="API Status" value="online" />
            <Row label="E-Mail Versand" value="online" />
            <Row label="Kalender Sync" value="online" />
            <Row label="WhatsApp Gateway" value="online" />
            <Row label="Stripe" value="online" />
            <Row label="Backup Service" value="online" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
