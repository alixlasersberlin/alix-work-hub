import { useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Security() {
  const policies = eaoc.list("security_policies");
  const policy = policies[0] ?? { id: "sec_pw", minLength: 12, mfa: "vorbereitet", sessionMinutes: 60, ipAllowlist: "" };
  const [draft, setDraft] = useState<any>(policy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Sicherheit</h1>
        <p className="text-sm text-muted-foreground mt-1">Passwortrichtlinien · MFA · Session · IP · Geräteverwaltung · Login-Historie</p>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl max-w-2xl">
        <CardHeader><CardTitle className="text-sm">Passwort- & Sitzungsrichtlinien</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Mindestlänge</Label>
            <Input type="number" value={draft.minLength} onChange={(e) => setDraft({ ...draft, minLength: Number(e.target.value) })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">MFA</Label>
            <Input value={draft.mfa} onChange={(e) => setDraft({ ...draft, mfa: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Session Timeout (Minuten)</Label>
            <Input type="number" value={draft.sessionMinutes} onChange={(e) => setDraft({ ...draft, sessionMinutes: Number(e.target.value) })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">IP-Allowlist (Komma-getrennt)</Label>
            <Input value={draft.ipAllowlist ?? ""} onChange={(e) => setDraft({ ...draft, ipAllowlist: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { eaoc.upsert("security_policies", draft); }}>Speichern</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Login-Historie (Vorschau)</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Anzeige der letzten Sitzungen wird aus dem globalen Auth-Log gespeist. Vorbereitet für FIDO2/WebAuthn, SSO (OIDC/SAML), SCIM, LDAP.
        </CardContent>
      </Card>
    </div>
  );
}
