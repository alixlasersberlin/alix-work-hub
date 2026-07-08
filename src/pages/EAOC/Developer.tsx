import { useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import EaocCrudPage from "@/components/eaoc/EaocCrudPage";

export default function Developer() {
  const [url, setUrl] = useState("https://api.alixworks.local/v1/ping");
  const [payload, setPayload] = useState('{ "hello": "world" }');
  const [resp, setResp] = useState<string>("");
  const flags = eaoc.list("feature_flags");
  const sso = eaoc.list("sso_providers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Developer Center</h1>
        <p className="text-sm text-muted-foreground mt-1">API Explorer · Webhook Tester · OAuth Clients · Feature Flags · SSO · Sandbox · Systemstatus</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">API Explorer (Sandbox)</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            <textarea className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" value={payload} onChange={(e) => setPayload(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setResp(JSON.stringify({ ok: true, echo: JSON.parse(payload || "{}"), at: new Date().toISOString() }, null, 2))}>POST</Button>
              <Button size="sm" variant="outline" onClick={() => setResp(JSON.stringify({ ok: true, at: new Date().toISOString() }, null, 2))}>GET</Button>
            </div>
            <pre className="text-xs bg-muted/30 rounded p-2 overflow-x-auto min-h-[80px]">{resp || "// Antwort erscheint hier"}</pre>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Systemstatus (Vorbereitung)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>REST API Gateway <Badge>vorbereitet</Badge></div>
            <div>GraphQL Gateway <Badge>vorbereitet</Badge></div>
            <div>Event Bus / Message Queue <Badge>vorbereitet</Badge></div>
            <div>OpenAPI Doku <Badge>vorbereitet</Badge></div>
            <div>SSO (OIDC/SAML) <Badge>vorbereitet</Badge></div>
            <div>SCIM Provisionierung <Badge>vorbereitet</Badge></div>
            <div className="text-xs text-muted-foreground pt-2">Diese Bausteine werden im Enterprise Integration Gateway (EIG) verbunden.</div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">SSO Provider</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {sso.map(s => <div key={s.id}>{s.name} · <span className="text-xs text-muted-foreground">{s.type} · {s.status}</span></div>)}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Feature Flags</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {flags.map(f => <div key={f.id} className="flex items-center justify-between"><span>{f.name}</span><Badge variant={f.enabled ? "default" : "secondary"}>{f.enabled ? "on" : "off"}</Badge></div>)}
          </CardContent>
        </Card>
      </div>

      <EaocCrudPage
        title="OAuth Clients"
        section="oauth_clients"
        fields={[
          { key: "name", label: "Name" },
          { key: "clientId", label: "Client ID" },
          { key: "grantTypes", label: "Grant Types" },
          { key: "redirects", label: "Redirects" },
        ]}
        columns={["name","clientId","grantTypes","redirects"]}
      />
    </div>
  );
}
