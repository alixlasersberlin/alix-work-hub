import { supabase } from '@/integrations/supabase/client';

export type OfferStatus = 'draft' | 'order' | 'signed';
export type OfferApprovalStatus = 'pending' | 'approved' | 'rejected';

export type OfferSnapshot = {
  offerNumber: string;
  caseNumber?: string | null;
  offerDate?: string;
  validUntil?: string;
  customer?: { id?: string; company_name?: string; contact_name?: string; email?: string; phone?: string } | null;
  totals?: { net: number; tax: number; gross: number };
  lines?: any[];
  payment?: any;
  notes?: string;
  salesAdvisor?: string;
  deliveryWeek?: string;
  specialOffer?: string;
  includeAppendix?: boolean;
  createdAt?: string;
  status?: OfferStatus;
  signedAt?: string;
  // Approval workflow
  approvalStatus?: OfferApprovalStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvalNote?: string | null;
  // List-only enrichments
  createdByName?: string | null;
};

const LEGACY_KEY = 'alix_angebote_v1';
const MIGRATED_KEY = 'alix_angebote_v1_migrated';

function rowToSnapshot(row: any): OfferSnapshot {
  const payload = (row.payload || {}) as any;
  return {
    ...payload,
    offerNumber: row.offer_number,
    caseNumber: row.case_number || payload.caseNumber || null,
    offerDate: row.offer_date || payload.offerDate,
    validUntil: row.valid_until || payload.validUntil,
    customer: payload.customer || (row.customer_name ? { id: row.customer_id, company_name: row.customer_name, email: row.customer_email } : null),
    totals: payload.totals || { net: Number(row.total_net || 0), tax: Number(row.total_tax || 0), gross: Number(row.total_gross || 0) },
    status: (row.status as OfferStatus) || 'draft',
    signedAt: row.signed_at || payload.signedAt,
    createdAt: row.created_at || payload.createdAt,
    createdByName: row.created_by_name || null,
  };
}

export async function listOffers(): Promise<OfferSnapshot[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('listOffers', error);
    return [];
  }
  return (data || []).map(rowToSnapshot);
}

export async function getOffer(offerNumber: string): Promise<OfferSnapshot | null> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('offer_number', offerNumber)
    .maybeSingle();
  if (error || !data) return null;
  return rowToSnapshot(data);
}

export async function upsertOffer(snap: OfferSnapshot): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  let createdByName: string | null = (user?.user_metadata as any)?.full_name || user?.email || null;
  if (user?.id) {
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    createdByName = (prof as any)?.full_name || (prof as any)?.email || createdByName;
  }

  const row: any = {
    offer_number: snap.offerNumber,
    case_number: snap.caseNumber || null,
    offer_date: snap.offerDate || null,
    valid_until: snap.validUntil || null,
    customer_id: snap.customer?.id || null,
    customer_name: snap.customer?.company_name || snap.customer?.contact_name || null,
    customer_email: snap.customer?.email || null,
    total_net: snap.totals?.net || 0,
    total_tax: snap.totals?.tax || 0,
    total_gross: snap.totals?.gross || 0,
    status: snap.status || 'draft',
    signed_at: snap.signedAt || null,
    payload: snap,
  };

  // Check if exists to preserve created_by
  const { data: existing } = await supabase
    .from('offers')
    .select('id, created_by')
    .eq('offer_number', snap.offerNumber)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('offers').update(row).eq('offer_number', snap.offerNumber);
    if (error) throw error;
  } else {
    row.created_by = user?.id || null;
    row.created_by_name = createdByName;
    const { error } = await supabase.from('offers').insert(row);
    if (error) throw error;
  }
}

export async function deleteOffer(offerNumber: string): Promise<void> {
  const { error } = await supabase.from('offers').delete().eq('offer_number', offerNumber);
  if (error) throw error;
}

export async function updateOfferStatus(offerNumber: string, status: OfferStatus, signedAt?: string): Promise<void> {
  const patch: any = { status };
  if (signedAt) patch.signed_at = signedAt;
  await supabase.from('offers').update(patch).eq('offer_number', offerNumber);
}

/** One-time migration of legacy localStorage offers into the shared DB. */
export async function migrateLegacyOffersOnce(): Promise<number> {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return 0;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
      return 0;
    }
    const list: OfferSnapshot[] = JSON.parse(raw);
    let count = 0;
    for (const snap of list) {
      if (!snap?.offerNumber) continue;
      const { data: exists } = await supabase
        .from('offers')
        .select('id')
        .eq('offer_number', snap.offerNumber)
        .maybeSingle();
      if (exists) continue;
      try {
        await upsertOffer(snap);
        count++;
      } catch (e) {
        console.warn('migrate offer skipped', snap.offerNumber, e);
      }
    }
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
    return count;
  } catch (e) {
    console.warn('migrateLegacyOffersOnce failed', e);
    return 0;
  }
}
