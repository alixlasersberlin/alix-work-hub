import { Tag } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { swReleaseFields } from '@/lib/plm/software';

export default function SwReleases() {
  return (
    <PlmCrudPage
      table="plm_sw_releases"
      title="Software Version Management"
      subtitle="Releases mit Git-Commit, Firmware-Hash, Geräte-Kompatibilität und Freigabe."
      icon={Tag}
      fields={swReleaseFields}
      orderBy="release_date"
      defaults={{ status: 'entwurf' }}
    />
  );
}
