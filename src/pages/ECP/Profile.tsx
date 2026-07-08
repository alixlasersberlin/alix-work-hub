import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function EcpProfile() {
  return (
    <Card className="p-4 space-y-4 max-w-2xl">
      <div className="text-sm font-semibold">Benutzerprofil</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Telefon</Label><Input defaultValue="+49 89 123456" /></div>
        <div><Label>Mobil</Label><Input defaultValue="+49 171 2345678" /></div>
        <div className="sm:col-span-2"><Label>E-Mail</Label><Input defaultValue="user@example.com" /></div>
        <div>
          <Label>Sprache</Label>
          <Select defaultValue="de">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Zeitzone</Label>
          <Select defaultValue="Europe/Berlin">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
              <SelectItem value="Europe/Vienna">Europe/Vienna</SelectItem>
              <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div>
          <div className="text-sm">Benachrichtigungen</div>
          <div className="text-xs text-muted-foreground">E-Mail und In-App</div>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">Zwei-Faktor-Authentifizierung</div>
          <div className="text-xs text-muted-foreground">Vorbereitet – Aktivierung folgt</div>
        </div>
        <Switch disabled />
      </div>
      <Button onClick={() => toast.success('Profil gespeichert')}>Speichern</Button>
    </Card>
  );
}
