import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { allowedVoiceMedia } from './media-url-policy.ts';
Deno.test('voicemail cannot fetch internal, arbitrary or credential-bearing hosts', () => {
  for (const url of ['http://127.0.0.1/admin', 'https://169.254.169.254/', 'https://evil.example/audio', 'https://api.twilio.com.evil.example/2010-04-01/Accounts/x', 'https://secret@api.twilio.com/2010-04-01/Accounts/x']) assertEquals(allowedVoiceMedia(url, 'https://project.supabase.co'), false);
});
Deno.test('existing provider and project storage media remain allowed', () => {
  assertEquals(allowedVoiceMedia('https://api.twilio.com/2010-04-01/Accounts/demo/Recordings/demo', 'https://project.supabase.co'), true);
  assertEquals(allowedVoiceMedia('https://project.supabase.co/storage/v1/object/sign/audio/file', 'https://project.supabase.co'), true);
});