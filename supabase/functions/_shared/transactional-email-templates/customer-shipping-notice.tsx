import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers'

interface Props {
  subject?: string
  body?: string
  downloadUrl?: string
  downloadLabel?: string
}

const CustomerShippingNoticeEmail = ({ subject, body, downloadUrl, downloadLabel }: Props) => {
  const text =
    body ??
    'Ihre Bestellung kommt innerhalb der nächsten 2–3 Wochen zur Auslieferung. Den genauen Liefertermin vereinbaren wir mit Ihnen nach Lagereingang.'
  const lines = text.split('\n')
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{subject ?? 'Voravisierung Ihrer Lieferung'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subject ?? 'Voravisierung Ihrer Lieferung'}</Heading>
          {lines.map((line, i) =>
            line.trim() === '' ? (
              <div key={i} style={{ height: 10 }} />
            ) : (
              <Text key={i} style={paragraph}>{line}</Text>
            )
          )}
          {downloadUrl ? (
            <Section style={{ margin: '24px 0' }}>
              <Button href={downloadUrl} style={btn}>
                {downloadLabel || 'Rechnung herunterladen'}
              </Button>
              <Text style={hint}>Oder Link in den Browser kopieren: {downloadUrl}</Text>
            </Section>
          ) : null}
          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CustomerShippingNoticeEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || 'Voravisierung Ihrer Lieferung',
  displayName: 'Kunde – Voravisierung Lieferung',
  previewData: {
    subject: 'Ihre Bestellung A-12345 – Voravisierung zur Lieferung',
    body:
      'Sehr geehrte/r Frau Mustermann,\n\nvielen Dank für Ihre Bestellung A-12345.\n\nIhre Bestellung kommt innerhalb der nächsten 2–3 Wochen zur Auslieferung.\n\nDen genauen Liefertermin vereinbaren wir mit Ihnen nach Lagereingang.\n\nMit freundlichen Grüßen\nIhr Alix-Lasers Team',
    downloadUrl: 'https://alixwork.de/d/abc12345',
    downloadLabel: 'Rechnung herunterladen',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 20px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 10px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
const btn = {
  backgroundColor: '#C9A14A',
  color: '#0d0d0d',
  padding: '12px 22px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
}
const hint = { fontSize: '11px', color: '#888888', margin: '10px 0 0', wordBreak: 'break-all' as const }
