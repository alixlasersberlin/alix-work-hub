/** Customer-editable fields only; identities, workflow, assignments and audit are server-owned. */
const fields: Record<string, readonly string[]> = {
  root: ['studio_name'],
  services: ['service_type', 'selected'],
  studio: ['studio_name', 'contact_name', 'desired_domain', 'alternative_domain', 'existing_domain', 'domain_registered', 'company_name_website', 'company_name_print', 'slogan', 'preferred_salutation', 'preferred_tone'],
  devices: ['entered_model_name', 'serial_number', 'discrepancy_note', 'notes'],
  prices: ['category', 'treatment_name', 'description', 'duration_minutes', 'regular_price', 'promotional_price', 'package_price', 'target_group', 'body_area', 'active', 'sort_order', 'notes'],
  contact: ['company_name', 'studio_name', 'contact_name', 'address_line', 'street', 'house_number', 'address_extra', 'postal_code', 'city', 'state', 'country', 'phone', 'mobile', 'whatsapp', 'email', 'secondary_email', 'website', 'instagram', 'tiktok', 'facebook', 'youtube', 'linkedin', 'booking_url', 'google_business_url', 'preferred_contact_channel'],
  hours: ['weekday', 'closed', 'first_start', 'first_end', 'second_start', 'second_end', 'by_appointment', 'notes', 'mode', 'holiday_note', 'booking_link'],
  treatments: ['treatment_name', 'category', 'description', 'duration_minutes', 'price', 'target_group', 'device_or_method', 'show_on_website', 'show_on_flyer', 'show_on_social_media', 'sort_order'],
  team: ['first_name', 'last_name', 'role', 'biography', 'qualifications', 'treatments', 'show_on_website', 'show_on_flyer', 'show_on_social_media', 'sort_order'],
  branding: ['about_me', 'studio_description', 'company_philosophy', 'qualifications', 'certificates', 'professional_experience', 'languages', 'focus_areas', 'team_intro', 'preferred_salutation', 'preferred_writing_style', 'preferred_tone', 'preferred_colors', 'excluded_colors', 'preferred_styles', 'preferred_fonts', 'corporate_design_notes', 'slogan', 'claims', 'website_examples_positive', 'website_examples_negative', 'visual_language', 'target_group', 'target_age_group', 'regional_focus', 'unique_selling_points', 'main_message', 'other_requirements'],
  consents: ['consent_type', 'accepted', 'consent_text_version'],
  files: ['category', 'description'],
};
export function customerSectionPatch(section: string, values: unknown): Record<string, unknown> | null {
  if (!Object.hasOwn(fields, section) || !values || typeof values !== 'object' || Array.isArray(values)) return null;
  const allowed = fields[section];
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    // Existing forms can submit entire rows: discard server-owned columns, never persist them.
    if (!allowed.includes(key)) continue;
    if (typeof value === 'string' && value.length > 50000) return null;
    if (value !== null && typeof value === 'object' && !(Array.isArray(value) && value.every(v => typeof v === 'string' && v.length <= 5000))) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    patch[key] = value;
  }
  return patch;
}
export function mediaPackagePrefix(mp: { customer_id: string; order_id?: string | null }, mpId: string): string {
  return `customers/${mp.customer_id}/orders/${mp.order_id ?? 'none'}/media-package/${mpId}/`;
}
export function packageFilePathAllowed(path: unknown, prefix: string): path is string {
  if (typeof path !== 'string' || !path.startsWith(prefix) || path.length > 1024 || /[\\%?#\x00-\x1f]/.test(path)) return false;
  const tail = path.slice(prefix.length).split('/');
  return tail.length === 2 && tail.every(p => !!p && p !== '.' && p !== '..');
}
export function safeUploadCategory(category: unknown): string | null {
  return typeof category === 'string' && category.length <= 80 && /^[\p{L}\p{N} _-]+$/u.test(category) ? category : null;
}
export function statusNoticeAllowed(requested: unknown, stored: unknown): boolean {
  return typeof requested === 'string' && ['in_review', 'in_production', 'completed'].includes(requested) && requested === stored;
}
