import { Wrench } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { RELEASE_STATUS, CRITICALITY, PlmField } from '@/lib/plm/config';

export const partFields: PlmField[] = [
  { key: 'part_number', label: 'Teilenummer', list: true, mono: true },
  { key: 'name', label: 'Bezeichnung', list: true },
  { key: 'category', label: 'Kategorie', list: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number' },
  { key: 'assembly_id', label: 'Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code' },
  { key: 'description', label: 'Beschreibung', type: 'textarea' },

  { key: 'manufacturer', label: 'Hersteller', group: 'Beschaffung', list: true },
  { key: 'manufacturer_part_number', label: 'Herstellernummer', group: 'Beschaffung' },
  { key: 'primary_supplier_id', label: 'Hauptlieferant', type: 'ref', refTable: 'plm_suppliers', refLabel: 'name', refExtra: 'supplier_number', group: 'Beschaffung', list: true },
  { key: 'supplier_part_number', label: 'Lieferantennummer', group: 'Beschaffung' },
  { key: 'price', label: 'Preis', type: 'number', group: 'Beschaffung' },
  { key: 'currency', label: 'Währung', group: 'Beschaffung' },
  { key: 'moq', label: 'Mindestbestellmenge', type: 'number', group: 'Beschaffung' },
  { key: 'lead_time_days', label: 'Lieferzeit (Tage)', type: 'number', group: 'Beschaffung' },
  { key: 'country_of_origin', label: 'Ursprungsland', group: 'Beschaffung' },
  { key: 'customs_code', label: 'Zolltarifnummer', group: 'Beschaffung' },

  { key: 'stock_min', label: 'Mindestbestand', type: 'number', group: 'Lager' },
  { key: 'stock_target', label: 'Sollbestand', type: 'number', group: 'Lager' },
  { key: 'stock_reorder', label: 'Meldebestand', type: 'number', group: 'Lager' },
  { key: 'is_spare_part', label: 'Ersatzteil', type: 'boolean', group: 'Lager', list: true },

  { key: 'dimensions', label: 'Abmessungen', group: 'Technik' },
  { key: 'weight_g', label: 'Gewicht (g)', type: 'number', group: 'Technik' },
  { key: 'material', label: 'Material', group: 'Technik' },
  { key: 'color', label: 'Farbe', group: 'Technik' },
  { key: 'surface', label: 'Oberfläche', group: 'Technik' },
  { key: 'voltage', label: 'Spannung', group: 'Technik' },
  { key: 'power_w', label: 'Leistung (W)', type: 'number', group: 'Technik' },
  { key: 'current_a', label: 'Strom (A)', type: 'number', group: 'Technik' },
  { key: 'temperature_range', label: 'Temperaturbereich', group: 'Technik' },
  { key: 'protection_class', label: 'Schutzklasse', group: 'Technik' },
  { key: 'ip_rating', label: 'IP-Schutzart', group: 'Technik' },
  { key: 'wavelength_nm', label: 'Wellenlänge (nm)', group: 'Technik' },
  { key: 'optical_power', label: 'Optische Leistung', group: 'Technik' },
  { key: 'tolerances', label: 'Toleranzen', group: 'Technik' },

  { key: 'photo_url', label: 'Foto (Upload)', type: 'image', group: 'Dateien' },
  { key: 'cutout_image_url', label: 'Freisteller (Upload)', type: 'image', group: 'Dateien' },
  { key: 'datasheet_url', label: 'Datenblatt (Upload)', type: 'file', group: 'Dateien' },
  { key: 'cad_url', label: 'CAD (Upload)', type: 'file', group: 'Dateien' },
  { key: 'step_url', label: 'STEP (Upload)', type: 'file', group: 'Dateien' },
  { key: 'drawing_pdf_url', label: 'Zeichnung PDF (Upload)', type: 'file', group: 'Dateien' },

  { key: 'version', label: 'Version', group: 'Freigabe & QM' },
  { key: 'revision', label: 'Revision', group: 'Freigabe & QM' },
  { key: 'release_status', label: 'Freigabestatus', type: 'select', options: RELEASE_STATUS, group: 'Freigabe & QM', list: true },
  { key: 'criticality', label: 'Kritikalität', type: 'select', options: CRITICALITY, group: 'Freigabe & QM', list: true },
  { key: 'qs_responsible', label: 'QS-Verantwortlich', group: 'Freigabe & QM' },
  { key: 'rohs', label: 'RoHS konform', type: 'boolean', group: 'Freigabe & QM' },
  { key: 'reach', label: 'REACH konform', type: 'boolean', group: 'Freigabe & QM' },
  { key: 'gspr_reference', label: 'GSPR-Referenz', group: 'Freigabe & QM' },
  { key: 'risk_reference', label: 'Risikoakte-Referenz', group: 'Freigabe & QM' },
  { key: 'udi_reference', label: 'UDI-Referenz', group: 'Freigabe & QM' },
  { key: 'blocked', label: 'Gesperrt', type: 'boolean', group: 'Freigabe & QM' },
  { key: 'block_reason', label: 'Sperrgrund', group: 'Freigabe & QM' },

  { key: 'service_notes', label: 'Servicehinweise', type: 'textarea', group: 'Sonstiges' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmEinzelteile() {
  return (
    <PlmCrudPage
      table="plm_parts"
      title="Einzelteile"
      subtitle="Teilestamm mit Technik-, Beschaffungs- und QM-Daten."
      icon={Wrench}
      fields={partFields}
      orderBy="part_number"
      ascending
      defaults={{ currency: 'EUR' }}
    />
  );
}
