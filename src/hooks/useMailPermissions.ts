import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';

/**
 * Client-seitige MailCenter-Berechtigungsmatrix.
 * Spiegelt die SQL-Funktionen can_access_mail / can_send_whatsapp /
 * can_manage_mail_* / can_view_mail_audit aus der Datenbank.
 * RLS bleibt die maßgebliche Quelle der Wahrheit; dieser Hook dient
 * nur zur UI-Anzeige (ausblenden/deaktivieren).
 */
export type MailArea =
  | 'emails' | 'templates' | 'campaigns' | 'automations' | 'tracking'
  | 'documents' | 'whatsapp' | 'phone_notes' | 'tasks' | 'unsubscribes'
  | 'settings' | 'audit';

export type MailAction = 'view' | 'create' | 'edit' | 'delete' | 'send' | 'export' | 'manage';

const ADMIN = ['Super Admin', 'Admin'];
const GF = ['Super Admin', 'Admin', 'Geschäftsführung'];
const MAIL_ACCESS = [
  'Super Admin', 'Admin', 'Geschäftsführung', 'Marketing', 'Finance', 'Technik',
  'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Tourenplanung', 'Bestellwesen',
  'Order', 'Read Only', 'Read Only Audit',
];
const SEND_MAIL = [
  'Super Admin', 'Admin', 'Geschäftsführung', 'Marketing', 'Finance',
  'Technik', 'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Order',
];
const MANAGE_TEMPLATES = ['Super Admin', 'Admin', 'Marketing', 'Finance', 'Technik', 'Kundenservice'];
const MANAGE_CAMPAIGNS = ['Super Admin', 'Admin', 'Marketing'];
const MANAGE_DOMAINS = ['Super Admin'];
const VIEW_AUDIT = ['Super Admin', 'Geschäftsführung'];

export type Department = 'finance' | 'vertrieb' | 'service' | 'marketing' | 'personal';

export function useMailPermissions() {
  const { roles } = useAuth();

  return useMemo(() => {
    const has = (list: string[]) => roles.some(r => list.includes(r));
    const isReadOnly = roles.includes('Read Only') || roles.includes('Read Only Audit');
    const isAdmin = has(ADMIN);
    const isGF = has(GF);

    const mailboxes: Department[] = (() => {
      if (isAdmin || isGF) return ['finance', 'vertrieb', 'service', 'marketing', 'personal'];
      const out: Department[] = ['personal'];
      if (roles.includes('Finance')) out.push('finance');
      if (roles.includes('Vertrieb') || roles.includes('Order')) out.push('vertrieb');
      if (roles.includes('Technik') || roles.includes('Kundenservice') || roles.includes('Reparaturannahme')) out.push('service');
      if (roles.includes('Marketing')) out.push('marketing');
      return out;
    })();

    const can = (area: MailArea, action: MailAction): boolean => {
      if (isAdmin) return true;
      // Anzeigen
      if (action === 'view') {
        if (area === 'audit') return has(VIEW_AUDIT);
        return has(MAIL_ACCESS);
      }
      // Read-only-Rollen dürfen keinerlei schreibende Aktionen
      if (isReadOnly) return false;
      // Löschen ist immer Super Admin
      if (action === 'delete') return roles.includes('Super Admin');

      switch (area) {
        case 'emails':
          if (action === 'send' || action === 'create') return has(SEND_MAIL);
          if (action === 'edit') return has(SEND_MAIL);
          if (action === 'export') return isGF || roles.includes('Finance') || roles.includes('Marketing');
          return false;
        case 'templates':
          if (['create', 'edit', 'manage'].includes(action)) return has(MANAGE_TEMPLATES);
          return false;
        case 'campaigns':
          if (['create', 'edit', 'send', 'manage'].includes(action)) return has(MANAGE_CAMPAIGNS);
          return false;
        case 'automations':
          if (['create', 'edit', 'manage'].includes(action))
            return has(['Super Admin', 'Admin', 'Marketing', 'Finance']);
          return false;
        case 'tracking':
          if (action === 'export') return isGF || roles.includes('Marketing');
          return has(MAIL_ACCESS);
        case 'documents':
          if (action === 'create' || action === 'edit') return has(MAIL_ACCESS) && !isReadOnly;
          if (action === 'send') return has(SEND_MAIL);
          return false;
        case 'whatsapp':
          if (action === 'send' || action === 'create' || action === 'edit')
            return has(['Super Admin', 'Admin', 'Geschäftsführung', 'Finance', 'Vertrieb',
              'Marketing', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Order']);
          if (action === 'manage') return has(['Super Admin', 'Admin', 'Geschäftsführung', 'Marketing', 'Finance']);
          return false;
        case 'phone_notes':
        case 'tasks':
          if (['create', 'edit'].includes(action)) return has(MAIL_ACCESS) && !isReadOnly;
          return false;
        case 'unsubscribes':
          if (action === 'manage' || action === 'edit') return has(['Super Admin', 'Admin', 'Marketing']);
          return false;
        case 'settings':
          if (action === 'manage') return isAdmin;
          return false;
        case 'audit':
          return has(VIEW_AUDIT);
        default:
          return false;
      }
    };

    const canUseMailbox = (mb: Department) => isAdmin || isGF || mailboxes.includes(mb);

    return {
      roles,
      isAdmin,
      isGF,
      isReadOnly,
      mailboxes,
      can,
      canUseMailbox,
      canAccessMailCenter: has(MAIL_ACCESS),
    };
  }, [roles]);
}
