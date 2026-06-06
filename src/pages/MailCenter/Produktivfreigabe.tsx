import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Rocket, ShieldCheck } from 'lucide-react';
import { useMailPermissions } from '@/hooks/useMailPermissions';
import { toast } from 'sonner';

const ITEMS = [
  { key: 'domain', label: 'Domain verifiziert' },
  { key: 'resend', label: 'Resend aktiv' },
  { key: 'testmail', label: 'Testmail erfolgreich' },
  { key: 'tracking', label: 'Tracking erfolgreich' },
  { key: 'unsub', label: 'Abmeldung erfolgreich' },
  { key: 'rls', label: 'RLS aktiv' },
  { key: 'roles', label: 'Rollen geprüft' },
  { key: 'campaigns', label: 'Kampagnen getestet' },
  { key: 'automations', label: 'Automationen getestet' },
];

const STORAGE_KEY = 'mailcenter_golive_checklist';
const PROD_KEY = 'mailcenter_production_active';

export default function Produktivfreigabe() {
  const { isAdmin } = useMailPermissions();
  const [state, setState] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState(false);

  useEffect(() => {
    try { setState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch {}
    setActive(localStorage.getItem(PROD_KEY) === '1');
  }, []);

  function toggle(k: string) {
    const next = { ...state, [k]: !state[k] };
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const allChecked = ITEMS.every(i => state[i.key]);

  function activate() {
    if (!isAdmin) { toast.error('Nur Super Admin'); return; }
    if (!allChecked) { toast.error('Bitte alle Punkte prüfen'); return; }
    if (!confirm('MailCenter wirklich produktiv freigeben?')) return;
    localStorage.setItem(PROD_KEY, '1');
    setActive(true);
    toast.success('MailCenter produktiv freigegeben');
  }

  function deactivate() {
    if (!isAdmin) return;
    localStorage.removeItem(PROD_KEY);
    setActive(false);
    toast.success('Produktivmodus deaktiviert');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Rocket className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Produktivfreigabe</h2></div>
        {active && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500">PRODUKTIV AKTIV</Badge>}
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold mb-1">Sicherheitshinweis</div>
            Bitte prüfen Sie alle Versanddomains, Rechte, Abmeldelinks und Testmails vor Aktivierung.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Checkliste</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ITEMS.map(i => (
            <label key={i.key} className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={!!state[i.key]} onCheckedChange={() => toggle(i.key)} />
              <span className={state[i.key] ? 'line-through text-muted-foreground' : ''}>{i.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {!active ? (
          <Button onClick={activate} disabled={!isAdmin || !allChecked} size="lg">
            <Rocket className="w-4 h-4 mr-2" />MailCenter produktiv freigeben
          </Button>
        ) : (
          <Button onClick={deactivate} disabled={!isAdmin} variant="outline" size="lg">
            Produktivmodus deaktivieren
          </Button>
        )}
        {!isAdmin && <span className="text-sm text-muted-foreground self-center">Nur Super Admin</span>}
      </div>
    </div>
  );
}
