import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Upload, ImageIcon, Save, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type DocType = "invoice" | "offer" | "order_confirmation" | "service_report";

const DOC_TYPES: { key: DocType; label: string; hint: string }[] = [
  { key: "invoice", label: "Ausgangsrechnungen", hint: "Finance & Zoho Rechnungs-PDFs" },
  { key: "offer", label: "Angebote", hint: "Angebots-PDFs" },
  { key: "order_confirmation", label: "Auftragsbestätigungen", hint: "OC-PDFs" },
  { key: "service_report", label: "Serviceberichte / Wartung", hint: "Service- & Wartungsprotokolle" },
];

interface Settings {
  id?: string;
  doc_type: DocType;
  enabled: boolean;
  image_path: string;
  signer_name: string;
  signer_title?: string | null;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  show_name_line: boolean;
}

const DEFAULTS: Omit<Settings, "doc_type" | "image_path"> = {
  enabled: true,
  signer_name: "H. Tran",
  signer_title: "Geschäftsführung",
  pos_x: 380,
  pos_y: 90,
  width: 160,
  height: 60,
  show_name_line: true,
};

export default function DigitaleSignaturenFacsimile() {
  const [rows, setRows] = useState<Record<DocType, Settings | null>>({
    invoice: null, offer: null, order_confirmation: null, service_report: null,
  });
  const [previews, setPreviews] = useState<Record<DocType, string | null>>({
    invoice: null, offer: null, order_confirmation: null, service_report: null,
  });
  const [saving, setSaving] = useState<DocType | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data, error } = await supabase.from("sig_facsimile_settings").select("*");
    if (error) { toast.error(error.message); return; }
    const next: any = { invoice: null, offer: null, order_confirmation: null, service_report: null };
    (data || []).forEach((r: any) => { next[r.doc_type] = r; });
    setRows(next);
    // fetch preview URLs
    const previewNext: any = {};
    for (const dt of Object.keys(next) as DocType[]) {
      if (next[dt]?.image_path) {
        const { data: signed } = await supabase.storage
          .from("sig-assets")
          .createSignedUrl(next[dt].image_path, 3600);
        previewNext[dt] = signed?.signedUrl ?? null;
      } else previewNext[dt] = null;
    }
    setPreviews(previewNext);
  }

  async function onUpload(docType: DocType, file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Bitte ein Bild (PNG/JPG) wählen"); return; }
    setSaving(docType);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `facsimile/${docType}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("sig-assets").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const existing = rows[docType];
      const record: any = {
        doc_type: docType,
        image_path: path,
        enabled: existing?.enabled ?? DEFAULTS.enabled,
        signer_name: existing?.signer_name ?? DEFAULTS.signer_name,
        signer_title: existing?.signer_title ?? DEFAULTS.signer_title,
        pos_x: existing?.pos_x ?? DEFAULTS.pos_x,
        pos_y: existing?.pos_y ?? DEFAULTS.pos_y,
        width: existing?.width ?? DEFAULTS.width,
        height: existing?.height ?? DEFAULTS.height,
        show_name_line: existing?.show_name_line ?? DEFAULTS.show_name_line,
      };
      const { error } = await supabase.from("sig_facsimile_settings").upsert(record, { onConflict: "doc_type" });
      if (error) throw error;
      toast.success("Unterschrift gespeichert");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Upload fehlgeschlagen");
    } finally {
      setSaving(null);
    }
  }

  async function saveRow(docType: DocType, patch: Partial<Settings>) {
    const cur = rows[docType];
    if (!cur) { toast.error("Erst eine Unterschrift hochladen"); return; }
    setSaving(docType);
    try {
      const merged = { ...cur, ...patch };
      const { error } = await supabase.from("sig_facsimile_settings")
        .update({
          enabled: merged.enabled,
          signer_name: merged.signer_name,
          signer_title: merged.signer_title,
          pos_x: merged.pos_x, pos_y: merged.pos_y,
          width: merged.width, height: merged.height,
          show_name_line: merged.show_name_line,
        })
        .eq("id", cur.id!);
      if (error) throw error;
      toast.success("Gespeichert");
      setRows((p) => ({ ...p, [docType]: merged }));
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(null); }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/signaturen"><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Facsimile-Unterschrift</h1>
          <p className="text-sm text-muted-foreground">
            Hinterlege eine Unterschrift, die automatisch auf allen gewählten PDFs (unten rechts) eingebettet wird. Nur Super Admin.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {DOC_TYPES.map((dt) => {
          const row = rows[dt.key];
          const preview = previews[dt.key];
          return (
            <Card key={dt.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{dt.label}</CardTitle>
                    <CardDescription>{dt.hint}</CardDescription>
                  </div>
                  <Switch
                    checked={row?.enabled ?? false}
                    disabled={!row}
                    onCheckedChange={(v) => saveRow(dt.key, { enabled: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border border-dashed rounded-lg p-4 flex items-center gap-4 bg-muted/30">
                  <div className="w-40 h-20 bg-background border rounded flex items-center justify-center overflow-hidden">
                    {preview ? (
                      <img src={preview} alt="Unterschrift" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={(el) => { fileRefs.current[dt.key] = el; }}
                      type="file"
                      accept="image/png,image/jpeg"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onUpload(dt.key, f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="sm" variant="outline"
                      onClick={() => fileRefs.current[dt.key]?.click()}
                      disabled={saving === dt.key}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {row ? "Unterschrift ersetzen" : "Unterschrift hochladen"}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG mit transparentem Hintergrund empfohlen.</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name unter Linie</Label>
                    <Input
                      value={row?.signer_name ?? DEFAULTS.signer_name}
                      onChange={(e) => setRows((p) => ({ ...p, [dt.key]: { ...(p[dt.key] as any), signer_name: e.target.value } }))}
                      onBlur={(e) => row && saveRow(dt.key, { signer_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Titel (optional)</Label>
                    <Input
                      value={row?.signer_title ?? ""}
                      onChange={(e) => setRows((p) => ({ ...p, [dt.key]: { ...(p[dt.key] as any), signer_title: e.target.value } }))}
                      onBlur={(e) => row && saveRow(dt.key, { signer_title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {(["pos_x", "pos_y", "width", "height"] as const).map((k) => (
                    <div key={k}>
                      <Label className="text-xs uppercase">{k}</Label>
                      <Input
                        type="number"
                        value={row?.[k] ?? DEFAULTS[k]}
                        onChange={(e) => setRows((p) => ({ ...p, [dt.key]: { ...(p[dt.key] as any), [k]: Number(e.target.value) } }))}
                        onBlur={(e) => row && saveRow(dt.key, { [k]: Number(e.target.value) } as any)}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={row?.show_name_line ?? true}
                      disabled={!row}
                      onCheckedChange={(v) => saveRow(dt.key, { show_name_line: v })}
                    />
                    Namens-Linie anzeigen
                  </Label>
                  {saving === dt.key && <span className="text-xs text-muted-foreground flex items-center gap-1"><Save className="h-3 w-3" />speichert…</span>}
                </div>

                <p className="text-xs text-muted-foreground">
                  Position in PDF-Punkten von unten links. Standard = unten rechts (Seite letzte).
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integration</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>PDF-Generatoren rufen die Facsimile-Funktion so auf:</p>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto">
{`import { applyFacsimileToPdf } from "@/lib/facsimile/applyFacsimile";

const { bytes, applied } = await applyFacsimileToPdf(
  pdfBytes, "invoice", invoiceNumber
);`}
          </pre>
          <p>Ist die Unterschrift für den Dokumenttyp deaktiviert oder fehlt, wird das Original unverändert zurückgegeben.</p>
        </CardContent>
      </Card>
    </div>
  );
}
