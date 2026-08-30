import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const pmUid = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

export async function pmLoadProduct(id: string) {
  const [p, prices, compliance, marketing, seo, variants, scope, attrs, values, media, docs, wf, hist] =
    await Promise.all([
      db.from('ph_products').select('*').eq('id', id).maybeSingle(),
      db.from('ph_prices').select('*').eq('product_id', id).is('variant_id', null).maybeSingle(),
      db.from('ph_compliance').select('*').eq('product_id', id).maybeSingle(),
      db.from('ph_marketing').select('*').eq('product_id', id).maybeSingle(),
      db.from('ph_seo').select('*').eq('product_id', id).maybeSingle(),
      db.from('ph_variants').select('*').eq('product_id', id).order('sort_order'),
      db.from('ph_scope_items').select('*').eq('product_id', id).order('sort_order'),
      db.from('ph_attributes').select('*').eq('active', true).order('group_name').order('sort_order'),
      db.from('ph_attribute_values').select('*').eq('product_id', id),
      db.from('ph_media').select('*').eq('product_id', id).order('sort_order'),
      db.from('ph_documents').select('*').eq('product_id', id),
      db.from('ph_workflow_steps').select('*').eq('product_id', id).order('created_at', { ascending: false }),
      db.from('ph_field_history').select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(100),
    ]);

  return {
    product: p.data,
    prices: prices.data,
    compliance: compliance.data,
    marketing: marketing.data,
    seo: seo.data,
    variants: variants.data || [],
    scope: scope.data || [],
    attributes: attrs.data || [],
    attrValues: values.data || [],
    media: media.data || [],
    documents: docs.data || [],
    workflow: wf.data || [],
    history: hist.data || [],
  };
}

export async function pmUpsertSection(table: string, productId: string, patch: Record<string, any>) {
  const { data: existing } = await db.from(table).select('id').eq('product_id', productId).maybeSingle();
  if (existing) {
    const { error } = await db.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id);
    if (error) throw error;
    return existing.id as string;
  }
  const { data, error } = await db.from(table).insert({ product_id: productId, ...patch }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function pmSetAttributeValue(productId: string, attributeId: string, patch: Record<string, any>) {
  const { data: existing } = await db.from('ph_attribute_values')
    .select('id').eq('product_id', productId).eq('attribute_id', attributeId).is('variant_id', null).maybeSingle();
  if (existing) {
    const { error } = await db.from('ph_attribute_values').update(patch).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await db.from('ph_attribute_values').insert({ product_id: productId, attribute_id: attributeId, ...patch });
    if (error) throw error;
  }
}

/** Produkt duplizieren – SEO wird nie übernommen, neue SKU ist Pflicht */
export async function pmDuplicate(sourceId: string, opts: {
  sku: string; name: string;
  master: boolean; tech: boolean; media: boolean; documents: boolean; scope: boolean; prices: boolean;
}) {
  const src = await pmLoadProduct(sourceId);
  const p = src.product;
  if (!p) throw new Error('Quellprodukt nicht gefunden');

  const base: Record<string, any> = {
    name: opts.name, sku: opts.sku, status: 'draft',
    alix_product_id: `ALX-${opts.sku.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
    slug: opts.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  };
  if (opts.master) Object.assign(base, {
    model: p.model, brand: p.brand, product_family: p.product_family, series: p.series,
    segment: p.segment, product_group: p.product_group, categories: p.categories,
    applications: p.applications, manufacturer: p.manufacturer, short_description: p.short_description,
    long_description: p.long_description,
  });
  if (opts.tech) Object.assign(base, {
    tech_specs: p.tech_specs, wavelengths: p.wavelengths, power: p.power, fluence: p.fluence,
    pulse_duration: p.pulse_duration, frequency: p.frequency, spot_sizes: p.spot_sizes,
    cooling: p.cooling, laser_class: p.laser_class,
  });

  const uid = await pmUid();
  const { data: created, error } = await db.from('ph_products')
    .insert({ ...base, created_by: uid, updated_by: uid }).select('id').single();
  if (error) throw error;
  const newId = created.id as string;

  if (opts.tech && src.attrValues.length) {
    await db.from('ph_attribute_values').insert(src.attrValues.map((v: any) => ({
      product_id: newId, attribute_id: v.attribute_id,
      value_text: v.value_text, value_number: v.value_number, value_list: v.value_list,
    })));
  }
  if (opts.media && src.media.length) {
    await db.from('ph_media').insert(src.media.map(({ id, product_id, created_at, ...m }: any) => ({ ...m, product_id: newId })));
  }
  if (opts.documents && src.documents.length) {
    await db.from('ph_documents').insert(src.documents.map(({ id, product_id, created_at, ...d }: any) => ({ ...d, product_id: newId })));
  }
  if (opts.scope && src.scope.length) {
    await db.from('ph_scope_items').insert(src.scope.map(({ id, product_id, variant_id, created_at, updated_at, ...s }: any) => ({ ...s, product_id: newId })));
  }
  if (opts.prices && src.prices) {
    const { id, product_id, variant_id, created_at, updated_at, ...pr } = src.prices as any;
    await db.from('ph_prices').insert({ ...pr, product_id: newId });
  }
  return newId;
}

export async function pmAddWorkflowStep(productId: string, step: string, status: string, comment?: string) {
  const uid = await pmUid();
  const { error } = await db.from('ph_workflow_steps')
    .insert({ product_id: productId, step, status, comment: comment || null, acted_by: uid, acted_at: new Date().toISOString() });
  if (error) throw error;
}
