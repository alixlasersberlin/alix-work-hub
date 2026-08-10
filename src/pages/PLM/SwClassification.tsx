import { Layers } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swClassificationFields } from '@/lib/plm/software';

export default function SwClassification() {
  return (
    <PlmCrudPage
      table="plm_sw_classification"
      title="Software-Sicherheitsklassifizierung (Produkt)"
      subtitle="Klassifizierung A/B/C auf Produktebene mit Begründung, externer Risikobeherrschung und Segregation."
      icon={Layers}
      fields={swClassificationFields}
      orderBy="created_at"
      defaults={{ status: 'entwurf', product_safety_class: 'B' }}
    />
  );
}
