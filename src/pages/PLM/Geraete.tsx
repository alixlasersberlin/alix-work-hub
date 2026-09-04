import { Cpu } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { CE_STATUS, MDR_STATUS, RELEASE_STATUS, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'article_number', label: 'Artikelnummer', list: true, mono: true, required: true },
  { key: 'name', label: 'Gerätebezeichnung', list: true, required: true },
  { key: 'product_family', label: 'Produktfamilie', list: true },
  { key: 'hardware_version', label: 'Hardwareversion', group: 'Versionen' },
  { key: 'software_version', label: 'Softwareversion', group: 'Versionen' },
  { key: 'firmware_version', label: 'Firmwareversion', group: 'Versionen' },
  { key: 'version', label: 'Version', group: 'Versionen', list: true, required: true },
  { key: 'revision', label: 'Revision', group: 'Versionen', list: true },
  { key: 'ce_status', label: 'CE Status', type: 'select', options: CE_STATUS, group: 'Regulatory', list: true },
  { key: 'mdr_status', label: 'MDR Status', type: 'select', options: MDR_STATUS, group: 'Regulatory', list: true },
  { key: 'mdr_class', label: 'MDR Klasse', group: 'Regulatory' },
  { key: 'udi_di', label: 'UDI-DI', group: 'Regulatory', mono: true },
  { key: 'serial_range_from', label: 'Seriennummernkreis von', group: 'Produktion' },
  { key: 'serial_range_to', label: 'Seriennummernkreis bis', group: 'Produktion' },
  { key: 'production_start', label: 'Produktionsbeginn', type: 'date', group: 'Produktion' },
  { key: 'production_end', label: 'Produktionsende', type: 'date', group: 'Produktion' },
  { key: 'release_status', label: 'Freigabestatus', type: 'select', options: RELEASE_STATUS, group: 'Freigabe', list: true },
  { key: 'image_url', label: 'Produktbild (Upload)', type: 'image', group: 'Dokumente' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
  { key: 'is_active', label: 'Aktiv', type: 'boolean', group: 'Sonstiges' },
];

export default function PlmGeraete() {
  return (
    <PlmCrudPage
      table="plm_devices"
      title="Geräte"
      subtitle="Gerätestammdaten mit CE-, MDR- und Freigabestatus."
      icon={Cpu}
      fields={fields}
      orderBy="name"
      ascending
      defaults={{ is_active: true }}
    />
  );
}
