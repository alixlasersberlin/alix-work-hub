/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Alix Work"

interface BackupReadyProps {
  backup_id?: string
  download_url?: string
  expires_in_hours?: number
  size_mb?: string
  table_count?: number
  storage_file_count?: number
  source?: string
  created_at?: string
}

const BackupReadyEmail = ({
  backup_id = '—',
  download_url = '#',
  expires_in_hours = 168,
  size_mb = '0',
  table_count = 0,
  storage_file_count = 0,
  source = 'manual',
  created_at = new Date().toISOString(),
}: BackupReadyProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Datensicherung bereit zum Download – {size_mb} MB</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME} – Datensicherung</Heading>
        <Text style={text}>
          Eine vollständige Datensicherung wurde erfolgreich erstellt und sicher in Ihrem privaten Storage abgelegt.
        </Text>
        <Section style={infoSection}>
          <Text style={infoRow}><strong>Backup-ID:</strong> {backup_id}</Text>
          <Text style={infoRow}><strong>Erstellt am:</strong> {new Date(created_at).toLocaleString('de-DE')}</Text>
          <Text style={infoRow}><strong>Auslöser:</strong> {source === 'cron' ? 'Automatisch (wöchentlich)' : 'Manuell'}</Text>
          <Text style={infoRow}><strong>Größe:</strong> {size_mb} MB</Text>
          <Text style={infoRow}><strong>Tabellen:</strong> {table_count}</Text>
          <Text style={infoRow}><strong>Storage-Dateien:</strong> {storage_file_count}</Text>
        </Section>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={download_url} style={btn}>Sicherung herunterladen</Button>
        </Section>
        <Text style={text}>
          Der Download-Link ist <strong>{expires_in_hours} Stunden</strong> gültig. Speichern Sie die Datei an einem
          sicheren Ort (z. B. iCloud, verschlüsselte Festplatte).
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Diese E-Mail wurde automatisch versendet. Geben Sie den Link nicht weiter.
        </Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BackupReadyEmail,
  subject: (data: Record<string, any>) => `Datensicherung bereit – ${data.size_mb ?? '0'} MB`,
  displayName: 'Datensicherung bereit',
  previewData: {
    backup_id: 'abc-123',
    download_url: 'https://example.com/backup.json',
    expires_in_hours: 168,
    size_mb: '12.4',
    table_count: 24,
    storage_file_count: 0,
    source: 'manual',
    created_at: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#000000', margin: '0 0 24px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const infoSection = { backgroundColor: '#f5f0e6', borderRadius: '8px', padding: '20px', margin: '0 0 16px', border: '1px solid #e8dfc8' }
const infoRow = { fontSize: '13px', color: '#333', margin: '4px 0', lineHeight: '1.5' }
const btn = { backgroundColor: '#9a7b2d', color: '#fff', padding: '14px 28px', borderRadius: '6px', textDecoration: 'none', fontWeight: '600' as const, fontSize: '14px' }
const hr = { borderColor: '#e8dfc8', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '8px 0 0', lineHeight: '1.5' }
