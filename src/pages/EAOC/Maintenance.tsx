import { useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Maintenance() {
  const [m, setM] = useState(eaoc.maintenance.get());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Wartungsmodus</h1>
        <p className="text-sm text-muted-foreground mt-1">Nur EAOC-lokal. Beeinflusst keine bestehenden globalen Systemwartungs-Flags.</p>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl max-w-2xl">
        <CardHeader><CardTitle className="text-sm">Konfiguration</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Wartungsmodus aktiv</div>
              <div className="text-xs text-muted-foreground">Nur Administratoren behalten Zugriff.</div>
            </div>
            <Switch checked={m.active} onCheckedChange={(v) => setM({ ...m, active: v })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Hinweistext</Label>
            <Input value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Startzeit</Label>
              <Input type="datetime-local" value={m.startsAt ?? ""} onChange={(e) => setM({ ...m, startsAt: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Endzeit</Label>
              <Input type="datetime-local" value={m.endsAt ?? ""} onChange={(e) => setM({ ...m, endsAt: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => eaoc.maintenance.set(m)}>Speichern</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
