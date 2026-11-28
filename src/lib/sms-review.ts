import { supabase } from '@/integrations/supabase/client';
export { smsPhone, smsReview } from '../../supabase/functions/_shared/sms-policy';
export type SmsReviewState = { storedPhone: string; reason: string; confirmed: boolean; canOverride: boolean };
export async function prepareSmsReview(recordType: 'invoice'|'deposit'|'device_lock', recordId: string): Promise<SmsReviewState> {
  const {data,error} = await supabase.functions.invoke('op-light-send-sms',{body:{record_type:recordType,record_id:recordId,preview:true}});
  if (error || data?.error || typeof data?.stored_phone !== 'string') throw new Error(data?.error ?? 'SMS-Vorgang nicht zugänglich');
  return {storedPhone:data.stored_phone,canOverride:data.can_override === true,reason:'',confirmed:false};
}