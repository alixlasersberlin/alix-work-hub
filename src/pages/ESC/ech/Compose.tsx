import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { sendMessage } from '@/lib/esc/ech/sender';
import type { EchChannel, EchLanguage } from '@/lib/esc/ech/types';
import { ECH_LANGUAGES } from '@/lib/esc/ech/types';

const CHANNELS: { id: EchChannel; label: string }[] = [
  { id: 'email', label: 'E-Mail' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'push', label: 'Push' },
  { id: 'calendar_invite', label: 'Kalender-Einladung' },
  { id: 'teams', label: 'Microsoft Teams' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'google_meet', label: 'Google Meet' },
];

export default function EchCompose() {
  const [channel, setChannel] = useState<EchChannel>('email');
  const [language, setLanguage] = useState<EchLanguage>('de');
  const [slug, setSlug] = useState('appointment_confirmed');
  const [recipient, setRecipient] = useState('');
  const [customer, setCustomer] = useState('');
  const [extra, setExtra] = useState('');

  const submit = () => {
    if (!recipient) { toast.error('Empfänger fehlt'); return; }
    sendMessage({
      channel, templateSlug: slug, language, recipient,
      ctx: { customerName: customer, extras: extra ? { additional_note: extra } : undefined },
    });
    toast.success('Nachricht in Queue gestellt');
    setRecipient(''); setCustomer(''); setExtra('');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Send className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Kommunikation · Manueller Versand</h1>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Nachricht</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px]">Kanal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as EchChannel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHANNELS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Sprache</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as EchLanguage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ECH_LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Template-Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="z. B. appointment_confirmed" />
          </div>
          <div>
            <Label className="text-[11px]">Empfänger</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="email@kunde.de / +49… / user-id" />
          </div>
          <div>
            <Label className="text-[11px]">Kundenname</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px]">Zusatzinfo (optional)</Label>
            <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={submit}><Send className="w-4 h-4 mr-1.5" />In Queue stellen</Button>
      </div>
    </div>
  );
}
