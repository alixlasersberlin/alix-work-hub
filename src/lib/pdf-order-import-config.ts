import { supabase } from '@/integrations/supabase/client';

export type PdfOrderImportConfig = {
  max_file_size_mb: number;
  active_doc_types: string[];
  confidence_green: number;
  confidence_yellow: number;
  ocr_enabled: boolean;
  default_currency: string;
  default_branch: string | null;
  default_status: string;
  retention_days_drafts: number;
  auto_followups_default: {
    delivery_planning: boolean;
    mediapaket: boolean;
    nisv: boolean;
    financing: boolean;
    deposit_check: boolean;
  };
};

export const DEFAULT_PDF_IMPORT_CONFIG: PdfOrderImportConfig = {
  max_file_size_mb: 20,
  active_doc_types: [
    'purchase_order', 'sales_contract', 'rental_contract', 'leasing_contract',
    'order_confirmation', 'offer', 'financing_order', 'device_order', 'service_order', 'other',
  ],
  confidence_green: 90,
  confidence_yellow: 70,
  ocr_enabled: true,
  default_currency: 'EUR',
  default_branch: null,
  default_status: 'offen',
  retention_days_drafts: 90,
  auto_followups_default: {
    delivery_planning: true, mediapaket: true, nisv: true, financing: true, deposit_check: true,
  },
};

const KEY = 'pdf_order_import_config';
let cached: PdfOrderImportConfig | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

export async function loadPdfOrderImportConfig(): Promise<PdfOrderImportConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      cached = { ...DEFAULT_PDF_IMPORT_CONFIG, ...parsed, auto_followups_default: { ...DEFAULT_PDF_IMPORT_CONFIG.auto_followups_default, ...(parsed?.auto_followups_default ?? {}) } };
    } else {
      cached = DEFAULT_PDF_IMPORT_CONFIG;
    }
  } catch {
    cached = DEFAULT_PDF_IMPORT_CONFIG;
  }
  cachedAt = now;
  return cached;
}
