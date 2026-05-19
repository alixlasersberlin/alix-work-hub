import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers'

interface Props {
  subject?: string
  body?: string
}

const CustomerShippingNoticeEmail = ({ subject, body }: Props) => {
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
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 20px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 10px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
