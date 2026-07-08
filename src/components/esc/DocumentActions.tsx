import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { DOC_TEMPLATE_LABELS, downloadDocument, type EscDocTemplate, type DocContext } from '@/lib/esc/workflows/documents';

const KIND_TEMPLATES: Record<string, EscDocTemplate[]> = {
  service: ['servicebericht', 'wartungsprotokoll', 'uebergabeprotokoll'],
  lieferung: ['lieferschein', 'uebergabeprotokoll'],
  schulung: ['teilnahmebestaetigung', 'schulungsunterlagen', 'zertifikat'],
  sales: ['besuchsbericht'],
};

export function DocumentActions({ kind, context }: { kind?: string | null; context: DocContext }) {
  const key = Object.keys(KIND_TEMPLATES).find((k) => (kind || '').toLowerCase().includes(k));
  const templates: EscDocTemplate[] = key ? KIND_TEMPLATES[key] : ['besuchsbericht'];
  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <Button key={t} size="sm" variant="outline" onClick={() => downloadDocument(t, context)}>
          <FileDown className="h-3.5 w-3.5 mr-1" />{DOC_TEMPLATE_LABELS[t]}
        </Button>
      ))}
    </div>
  );
}
