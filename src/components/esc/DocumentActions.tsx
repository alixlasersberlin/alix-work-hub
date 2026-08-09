import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DOC_TEMPLATE_LABELS, downloadDocument, type EscDocTemplate, type DocContext } from '@/lib/esc/workflows/documents';
import { guardDeliveryExport } from '@/lib/delivery-approval/exportGuard';
import { extractOrderNumbers } from '@/components/delivery/ReleaseStatusForOrderText';

const KIND_TEMPLATES: Record<string, EscDocTemplate[]> = {
  service: ['servicebericht', 'wartungsprotokoll', 'uebergabeprotokoll'],
  lieferung: ['lieferschein', 'uebergabeprotokoll'],
  schulung: ['teilnahmebestaetigung', 'schulungsunterlagen', 'zertifikat'],
  sales: ['besuchsbericht'],
};

/** Dokumente, die eine vollständige Auslieferungsfreigabe voraussetzen. */
const RELEASE_REQUIRED: EscDocTemplate[] = ['lieferschein', 'uebergabeprotokoll'];

export function DocumentActions({ kind, context }: { kind?: string | null; context: DocContext }) {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [busy, setBusy] = useState<EscDocTemplate | null>(null);

  const key = Object.keys(KIND_TEMPLATES).find((k) => (kind || '').toLowerCase().includes(k));
  const templates: EscDocTemplate[] = key ? KIND_TEMPLATES[key] : ['besuchsbericht'];

  async function handleDownload(t: EscDocTemplate) {
    if (RELEASE_REQUIRED.includes(t)) {
      const numbers = extractOrderNumbers(context.title, context.notes, context.customer);
      if (numbers.length) {
        setBusy(t);
        const allowed = await guardDeliveryExport({
          orderNumbers: numbers,
          isSuperAdmin,
          userId: user?.id ?? null,
          userName: (user as any)?.user_metadata?.full_name || user?.email || null,
          context: `${DOC_TEMPLATE_LABELS[t]}-Export`,
        });
        setBusy(null);
        if (!allowed) return;
      }
    }
    downloadDocument(t, context);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <Button key={t} size="sm" variant="outline" disabled={busy === t} onClick={() => void handleDownload(t)}>
          {busy === t
            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            : <FileDown className="h-3.5 w-3.5 mr-1" />}
          {DOC_TEMPLATE_LABELS[t]}
        </Button>
      ))}
    </div>
  );
}
