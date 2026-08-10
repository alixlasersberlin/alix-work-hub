import { CircuitBoard } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { hwDocFields } from '@/lib/plm/software';

export default function HwDokumentation() {
  return (
    <PlmCrudPage
      table="plm_hw_docs"
      title="Hardware Documentation (IEC 60601-1)"
      subtitle="Isolationsdiagramm, Gerber-Files, PCB-Layout, Pin-out, Schaltpläne und Boards mit Version und Freigabe."
      icon={CircuitBoard}
      fields={hwDocFields}
      orderBy="created_at"
      defaults={{ approval_status: 'entwurf', doc_kind: 'schematic' }}
    />
  );
}
