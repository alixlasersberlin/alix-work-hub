import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eig } from "@/lib/eig/store";

export default function ApiExplorer() {
  const apis = eig.list("apis");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState(apis[0]?.basePath ?? "/api/crm");
  const [token, setToken] = useState("eig_••••1234");
  const [body, setBody] = useState('{ "example": true }');
  const [resp, setResp] = useState("");
  const [saved, setSaved] = useState<Array<{ name: string; method: string; path: string; body: string }>>([]);

  const send = () => {
    const started = Date.now();
    setTimeout(() => {
      setResp(JSON.stringify({ ok: true, method, path, headers: { authorization: `Bearer ${token.slice(0,6)}…` }, echo: method === "GET" ? null : JSON.parse(body || "{}"), latencyMs: Date.now() - started }, null, 2));
      eig.logs.add({ level: "info", source: "api-explorer", message: `${method} ${path}` });
    }, 120);
  };
  const save = () => {
    const name = prompt("Beispielname?") || `sample-${saved.length + 1}`;
    setSaved([...saved, { name, method, path, body }]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">API Explorer</h1>
        <p className="text-sm text-muted-foreground mt-1">Interaktive Sandbox für alle registrierten APIs.</p>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Anfrage</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid md:grid-cols-[120px_1fr_200px] gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["GET","POST","PUT","PATCH","DELETE"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={path} onChange={(e) => setPath(e.target.value)} />
            <Input placeholder="Bearer Token" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Body (JSON)</Label>
            <textarea className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={save}>Beispiel speichern</Button>
            <Button onClick={send}>Senden</Button>
          </div>
          <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto min-h-[100px]">{resp || "// Antwort erscheint hier"}</pre>
        </CardContent>
      </Card>

      {saved.length > 0 && (
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Gespeicherte Beispiele</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {saved.map((s, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/30 py-1.5">
                <span>{s.name} · <span className="text-xs text-muted-foreground">{s.method} {s.path}</span></span>
                <Button size="sm" variant="ghost" onClick={() => { setMethod(s.method); setPath(s.path); setBody(s.body); }}>Laden</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
