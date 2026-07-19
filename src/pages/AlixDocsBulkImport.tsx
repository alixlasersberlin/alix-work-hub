import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileArchive, Loader2, CheckCircle2, XCircle, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import JSZip from "jszip";

type Candidate = { order_id: string; order_number: string; customer_name: string | null };
type Row = {
  name: string;
  size: number;
  status: "pending" | "converting" | "uploading" | "processing" | "done" | "error" | "skipped";
  message?: string;
  document_id?: string;
  match_score?: number;
  match_confidence?: string;
  candidates?: Candidate[];
  selected_order_id?: string;
  scanning?: boolean;
};

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};
const DOC_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
};

const guessMime = (name: string): string | null => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return IMAGE_MIME[ext] ?? DOC_MIME[ext] ?? (ext === "heic" || ext === "heif" ? "image/heic" : null);
};

async function heicToJpeg(blob: Blob): Promise<Blob> {
  const mod: any = await import("heic2any");
  const fn = mod.default ?? mod;
  const out = await fn({ blob, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

export default function AlixDocsBulkImport() {
  const [category, setCategory] = useState("sonstiges");
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const collectFiles = useCallback(async (files: FileList): Promise<{ name: string; blob: Blob }[]> => {
    const out: { name: string; blob: Blob }[] = [];
    for (const f of Array.from(files)) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(f);
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          if (entry.name.startsWith("__MACOSX/") || entry.name.split("/").pop()?.startsWith(".")) continue;
          const blob = await entry.async("blob");
          out.push({ name: entry.name.split("/").pop() ?? entry.name, blob });
        }
      } else {
        out.push({ name: f.name, blob: f });
      }
    }
    return out;
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    toast.info("Dateien werden vorbereitet …");
    const items = await collectFiles(files);
    setRows(items.map(it => ({
      name: it.name,
      size: it.blob.size,
      status: guessMime(it.name) ? "pending" : "skipped",
      message: guessMime(it.name) ? undefined : "Dateityp wird ignoriert",
    })));
    (window as any).__bulkBlobs = items;
    setDone(0);
  };

  const run = async () => {
    const items: { name: string; blob: Blob }[] = (window as any).__bulkBlobs ?? [];
    if (items.length === 0) { toast.error("Keine Dateien"); return; }
    setRunning(true);
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      if (rows[i]?.status === "skipped") continue;
      try {
        let { name, blob } = items[i];
        let mime = guessMime(name)!;

        if (mime === "image/heic") {
          setRow(i, { status: "converting" });
          blob = await heicToJpeg(blob);
          name = name.replace(/\.(heic|heif)$/i, ".jpg");
          mime = "image/jpeg";
        }

        setRow(i, { status: "uploading" });
        const LARGE = 5 * 1024 * 1024; // >5MB → via signed upload (edge body limit ~10MB)
        let docId: string | undefined;

        if (blob.size > LARGE) {
          // 1) Signed upload URL
          const { data: sig, error: sigErr } = await supabase.functions.invoke("alixdocs-signed-upload", {
            body: { filename: name },
          });
          if (sigErr) throw sigErr;
          const { bucket, path, token } = sig as { bucket: string; path: string; token: string };
          // 2) Direct storage upload (no edge body limit)
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .uploadToSignedUrl(path, token, new File([blob], name, { type: mime }), { contentType: mime });
          if (upErr) throw upErr;
          // 3) Attach as AlixDoc
          const { data: att, error: attErr } = await supabase.functions.invoke("alixdocs-attach-from-storage", {
            body: {
              source_bucket: bucket,
              source_path: path,
              category_code: category,
              title: name,
              confidentiality_level: "normal",
              source: "bulk_import",
              order_id: orderId || undefined,
              customer_id: customerId || undefined,
            },
          });
          if (attErr) throw attErr;
          docId = (att as any)?.document_id;
          // Best-effort staging cleanup
          try { await supabase.storage.from(bucket).remove([path]); } catch {}
        } else {
          const fd = new FormData();
          fd.append("file", new File([blob], name, { type: mime }));
          fd.append("category_code", category);
          fd.append("title", name);
          fd.append("confidentiality_level", "normal");
          if (orderId) fd.append("order_id", orderId);
          if (customerId) fd.append("customer_id", customerId);
          const { data, error } = await supabase.functions.invoke("alixdocs-upload", { body: fd });
          if (error) throw error;
          docId = (data as any)?.document_id ?? (data as any)?.id;
        }
        if (!docId) throw new Error("Kein document_id zurückerhalten");

        setRow(i, { status: "processing", document_id: docId });
        await supabase.functions.invoke("alixdocs-ai-process", { body: { document_id: docId } });

        // Score holen (nach Smart-Match)
        const { data: doc } = await supabase
          .from("alixdocs_documents")
          .select("match_score,match_confidence")
          .eq("id", docId)
          .maybeSingle();

        setRow(i, {
          status: "done",
          match_score: doc?.match_score ?? undefined,
          match_confidence: doc?.match_confidence ?? undefined,
        });
        ok++;
      } catch (e: any) {
        setRow(i, { status: "error", message: e?.message ?? String(e) });
      }
      setDone(d => d + 1);
    }
    setRunning(false);
    toast.success(`${ok}/${items.length} verarbeitet`);
  };

  const total = rows.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const skip = rows.filter(r => r.status === "skipped").length;
  const err = rows.filter(r => r.status === "error").length;
  const suggested = rows.filter(r => r.match_confidence === "suggested").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileArchive className="w-6 h-6 text-primary" /> AlixDocs Bulk Import
        </h1>
        <p className="text-sm text-muted-foreground">ZIP-Archive und Einzeldateien (inkl. HEIC) auf einmal hochladen</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Standardwerte (optional)</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Kategorie-Code</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="z.B. rechnung, foto, …" />
          </div>
          <div>
            <Label>Order-ID (optional)</Label>
            <Input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <Label>Kunden-ID (optional)</Label>
            <Input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="UUID" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dateien</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/40"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">ZIP oder Dateien hierher ziehen — oder klicken</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, WEBP, HEIC, DOCX, XLSX, TXT, CSV</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".zip,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt,.csv"
              className="hidden"
              onChange={e => onFiles(e.target.files)}
            />
          </div>

          {total > 0 && (
            <>
              <div className="flex items-center gap-3">
                <Progress value={pct} className="flex-1" />
                <span className="text-sm w-16 text-right">{done}/{total}</span>
                <Button onClick={run} disabled={running || total === 0}>
                  {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Import starten
                </Button>
              </div>

              {(err > 0 || suggested > 0) && !running && (
                <Alert>
                  <AlertDescription className="flex items-center justify-between">
                    <span>{err > 0 && `${err} Fehler · `}{suggested > 0 && `${suggested} Vorschläge zum Prüfen`}{skip > 0 && ` · ${skip} übersprungen`}</span>
                    {suggested > 0 && (
                      <Link to="/dokumente/smart-review"><Button size="sm" variant="outline">Smart Review <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-[500px] overflow-y-auto border rounded-md divide-y">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(r.size / 1024).toFixed(1)} KB {r.message ? `· ${r.message}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.match_score != null && (
                        <Badge variant="outline" className={
                          r.match_confidence === "auto" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" :
                          r.match_confidence === "suggested" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                          "bg-muted"
                        }>Score {r.match_score}</Badge>
                      )}
                      {r.status === "pending" && <Badge variant="secondary">wartet</Badge>}
                      {r.status === "converting" && <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30" variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />HEIC→JPG</Badge>}
                      {r.status === "uploading" && <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30" variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Upload</Badge>}
                      {r.status === "processing" && <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30" variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />OCR + AI</Badge>}
                      {r.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {r.status === "error" && <XCircle className="w-4 h-4 text-rose-600" />}
                      {r.status === "skipped" && <Badge variant="outline">skip</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
