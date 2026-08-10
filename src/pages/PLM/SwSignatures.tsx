import { PenTool } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swSignatureFields } from '@/lib/plm/software';

export default function SwSignatures() {
  return (
    <PlmCrudPage
      table="plm_sw_signatures"
      title="Elektronische Freigaben & Unterschriften"
      subtitle="Revisionssicherer Nachweis: Wer hat was mit welcher Bedeutung wann freigegeben (inkl. Dokument-Hash)."
      icon={PenTool}
      fields={swSignatureFields}
      orderBy="signed_at"
      defaults={{ meaning: 'freigabe', status: 'gueltig' }}
    />
  );
}
