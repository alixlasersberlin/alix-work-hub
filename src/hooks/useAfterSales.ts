import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AsCaseStatus = 'open' | 'in_progress' | 'waiting_customer' | 'blocked' | 'completed';
export type AsTrafficLight = 'green' | 'yellow' | 'red';
export type AsPriority = 'low' | 'normal' | 'high' | 'urgent';
export type AsSection =
  | 'erstkontakt' | 'geraet' | 'nisv' | 'app' | 'mediapaket'
  | 'schulung' | 'marketing' | 'zufriedenheit' | 'rueckruf' | 'upselling';

export interface AsCaseListItem {
  id: string;
  order_id: string;
  customer_id: string | null;
  device_id: string | null;
  status: AsCaseStatus;
  priority: AsPriority;
  traffic_light: AsTrafficLight;
  progress_pct: number;
  health_score: number | null;
  last_contact_at: string | null;
  next_callback_at: string | null;
  sales_user_name: string | null;
  assignee_id: string | null;
  satisfaction_rating: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  order_number: string | null;
  internal_number: string | null;
  order_date: string | null;
  expected_shipment_date: string | null;
  total_amount: number | null;
  currency: string | null;
  order_status: string | null;
  customer_company: string | null;
  customer_contact: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_number: string | null;
  is_vip: boolean | null;
  device_serial: string | null;
  device_model: string | null;
}

export function useAfterSalesCases(opts: { completed?: boolean } = {}) {
  return useQuery({
    queryKey: ['as-cases', { completed: !!opts.completed }],
    queryFn: async () => {
      const q = supabase.from('as_cases_list_v' as any).select('*');
      const { data, error } = opts.completed
        ? await q.eq('status', 'completed').order('closed_at', { ascending: false }).limit(500)
        : await q.neq('status', 'completed').order('updated_at', { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AsCaseListItem[];
    },
  });
}

export function useAfterSalesCase(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['as-case', id],
    queryFn: async () => {
      const [caseRes, checks, timeline, callbacks, media, upsell] = await Promise.all([
        supabase.from('as_cases_list_v' as any).select('*').eq('id', id!).maybeSingle(),
        supabase.from('as_checklist_items' as any).select('*').eq('case_id', id!).order('section').order('sort_order'),
        supabase.from('as_timeline_events' as any).select('*').eq('case_id', id!).order('created_at', { ascending: false }).limit(200),
        supabase.from('as_callbacks' as any).select('*').eq('case_id', id!).order('due_at', { ascending: false }),
        supabase.from('as_mediapaket_status' as any).select('*').eq('case_id', id!).maybeSingle(),
        supabase.from('as_upsell_suggestions' as any).select('*').eq('case_id', id!).order('created_at'),
      ]);
      if (caseRes.error) throw caseRes.error;
      return {
        case: caseRes.data as any,
        checklist: (checks.data ?? []) as any[],
        timeline: (timeline.data ?? []) as any[],
        callbacks: (callbacks.data ?? []) as any[],
        media: (media.data ?? null) as any,
        upsell: (upsell.data ?? []) as any[],
      };
    },
  });
}

async function recomputeProgress(caseId: string) {
  const { data } = await supabase.from('as_checklist_items' as any).select('checked').eq('case_id', caseId);
  const items = ((data ?? []) as unknown) as Array<{ checked: boolean }>;
  if (items.length === 0) return;
  const pct = Math.round((items.filter(i => i.checked).length / items.length) * 100);
  const light: AsTrafficLight = pct === 100 ? 'green' : pct >= 60 ? 'yellow' : 'red';
  await supabase.from('as_cases' as any).update({ progress_pct: pct, traffic_light: light }).eq('id', caseId);
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; case_id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('as_checklist_items' as any)
        .update({ checked: v.checked, checked_at: v.checked ? new Date().toISOString() : null })
        .eq('id', v.id);
      if (error) throw error;
      await recomputeProgress(v.case_id);
      const u = (await supabase.auth.getUser()).data.user;
      await supabase.from('as_timeline_events' as any).insert({
        case_id: v.case_id,
        event_type: 'checklist_toggle',
        title: v.checked ? 'Checkliste erledigt' : 'Checkliste zurückgesetzt',
        source: 'user',
        created_by: u?.id ?? null,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['as-case', v.case_id] });
      qc.invalidateQueries({ queryKey: ['as-cases'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Speichern fehlgeschlagen'),
  });
}

export function useUpdateMediaStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { case_id: string; stage: string }) => {
      const u = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from('as_mediapaket_status' as any)
        .upsert({ case_id: v.case_id, stage: v.stage as any, updated_by: u?.id ?? null });
      if (error) throw error;
      await supabase.from('as_timeline_events' as any).insert({
        case_id: v.case_id, event_type: 'media_stage', title: `Mediapaket: ${v.stage}`, source: 'user',
        created_by: u?.id ?? null,
      });
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['as-case', v.case_id] }),
  });
}

export function useAddCallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { case_id: string; due_at: string; priority: AsPriority; reason: string }) => {
      const u = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from('as_callbacks' as any).insert({
        case_id: v.case_id, due_at: v.due_at, priority: v.priority, reason: v.reason, created_by: u?.id ?? null,
      });
      if (error) throw error;
      await supabase.from('as_cases' as any).update({ next_callback_at: v.due_at }).eq('id', v.case_id);
      await supabase.from('as_timeline_events' as any).insert({
        case_id: v.case_id, event_type: 'callback_scheduled',
        title: `Rückruf geplant: ${new Date(v.due_at).toLocaleString('de-DE')}`,
        body: v.reason, source: 'user', created_by: u?.id ?? null,
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['as-case', v.case_id] });
      qc.invalidateQueries({ queryKey: ['as-cases'] });
    },
  });
}

export function useCompleteCallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; case_id: string }) => {
      const u = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from('as_callbacks' as any)
        .update({ done_at: new Date().toISOString(), done_by: u?.id ?? null })
        .eq('id', v.id);
      if (error) throw error;
      await supabase.from('as_cases' as any).update({ last_contact_at: new Date().toISOString() }).eq('id', v.case_id);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['as-case', v.case_id] }),
  });
}

export function useCloseCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (caseId: string) => {
      const { data: items, error: e1 } = await supabase
        .from('as_checklist_items' as any).select('section,checked').eq('case_id', caseId);
      if (e1) throw e1;
      const required: AsSection[] = ['erstkontakt', 'geraet', 'app', 'schulung'];
      const bySection: Record<string, { total: number; done: number }> = {};
      (items ?? []).forEach((i: any) => {
        bySection[i.section] = bySection[i.section] ?? { total: 0, done: 0 };
        bySection[i.section].total++;
        if (i.checked) bySection[i.section].done++;
      });
      const missing = required.filter(s => !bySection[s] || bySection[s].done < bySection[s].total);
      if (missing.length) throw new Error('Fehlende Bereiche: ' + missing.join(', '));

      const { data: media } = await supabase.from('as_mediapaket_status' as any).select('stage').eq('case_id', caseId).maybeSingle();
      const mediaStage = (media as any)?.stage;
      if (mediaStage !== 'done' && mediaStage !== 'skipped') {
        throw new Error('Mediapaket muss abgeschlossen oder bewusst übersprungen sein.');
      }
      const { count } = await supabase
        .from('as_callbacks' as any).select('*', { count: 'exact', head: true })
        .eq('case_id', caseId).is('done_at', null);
      if ((count ?? 0) > 0) throw new Error('Es sind noch offene Rückrufe vorhanden.');

      const u = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from('as_cases' as any).update({
        status: 'completed', closed_at: new Date().toISOString(), closed_by: u?.id ?? null, progress_pct: 100, traffic_light: 'green',
      }).eq('id', caseId);
      if (error) throw error;
      await supabase.from('as_timeline_events' as any).insert({
        case_id: caseId, event_type: 'case_closed', title: 'After-Sales-Fall abgeschlossen', source: 'user', created_by: u?.id ?? null,
      });
    },
    onSuccess: (_d, id) => {
      toast.success('After-Sales-Fall abgeschlossen.');
      qc.invalidateQueries({ queryKey: ['as-case', id] });
      qc.invalidateQueries({ queryKey: ['as-cases'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Abschluss nicht möglich'),
  });
}

export function useForceCloseCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { caseId: string; reason?: string }) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const { error } = await supabase
          .rpc('as_force_close_case' as any, {
            _case_id: v.caseId,
            _reason: v.reason ?? null,
          })
          .abortSignal(controller.signal);
        if (error) throw error;
      } finally {
        window.clearTimeout(timeout);
      }
    },
    onSuccess: (_d, v) => {
      toast.success('Fall wurde als erledigt markiert (100%).');
      qc.setQueriesData<AsCaseListItem[]>({ queryKey: ['as-cases'] }, (old) =>
        Array.isArray(old) ? old.filter((item) => item.id !== v.caseId) : old,
      );
      qc.invalidateQueries({ queryKey: ['as-cases'] });
      qc.invalidateQueries({ queryKey: ['as-case', v.caseId] });
    },
    onError: (e: any) => {
      const aborted = e?.name === 'AbortError' || String(e?.message ?? '').toLowerCase().includes('abort');
      toast.error(aborted ? 'Schließen dauert zu lange. Bitte erneut versuchen.' : e?.message ?? 'Force-Close fehlgeschlagen');
    },
  });
}
