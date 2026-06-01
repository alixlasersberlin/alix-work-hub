import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers Datacenter'

interface Props {
  kind?: 'Bug' | 'CAPA'
  ticketNumber?: string
  title?: string
  reporterName?: string
  reporterEmail?: string
  fields?: Array<{ label: string; value: string }>
  body?: string
}

const BugCapaNotificationEmail = ({
  kind = 'Bug',
  ticketNumber,
  title,
  reporterName,
  reporterEmail,
  fields = [],
  body,
}: Props) => {
  const subjectLine = `Neuer ${kind}${ticketNumber ? ` ${ticketNumber}` : ''}${title ? ` – ${title}` : ''}`
  const bodyLines = (body ?? '').split('\n')
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{subjectLine}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subjectLine}</Heading>

          <Section style={metaBox}>
            {ticketNumber && (
              <Text style={metaRow}><strong>Nummer:</strong> {ticketNumber}</Text>
            )}
            {title && (
              <Text style={metaRow}><strong>Titel:</strong> {title}</Text>
            )}
            {(reporterName || reporterEmail) && (
              <Text style={metaRow}>
                <strong>Verfasser:</strong> {reporterName ?? ''}
                {reporterEmail ? ` <${reporterEmail}>` : ''}
              </Text>
            )}
          </Section>

          {fields.length > 0 && (
            <Section>
              {fields.map((f, i) => (
                <Text key={i} style={paragraph}>
                  <strong>{f.label}:</strong> {f.value || '—'}
                </Text>
              ))}
            </Section>
          )}

          {bodyLines.some((l) => l.trim() !== '') && (
            <Section>
              <Heading as="h2" style={h2}>Beschreibung</Heading>
              {bodyLines.map((line, i) =>
                line.trim() === ''
                  ? <div key={i} style={{ height: 8 }} />
                  : <Text key={i} style={paragraph}>{line}</Text>
              )}
            </Section>
          )}

          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BugCapaNotificationEmail,
  subject: (data: Record<string, any>) => {
    const kind = (data?.kind as string) || 'Bug'
    const t = (data?.ticketNumber as string) || ''
    const title = (data?.title as string) || ''
    return `[${kind}] ${t}${t && title ? ' – ' : ''}${title}`.trim() || `Neuer ${kind}`
  },
  displayName: 'Bug & CAPA – Benachrichtigung',
  previewData: {
    kind: 'Bug',
    ticketNumber: 'BUG-00012',
    title: 'Display flackert bei Demo-Modus',
    reporterName: 'Max Mustermann',
    reporterEmail: 'max@alix-lasers.com',
    fields: [
      { label: 'Produkt', value: 'Lumix Pro' },
      { label: 'Priorität', value: 'hoch' },
      { label: 'Kritikalität', value: 'mittel' },
    ],
    body: 'Beim Wechsel in den Demo-Modus flackert das Display für ca. 2 Sekunden.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const h2 = { fontSize: '15px', fontWeight: 'bold', color: '#0d0d0d', margin: '18px 0 8px' }
const metaBox = { background: '#f7f7f7', padding: '12px 14px', borderRadius: '6px', margin: '0 0 16px' }
const metaRow = { fontSize: '13px', color: '#333333', margin: '0 0 4px', lineHeight: '1.5' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 8px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
