import { Package } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swSoupFields } from '@/lib/plm/software';

export default function SwSoup() {
  return (
    <PlmCrudPage
      table="plm_sw_soup"
      title="SOUP / OTS Software (IEC 62304 §8.1.2)"
      subtitle="Fremdsoftware und Bibliotheken mit Version, Zweck, Anforderungen, bekannten Anomalien und Risikobewertung."
      icon={Package}
      fields={swSoupFields}
      orderBy="name"
      ascending
      defaults={{ status: 'in_pruefung' }}
    />
  );
}
