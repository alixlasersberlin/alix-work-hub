import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Check, X } from 'lucide-react';
import { useMailPermissions, type MailArea, type MailAction } from '@/hooks/useMailPermissions';

const AREAS: { key: MailArea; label: string }[] = [
  { key: 'emails', label: 'E-Mails' },
  { key: 'templates', label: 'Vorlagen' },
  { key: 'campaigns', label: 'Kampagnen' },
  { key: 'automations', label: 'Automationen' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'documents', label: 'Dokumente' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'phone_notes', label: 'Telefonnotizen' },
  { key: 'tasks', label: 'Aufgaben' },
  { key: 'unsubscribes', label: 'Abmeldungen' },
  { key: 'settings', label: 'Einstellungen' },
  { key: 'audit', label: 'Audit Log' },
];

const ACTIONS: MailAction[] = ['view', 'create', 'edit', 'delete', 'send', 'export', 'manage'];
const ACTION_LABELS: Record<MailAction, string> = {
  view: 'Ansehen', create: 'Erstellen', edit: 'Bearbeiten', delete: 'Löschen',
  send: 'Senden', export: 'Exportieren', manage: 'Verwalten',
};

export default function Berechtigungen() {
  const { roles, can, mailboxes, isAdmin, isReadOnly } = useMailPermissions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Meine Berechtigungen</h2>
      </div>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground mb-2">Aktive Rollen</div>
        <div className="flex flex-wrap gap-2">
          {roles.length === 0 && <span className="text-sm text-muted-foreground">Keine Rollen</span>}
          {roles.map(r => <Badge key={r} variant={isAdmin ? 'default' : 'secondary'}>{r}</Badge>)}
          {isReadOnly && <Badge variant="outline">Read Only</Badge>}
        </div>
        <div className="text-sm text-muted-foreground mt-4 mb-2">Erlaubte Abteilungs-Postfächer</div>
        <div className="flex flex-wrap gap-2">
          {mailboxes.map(m => <Badge key={m} variant="outline">{m}@alixwork.de</Badge>)}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Bereich</th>
              {ACTIONS.map(a => <th key={a} className="p-2 text-center font-medium">{ACTION_LABELS[a]}</th>)}
            </tr>
          </thead>
          <tbody>
            {AREAS.map(area => (
              <tr key={area.key} className="border-t border-border">
                <td className="p-3 font-medium">{area.label}</td>
                {ACTIONS.map(action => {
                  const ok = can(area.key, action);
                  return (
                    <td key={action} className="p-2 text-center">
                      {ok
                        ? <Check className="w-4 h-4 mx-auto text-green-500" />
                        : <X className="w-4 h-4 mx-auto text-muted-foreground/40" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 text-xs text-muted-foreground">
        Hinweis: Die maßgebliche Rechteprüfung erfolgt serverseitig über Row-Level-Security
        (Funktionen <code>can_access_mail</code>, <code>can_send_whatsapp</code>,
        <code> can_manage_mail_campaigns</code>, <code>can_manage_mail_templates</code>,
        <code> can_view_mail_audit</code>). Diese Übersicht zeigt die UI-Anzeige.
        Alle Aktionen werden im <code>mail_audit_logs</code>-Trigger protokolliert.
      </Card>
    </div>
  );
}
