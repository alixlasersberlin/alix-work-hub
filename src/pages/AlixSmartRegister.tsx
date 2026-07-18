import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type Device = {
  id: string;
  serial_number: string;
  device_name: string | null;
  device_model: string | null;
  registration_status: string;
};

type ValidateResp = {
  ok: true;
  customer: { company_name: string | null; contact_name: string | null; email: string | null; phone: string | null };
  devices: Device[];
};

export default function AlixSmartRegister() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidateResp | null>(null);

  const [asUserId, setAsUserId] = useState("");
  const [asEmail, setAsEmail] = useState("");
  const [asPhone, setAsPhone] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "AlixSmart Registrierung";
    const meta = document.querySelector('meta[name="robots"]') ?? Object.assign(document.createElement("meta"), { name: "robots" });
    meta.setAttribute("content", "noindex,nofollow");
    if (!meta.parentElement) document.head.appendChild(meta);
  }, []);

  useEffect(() => {
    if (!token) { setError("Kein Einladungs-Token in der URL."); setLoading(false); return; }
    (async () => {
      const { data: resp, error: err } = await supabase.functions.invoke("alixsmart-portal", {
        body: { action: "validate", token },
      });
      if (err || (resp as any)?.error) {
        setError((resp as any)?.error ?? err?.message ?? "Einladung konnte nicht geladen werden.");
      } else {
        const r = resp as ValidateResp;
        setData(r);
        setAsEmail(r.customer.email ?? "");
        setAsPhone(r.customer.phone ?? "");
        const initial: Record<string, boolean> = {};
        r.devices.forEach((d) => { initial[d.id] = d.registration_status !== "registered"; });
        setSelected(initial);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!asUserId.trim()) { setError("Bitte AlixSmart User-ID / Benutzername eingeben."); return; }
    setSubmitting(true);
    setError(null);
    const device_ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    const { data: resp, error: err } = await supabase.functions.invoke("alixsmart-portal", {
      body: {
        action: "register",
        token,
        alixsmart_user_id: asUserId.trim(),
        alixsmart_email: asEmail.trim() || null,
        alixsmart_phone: asPhone.trim() || null,
        device_ids,
      },
    });
    setSubmitting(false);
    if (err || (resp as any)?.error) {
      setError((resp as any)?.error ?? err?.message ?? "Registrierung fehlgeschlagen.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center mb-6 gap-2 text-primary">
          <ShieldCheck className="h-6 w-6" />
          <h1 className="text-2xl font-semibold tracking-tight">AlixSmart Registrierung</h1>
        </div>

        {loading && (
          <Card><CardContent className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
        )}

        {!loading && error && !data && (
          <Card><CardContent className="py-8"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></CardContent></Card>
        )}

        {!loading && done && (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h2 className="text-xl font-semibold">Vielen Dank!</h2>
              <p className="text-muted-foreground max-w-md">Ihre AlixSmart-Registrierung ist abgeschlossen. Sie können dieses Fenster jetzt schließen.</p>
            </CardContent>
          </Card>
        )}

        {!loading && data && !done && (
          <Card>
            <CardHeader>
              <CardTitle>Willkommen{data.customer.contact_name ? `, ${data.customer.contact_name}` : ""}</CardTitle>
              <CardDescription>
                Bestätigen Sie Ihre AlixSmart-Zugangsdaten und wählen Sie die Geräte, die Sie registrieren möchten.
                {data.customer.company_name ? ` (${data.customer.company_name})` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asuser">AlixSmart Benutzer-ID / Login</Label>
                  <Input id="asuser" value={asUserId} onChange={(e) => setAsUserId(e.target.value)} placeholder="z.B. m.mueller" maxLength={128} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asemail">E-Mail (AlixSmart)</Label>
                  <Input id="asemail" type="email" value={asEmail} onChange={(e) => setAsEmail(e.target.value)} maxLength={255} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="asphone">Telefon (optional)</Label>
                  <Input id="asphone" value={asPhone} onChange={(e) => setAsPhone(e.target.value)} maxLength={64} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Geräte auswählen</Label>
                {data.devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Geräte hinterlegt.</p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {data.devices.map((d) => (
                      <label key={d.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
                        <Checkbox
                          checked={!!selected[d.id]}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [d.id]: !!v }))}
                          disabled={d.registration_status === "registered"}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.device_name || d.device_model || "Gerät"}</div>
                          <div className="text-xs text-muted-foreground truncate">SN: {d.serial_number}</div>
                        </div>
                        {d.registration_status === "registered" && (
                          <span className="text-xs text-primary font-medium">bereits registriert</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Registrierung abschließen
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">Ihre Daten werden vertraulich behandelt.</p>
      </div>
    </div>
  );
}
