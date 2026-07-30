import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Copy, Loader2, ShieldCheck } from "lucide-react";
import { buildEmbedSnippet, getEmbedOrigin } from "@/lib/embed-origin";

type Site = {
  id: string;
  domain: string;
  project_name: string;
  api_key: string;
  status: string;
  chat_enabled: boolean;
  analytics_enabled: boolean;
  cookieless_analytics: boolean;
  language: string;
  widget_position: string | null;
};

type CheckState = "ok" | "warn" | "fail" | "idle";

type CheckRow = {
  label: string;
  state: CheckState;
  detail: string;
};

function normHost(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) return "";
  let host = raw;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    host = raw.replace(/^https?:\/\//, "").split("/")[0];
  }
  return host.replace(/^www\./, "");
}

function StateIcon({ state }: { state: CheckState }) {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (state === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (state === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  return <span className="inline-block h-4 w-4 rounded-full border border-border" />;
}

const COMPATIBILITY: { platform: string; support: "ok" | "warn" | "fail"; where: string; note: string }[] = [
  { platform: "Statisches HTML", support: "ok", where: "vor </head> auf jeder Seite", note: "Volle Unterstützung (Tracking + Chat-API)." },
  { platform: "WordPress", support: "ok", where: "Theme header.php oder Plugin „WPCode“ → Header", note: "Bei Caching-Plugins Script vom Minify/Combine ausschließen." },
  { platform: "Shopify", support: "ok", where: "Themes → Code bearbeiten → theme.liquid vor </head>", note: "Checkout-Seiten (Shopify Plus) benötigen separates Script-Tag." },
  { platform: "Webflow", support: "ok", where: "Project Settings → Custom Code → Head", note: "Nur im veröffentlichten Projekt aktiv, nicht im Designer." },
  { platform: "Wix", support: "ok", where: "Einstellungen → Custom Code → Alle Seiten (Head)", note: "Erst nach Zustimmung im Wix-Cookie-Banner aktiv, falls aktiviert." },
  { platform: "Squarespace", support: "ok", where: "Einstellungen → Erweitert → Code-Injection → Header", note: "Business-Plan oder höher erforderlich." },
  { platform: "Jimdo / IONOS / Strato Baukasten", support: "warn", where: "Widget „HTML/Code“ auf jeder Seite", note: "Kein globaler Head – Script muss pro Seite eingebunden werden." },
  { platform: "TYPO3 / Joomla / Drupal", support: "ok", where: "Template-Head bzw. Custom-Head-Erweiterung", note: "Volle Unterstützung." },
  { platform: "React / Vue / Angular (SPA)", support: "ok", where: "index.html im <head>", note: "Seitenwechsel werden über History-API automatisch als Pageview erfasst." },
  { platform: "Next.js / Nuxt (SSR)", support: "ok", where: "next/script (strategy=\"afterInteractive\") bzw. nuxt.config head", note: "Volle Unterstützung." },
  { platform: "Google Tag Manager", support: "ok", where: "Custom-HTML-Tag, Trigger „All Pages“", note: "Consent-Mode-Trigger beachten, sonst kein Event." },
  { platform: "Framer", support: "warn", where: "Site Settings → General → Custom Code (End of head)", note: "Nur auf Custom-Domain, nicht auf framer.app-Preview." },
  { platform: "Notion-Sites / Linktree o. ä.", support: "fail", where: "—", note: "Kein eigenes Custom-Script möglich." },
  { platform: "AMP-Seiten", support: "fail", where: "—", note: "AMP erlaubt keine eigenen JS-Bundles." },
  { platform: "E-Mail-Newsletter / PDF", support: "fail", where: "—", note: "Kein JavaScript-Kontext." },
];

export default function WidgetCheckPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [matched, setMatched] = useState<Site | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ac_websites")
        .select("id, domain, project_name, api_key, status, chat_enabled, analytics_enabled, cookieless_analytics, language, widget_position")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setSites((data as any) || []);
    })();
  }, []);

  const snippet = useMemo(() => (apiKey ? buildEmbedSnippet(apiKey.trim()) : ""), [apiKey]);

  async function runCheck() {
    const key = apiKey.trim();
    if (!key) return toast.error("Bitte data-key eingeben oder Website auswählen");
    setRunning(true);
    const rows: CheckRow[] = [];
    let site: Site | null = null;

    try {
      // 1. Key registriert?
      const { data } = await supabase
        .from("ac_websites")
        .select("id, domain, project_name, api_key, status, chat_enabled, analytics_enabled, cookieless_analytics, language, widget_position")
        .eq("api_key", key)
        .maybeSingle();
      site = (data as any) || null;
      setMatched(site);
      rows.push(
        site
          ? { label: "data-key registriert", state: "ok", detail: `${site.project_name} · ${site.domain}` }
          : { label: "data-key registriert", state: "fail", detail: "Kein Eintrag in ALIX CONNECT → Webseiten gefunden." },
      );

      // 2. Status aktiv?
      if (site) {
        const active = (site.status || "").toLowerCase() === "active" || (site.status || "").toLowerCase() === "aktiv";
        rows.push({
          label: "Website-Status",
          state: active ? "ok" : "warn",
          detail: active ? "aktiv" : `Status „${site.status}“ – Events werden ggf. verworfen.`,
        });
      }

      // 3. Domain-Abgleich
      if (site) {
        const target = normHost(pageUrl || site.domain);
        const registered = normHost(site.domain);
        rows.push({
          label: "Domain-Abgleich",
          state: !target ? "warn" : target === registered ? "ok" : "fail",
          detail: !target
            ? "Keine Test-URL angegeben."
            : target === registered
              ? `${target} stimmt mit der hinterlegten Domain überein.`
              : `Test-URL „${target}“ ≠ hinterlegte Domain „${registered}“.`,
        });
      }

      // 4. Script erreichbar
      const scriptUrl = `${getEmbedOrigin()}/connect.js`;
      try {
        const res = await fetch(scriptUrl, { cache: "no-store" });
        const text = res.ok ? await res.text() : "";
        const isJs = text.includes("AlixConnect");
        rows.push({
          label: "Script erreichbar",
          state: res.ok && isJs ? "ok" : "fail",
          detail: res.ok && isJs ? `${scriptUrl} → 200 OK` : `${scriptUrl} → HTTP ${res.status}`,
        });
      } catch (e: any) {
        rows.push({ label: "Script erreichbar", state: "fail", detail: `${scriptUrl} nicht abrufbar: ${e?.message ?? e}` });
      }

      // 5. Live-Testevent an ac-track
      try {
        const { data: track, error: trackErr } = await supabase.functions.invoke("ac-track", {
          body: {
            key,
            events: [
              {
                type: "pageview",
                url: pageUrl || (site ? `https://${site.domain}/` : "https://example.com/"),
                title: "ALIX CONNECT Widget-Check",
                meta: { source: "widget_check" },
              },
            ],
          },
        });
        const accepted = (track as any)?.accepted ?? 0;
        rows.push({
          label: "Test-Event (ac-track)",
          state: !trackErr && accepted > 0 ? "ok" : "fail",
          detail: trackErr ? trackErr.message : accepted > 0 ? `Event akzeptiert (${accepted})` : `Antwort: ${JSON.stringify(track)}`,
        });
      } catch (e: any) {
        rows.push({ label: "Test-Event (ac-track)", state: "fail", detail: e?.message ?? String(e) });
      }

      // 6. Echte Events der letzten 24h
      if (site) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("ac_analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("website_id", site.id)
          .gte("created_at", since);
        rows.push({
          label: "Events letzte 24 h",
          state: (count ?? 0) > 0 ? "ok" : "warn",
          detail: `${count ?? 0} Ereignisse – 0 bedeutet meist: Snippet nicht eingebunden, Caching aktiv oder Do-Not-Track im Browser.`,
        });
      }

      // 7. Feature-Flags
      if (site) {
        rows.push({
          label: "Funktionen",
          state: site.analytics_enabled || site.chat_enabled ? "ok" : "warn",
          detail: [
            `Analytics: ${site.analytics_enabled ? "an" : "aus"}`,
            `Chat: ${site.chat_enabled ? "an" : "aus"}`,
            `Cookieless: ${site.cookieless_analytics ? "ja" : "nein"}`,
            `Position: ${site.widget_position || "bottom-right"}`,
          ].join(" · "),
        });
      }
    } finally {
      setChecks(rows);
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" /> Widget-Check
        </h2>
        <p className="text-sm text-muted-foreground">
          Prüft, ob ein data-key korrekt hinterlegt ist, ob die Domain passt und welche Seiten-Typen kompatibel sind.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prüfung starten</CardTitle>
          <CardDescription>Website auswählen oder data-key manuell einfügen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Website</Label>
              <div className="flex flex-wrap gap-2">
                {sites.length === 0 && <span className="text-sm text-muted-foreground">Keine Webseiten angelegt.</span>}
                {sites.map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant={apiKey === s.api_key ? "default" : "outline"}
                    onClick={() => {
                      setApiKey(s.api_key);
                      setPageUrl(`https://${s.domain}/`);
                    }}
                  >
                    {s.project_name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wc-url">Test-URL der Kundenseite</Label>
              <Input id="wc-url" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://kunde.de/" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wc-key">data-key</Label>
            <Input id="wc-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="ee016bd2…" className="font-mono" />
          </div>

          {snippet && (
            <div className="space-y-2">
              <Label>Einbaucode</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">{snippet}</code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(snippet);
                    toast.success("Snippet kopiert");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Button onClick={runCheck} disabled={running}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Prüfung ausführen
          </Button>
        </CardContent>
      </Card>

      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ergebnis</CardTitle>
            <CardDescription>
              {matched ? `${matched.project_name} · ${matched.domain}` : "Kein zugeordneter Website-Eintrag"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checks.map((c) => (
              <div key={c.label} className="flex items-start gap-3 rounded-md border border-border/60 p-3">
                <StateIcon state={c.state} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-sm text-muted-foreground">{c.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kompatible Seiten-Typen</CardTitle>
          <CardDescription>Wo das Snippet eingebaut wird und worauf zu achten ist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plattform</TableHead>
                <TableHead>Unterstützung</TableHead>
                <TableHead>Einbauort</TableHead>
                <TableHead>Hinweis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPATIBILITY.map((c) => (
                <TableRow key={c.platform}>
                  <TableCell className="font-medium">{c.platform}</TableCell>
                  <TableCell>
                    <Badge variant={c.support === "ok" ? "default" : c.support === "warn" ? "secondary" : "destructive"}>
                      {c.support === "ok" ? "voll" : c.support === "warn" ? "eingeschränkt" : "nicht möglich"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.where}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
