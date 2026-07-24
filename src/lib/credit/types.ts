export type CreditAmpel = 'gruen' | 'gelb' | 'orange' | 'rot';
export type CreditStatus = 'draft' | 'calculating' | 'pending_review' | 'approved' | 'approved_with_conditions' | 'rejected' | 'expired' | 'cancelled';
export type CreditStage = 'auto' | 'sales' | 'sales_lead' | 'management' | 'done';

export interface CreditAssessment {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  offer_id: string | null;
  customer_type: 'company' | 'private';
  customer_snapshot: Record<string, any>;
  requested_amount: number | null;
  requested_term_months: number | null;
  requested_downpayment_pct: number | null;
  purpose: string | null;
  score: number | null;
  score_max: number;
  ampel: CreditAmpel | null;
  default_probability_pct: number | null;
  recommendation: Record<string, any>;
  flags: string[];
  ai_summary: string | null;
  ai_model: string | null;
  status: CreditStatus;
  workflow_stage: CreditStage;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  valid_until: string | null;
  consent_given: boolean;
  consent_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreditScoreFactor {
  id: string;
  assessment_id: string;
  category: string;
  label: string;
  points: number;
  weight_pct: number;
  source: string | null;
  evidence: Record<string, any>;
  created_at: string;
}
