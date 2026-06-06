import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings, Save } from 'lucide-react';

export default function MailCenterEinstellungen() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">Einstellungen</h2>
        <p className="text-sm text-muted-foreground">Grundkonfiguration des MailCenters.</p>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Allgemein
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Standard-Absender</Label>
              <Input placeholder="finance@alixwork.de" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Antwort-Adresse</Label>
              <Input placeholder="reply@alixwork.de" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Footer-Text</Label>
              <Input placeholder="Alix Lasers GmbH · Impressum · Datenschutz" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tracking-Domain</Label>
              <Input placeholder="track.alixwork.de" disabled />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Öffnungstracking aktivieren</Label>
                <p className="text-xs text-muted-foreground">Fügt ein 1x1-Pixel zum E-Mail-HTML hinzu.</p>
              </div>
              <Switch disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Klick-Tracking aktivieren</Label>
                <p className="text-xs text-muted-foreground">Ersetzt Links durch Tracking-URLs.</p>
              </div>
              <Switch disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Doppelte Empfänger blockieren</Label>
                <p className="text-xs text-muted-foreground">Verhindert mehrfaches Senden derselben Kampagne.</p>
              </div>
              <Switch disabled />
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled><Save className="w-4 h-4 mr-2" /> Speichern</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
