import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/infinity/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Globe, Save, Loader2, Image as ImageIcon, Palette, Mail, Phone, MapPin,
  FileText, Link as LinkIcon, Eye,
} from "lucide-react";
import { toast } from "sonner";

type PortalConfig = {
  logo_url: string;
  portal_title: string;
  portal_subtitle: string;
  welcome_text: string;
  primary_color: string;
  support_email: string;
  support_phone: string;
  support_url: string;
  company_address: string;
  footer_text: string;
  terms_url: string;
  privacy_url: string;
  imprint_url: string;
  modules: {
    dashboard: boolean;
    devices: boolean;
    maintenance: boolean;
    repairs: boolean;
    warranty: boolean;
    documents: boolean;
    quotes: boolean;
    tickets: boolean;
    timeline: boolean;
    support: boolean;
    reviews: boolean;
  };
};

const DEFAULT_CONFIG: PortalConfig = {
  logo_url: "",
  portal_title: "Kundenportal",
  portal_subtitle: "Mein Konto bei Alix Lasers",
  welcome_text: "Willkommen in Ihrem persönlichen Kundenbereich.",
  primary_color: "",
  support_email: "service@alix-lasers.de",
  support_phone: "",
  support_url: "",
  company_address: "",
  footer_text: "",
  terms_url: "",
  privacy_url: "",
  imprint_url: "",
  modules: {
    dashboard: true,
    devices: true,
    maintenance: true,
    repairs: true,
    warranty: true,
    documents: true,
    quotes: true,
    tickets: true,
    timeline: true,
    support: true,
    reviews: true,
  },
};

const SETTINGS_KEY = "customer_portal_config";

const MODULE_LABELS: Record<keyof PortalConfig["modules"], string> = {
  dashboard: "Übersicht / Dashboard",
  devices: "Geräte",
  maintenance: "Wartungen",
  repairs: "Reparaturen",
  warranty: "Garantien",
  documents: "Dokumente",
  quotes: "Angebote",
  tickets: "Tickets",
  timeline: "Timeline / Historie",
  support: "Support",
  reviews: "Bewertungen",
};

export default function KundenportalKonfiguration() {
  const { roles, loading: authLoading } = useAuth();
  const isSuperAdmin = roles?.some((r: any) => (typeof r === "string" ? r : r?.name) === "Super Admin");

  const [cfg, setCfg] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
      if (data?.value) {
        try {
          const v = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          setCfg({
            ...DEFAULT_CONFIG,
            ...v,
            modules: { ...DEFAULT_CONFIG.modules, ...(v?.modules ?? {}) },
          });
        } catch { /* keep default */ }
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(cfg),
      }, { onConflict: "key" });
      if (error) throw error;
      toast.success("Konfiguration gespeichert");
    } catch (e: any) {
      toast.error(e.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof PortalConfig>(k: K, v: PortalConfig[K]) {
    setCfg(c => ({ ...c, [k]: v }));
  }
  function toggleModule(k: keyof PortalConfig["modules"], v: boolean) {
    setCfg(c => ({ ...c, modules: { ...c.modules, [k]: v } }));
  }

  if (authLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        icon={Globe}
        title="Kundenportal – Konfiguration"
        subtitle="Logo, Branding, Kontaktdaten und sichtbare Module zentral verwalten"
        noBreadcrumbs
        meta={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href="/portal" target="_blank" rel="noreferrer">
                <Eye className="w-4 h-4" /> Portal öffnen
              </a>
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 items-start">
                <div className="rounded-lg border border-border bg-secondary/30 h-32 flex items-center justify-center overflow-hidden">
                  {cfg.logo_url ? (
                    <img src={cfg.logo_url} alt="Logo Vorschau" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">keine Vorschau</span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Logo-URL</Label>
                  <Input
                    placeholder="https://…/logo.png"
                    value={cfg.logo_url}
                    onChange={(e) => set("logo_url", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Empfohlen: PNG/SVG, transparenter Hintergrund, max. ca. 400×120 px.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Portal-Titel</Label>
                  <Input value={cfg.portal_title} onChange={(e) => set("portal_title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Untertitel</Label>
                  <Input value={cfg.portal_subtitle} onChange={(e) => set("portal_subtitle", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs">Willkommens-Text</Label>
                  <Textarea
                    rows={3}
                    value={cfg.welcome_text}
                    onChange={(e) => set("welcome_text", e.target.value)}
                    placeholder="Wird auf der Startseite des Portals angezeigt."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1"><Palette className="w-3 h-3" /> Primärfarbe (HEX, optional)</Label>
                  <Input
                    placeholder="#0ea5e9"
                    value={cfg.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kontakt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Kontakt & Support</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Support-E-Mail</Label>
                <Input type="email" value={cfg.support_email} onChange={(e) => set("support_email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Support-Telefon</Label>
                <Input value={cfg.support_phone} onChange={(e) => set("support_phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Support-Webseite</Label>
                <Input placeholder="https://…" value={cfg.support_url} onChange={(e) => set("support_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Firmenanschrift</Label>
                <Input value={cfg.company_address} onChange={(e) => set("company_address", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Footer / Rechtliches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Footer & Rechtliches</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs">Footer-Text</Label>
                <Textarea rows={2} value={cfg.footer_text} onChange={(e) => set("footer_text", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Impressum-URL</Label>
                <Input placeholder="https://…" value={cfg.imprint_url} onChange={(e) => set("imprint_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Datenschutz-URL</Label>
                <Input placeholder="https://…" value={cfg.privacy_url} onChange={(e) => set("privacy_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">AGB-URL</Label>
                <Input placeholder="https://…" value={cfg.terms_url} onChange={(e) => set("terms_url", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Sichtbare Module */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> Sichtbare Module im Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Deaktivierte Module werden im Kundenportal-Menü ausgeblendet.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(Object.keys(MODULE_LABELS) as (keyof PortalConfig["modules"])[]).map((k) => (
                  <div key={k} className="flex items-center justify-between rounded-md border border-border px-3 py-2 bg-card">
                    <span className="text-sm">{MODULE_LABELS[k]}</span>
                    <Switch checked={cfg.modules[k]} onCheckedChange={(v) => toggleModule(k, v)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
