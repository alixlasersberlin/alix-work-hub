/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Alix Work"

interface BackupFailureAlertProps {
  backup_id?: string
  backup_type?: string
  backup_scope?: string
  failure_kind?: string
  backup_status?: string
  integrity_status?: string
  error_message?: string
  occurred_at?: string
  source?: string
}

const BackupFailureAlertEmail = ({
  backup_id = '—',
  backup_type = '—',
  backup_scope = '—',
  failure_kind = 'Backup fehlgeschlagen',
  backup_status = '—',
  integrity_status = '—',
  error_message = 'Kein Fehlertext verfügbar.',
  occurred_at = new Date().toISOString(),
  source = '—',
}: BackupFailureAlertProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>{failure_kind} – {backup_id}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={alertBanner}>
          <Text style={alertBannerText}>⚠ {failure_kind}</Text>
        </Section>
        <Heading style={h1}>{SITE_NAME} – Backup Alarm</Heading>
        <Text style={text}>
          Ein Backup-Lauf hat einen kritischen Zustand gemeldet. Bitte sofort prüfen.
        </Text>
        <Section style={infoSection}>
          <Text style={infoRow}><strong>Backup-ID:</strong> {backup_id}</Text>
          <Text style={infoRow}><strong>Zeitpunkt:</strong> {new Date(occurred_at).toLocaleString('de-DE')}</Text>
          <Text style={infoRow}><strong>Auslöser:</strong> {source}</Text>
          <Text style={infoRow}><strong>Typ:</strong> {backup_type} ({backup_scope})</Text>
          <Text style={infoRow}><strong>Backup-Status:</strong> {backup_status}</Text>
          <Text style={infoRow}><strong>Integrität:</strong> {integrity_status}</Text>
        </Section>
        <Section style={errorSection}>
          <Text style={errorLabel}>Fehlermeldung</Text>
          <Text style={errorBody}>{error_message}</Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Diese Benachrichtigung wurde automatisch von {SITE_NAME} ausgelöst, sobald ein Backup
          den Status „failed" oder ein ungültiges Integritäts-Ergebnis erhalten hat.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BackupFailureAlertEmail,
  subject: (data: Record<string, any>) =>
    `[ALARM] Backup ${data.backup_status === 'failed' ? 'fehlgeschlagen' : 'Integritätsproblem'} – ${data.backup_id ?? ''}`.trim(),
  displayName: 'Backup Alarm (Fehlschlag / Integrität)',
  previewData: {
    backup_id: 'b-123',
    backup_type: 'full',
    backup_scope: 'database+storage',
    failure_kind: 'Backup fehlgeschlagen',
    backup_status: 'failed',
    integrity_status: 'invalid',
    error_message: 'Connection to Hetzner S3 timed out after 30s',
    occurred_at: new Date().toISOString(),
    source: 'cron',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 25px', maxWidth: '560px', margin: '0 auto' }
const alertBanner = { backgroundColor: '#7a1a1a', borderRadius: '6px', padding: '14px 18px', margin: '0 0 24px' }
const alertBannerText = { color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, margin: 0, textAlign: 'center' as const, letterSpacing: '0.5px' }
const h1 = { fontSize: '20px', fontWeight: '700' as const, color: '#000000', margin: '0 0 16px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const infoSection = { backgroundColor: '#f5f0e6', borderRadius: '8px', padding: '18px', margin: '0 0 16px', border: '1px solid #e8dfc8' }
const infoRow = { fontSize: '13px', color: '#333', margin: '4px 0', lineHeight: '1.5' }
const errorSection = { backgroundColor: '#fff1f1', borderRadius: '8px', padding: '16px', margin: '0 0 8px', border: '1px solid #f3c2c2' }
const errorLabel = { fontSize: '12px', fontWeight: '700' as const, color: '#7a1a1a', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const errorBody = { fontSize: '13px', color: '#3a0a0a', margin: 0, lineHeight: '1.5', fontFamily: "'Menlo','Monaco',monospace", whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }
const hr = { borderColor: '#e8dfc8', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '8px 0 0', lineHeight: '1.5' }
