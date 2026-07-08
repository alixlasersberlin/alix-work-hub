import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eig } from "@/lib/eig/store";
import { Copy } from "lucide-react";

const CODE_JS = `// EIG SDK (Preview)
import { EigClient } from "@alixworks/eig-sdk";
const client = new EigClient({ apiKey: process.env.EIG_KEY });
await client.emit("customer.updated", { id: "cust_123" });
const res = await client.get("/api/customer/cust_123");`;

const CODE_CURL = `curl -X POST https://eig.alixworks/api/notify \\
  -H "Authorization: Bearer $EIG_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"user@alix","channel":"email","template":"welcome"}'`;

export default function Developer() {
  const apis = eig.list("apis");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Entwicklerportal</h1>
        <p className="text-sm text-muted-foreground mt-1">API Dokumentation · OpenAPI · SDK · Webhooks · Code-Beispiele · Sandbox</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Bereitschaft</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div className="flex items-center justify-between">OpenAPI Spezifikation <Badge variant="secondary">vorbereitet</Badge></div>
            <div className="flex items-center justify-between">SDK (JS / TS) <Badge variant="secondary">vorbereitet</Badge></div>
            <div className="flex items-center justify-between">Webhook-Dokumentation <Badge>bereit</Badge></div>
            <div className="flex items-center justify-between">Sandbox <Badge>bereit</Badge></div>
            <div className="flex items-center justify-between">Rate Limits <Badge>aktiv</Badge></div>
            <div className="flex items-center justify-between">OAuth <Badge variant="secondary">vorbereitet</Badge></div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Registrierte APIs</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {apis.map(a => (
              <div key={a.id} className="flex items-center justify-between border-b border-border/30 py-1">
                <span>{a.name} <span className="text-xs text-muted-foreground">· {a.basePath} · {a.version}</span></span>
                <Badge variant="secondary">{a.rateLimit}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Beispiel: SDK (TypeScript)</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(CODE_JS)}><Copy className="h-3.5 w-3.5 mr-1" />Kopieren</Button>
        </CardHeader>
        <CardContent><pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto">{CODE_JS}</pre></CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Beispiel: cURL</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(CODE_CURL)}><Copy className="h-3.5 w-3.5 mr-1" />Kopieren</Button>
        </CardHeader>
        <CardContent><pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto">{CODE_CURL}</pre></CardContent>
      </Card>
    </div>
  );
}
