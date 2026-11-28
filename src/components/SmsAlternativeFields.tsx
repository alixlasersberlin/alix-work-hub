import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { smsPhone, type SmsReviewState } from '@/lib/sms-review';
type Props = { phone:string; review:SmsReviewState; recordNumber:string; onPhone:(phone:string)=>void; onReview:(patch:Partial<SmsReviewState>)=>void };
export function SmsAlternativeFields({phone,review,recordNumber,onPhone,onReview}:Props) {
  const alternative = smsPhone(phone) !== smsPhone(review.storedPhone);
  return <div className="space-y-2">
    <Label>Mobilnummer</Label>
    <Input value={phone} maxLength={40} readOnly={!review.canOverride} onChange={e=>{onPhone(e.target.value);onReview({confirmed:false});}} />
    {alternative && <>
      <Label>Grund für abweichende Nummer</Label>
      <Textarea value={review.reason} maxLength={500} onChange={e=>onReview({reason:e.target.value,confirmed:false})} />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={review.confirmed} onCheckedChange={v=>onReview({confirmed:v === true})}/>Versand an {phone} für {recordNumber} bestätigen</label>
    </>}
  </div>;
}