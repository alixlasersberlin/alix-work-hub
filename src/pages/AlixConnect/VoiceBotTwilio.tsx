import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneCall, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function VoiceBotTwilio() {
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  const webhookUrl = projectRef ? `https://${projectRef}.functions.supabase.co/ac-voice-twilio-webhook` : '';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><PhoneCall className="h-6 w-6" /> Voice-Bot (Twilio IVR)</h1>
        <p className="text-sm text-muted-foreground">Phase 49 — Twilio Voice Webhook mit IVR-Menü, Business Hours & Voicemail-Transkription</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Setup in Twilio</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal ml-5 space-y-2">
            <li>Twilio Console öffnen → <b>Phone Numbers → Active Numbers</b> → Nummer wählen</li>
            <li>Unter <b>Voice Configuration</b> → <b>A Call Comes In</b> auf <b>Webhook</b> setzen</li>
            <li>URL eintragen (POST):</li>
          </ol>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-muted text-xs break-all">{webhookUrl || '<VITE_SUPABASE_PROJECT_ID fehlt>'}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Kopiert'); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Voicemails werden automatisch via <code>ac-voicemail-transkribe</code> transkribiert und in <code>ac_calls</code> geloggt.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">IVR-Menü</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>• <b>1</b> → Vertrieb</div>
          <div>• <b>2</b> → Service</div>
          <div>• <b>3</b> → Buchhaltung</div>
          <div>• Sonst → Zentrale, außerhalb der Geschäftszeiten → Voicemail</div>
          <div className="text-xs text-muted-foreground mt-3">Geschäftszeiten: Mo–So 08:00–18:00 Europe/Berlin. Weiterleitungsnummer aktuell hart auf <code>+491234567890</code> — im Edge Function anpassen.</div>
        </CardContent>
      </Card>

      <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/active" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
        Twilio Console öffnen <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
