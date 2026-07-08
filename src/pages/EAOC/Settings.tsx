import { useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EaocSettings() {
  const current = eaoc.list("system_settings")[0] ?? { id: "sys_general", name: "System" };
  const [d, setD] = useState<any>(current);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Systemeinstellungen</h1>
        <p className="text-sm text-muted-foreground mt-1">Sprache · Zeitzone · Support-Kontakt · Theme (nur EAOC-lokal, kein Eingriff in globale Einstellungen).</p>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl max-w-2xl">
        <CardHeader><CardTitle className="text-sm">Allgemein</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1"><Label className="text-xs">Standardsprache</Label><Input value={d.defaultLocale ?? ""} onChange={(e) => setD({ ...d, defaultLocale: e.target.value })} /></div>
          <div className="grid gap-1"><Label className="text-xs">Standardzeitzone</Label><Input value={d.defaultTz ?? ""} onChange={(e) => setD({ ...d, defaultTz: e.target.value })} /></div>
          <div className="grid gap-1"><Label className="text-xs">Support-Email</Label><Input value={d.supportEmail ?? ""} onChange={(e) => setD({ ...d, supportEmail: e.target.value })} /></div>
          <div className="grid gap-1"><Label className="text-xs">Theme</Label><Input value={d.theme ?? ""} onChange={(e) => setD({ ...d, theme: e.target.value })} /></div>
          <div className="flex justify-end"><Button onClick={() => eaoc.upsert("system_settings", d)}>Speichern</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
