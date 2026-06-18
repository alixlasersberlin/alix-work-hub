import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customer_name?: string
  order_number?: string
  offer_number?: string
  signed_at?: string
  total_amount?: string
  download_url?: string
}

const Email = (p: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Auftragsbestätigung {p.order_number ?? p.offer_number ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Auftragsbestätigung</Heading>
        <Text style={paragraph}>{p.customer_name || 'Sehr geehrte/r Kundin/Kunde'},</Text>
        <Text style={paragraph}>
          vielen Dank für Ihren Auftrag. Wir bestätigen hiermit verbindlich den Eingang
          und die Annahme Ihres unterzeichneten Angebots. Anbei finden Sie Ihre Auftragsbestätigung
          inklusive des unterzeichneten Angebots als PDF.
        </Text>

        <Section style={card}>
          {p.order_number ? <Text style={kv}><span style={kvLabel}>Auftragsnummer: </span><span style={kvVal}>{p.order_number}</span></Text> : null}
          {p.offer_number ? <Text style={kv}><span style={kvLabel}>Angebotsnummer: </span><span style={kvVal}>{p.offer_number}</span></Text> : null}
          {p.signed_at ? <Text style={kv}><span style={kvLabel}>Unterzeichnet am: </span><span style={kvVal}>{p.signed_at}</span></Text> : null}
          {p.total_amount ? <Text style={kv}><span style={kvLabel}>Gesamtbetrag: </span><span style={kvVal}>{p.total_amount}</span></Text> : null}
        </Section>

        {p.download_url ? (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={p.download_url} style={btn}>Auftragsbestätigung herunterladen (PDF)</Button>
          </Section>
        ) : null}

        <Hr style={hr} />
        <Text style={paragraph}>
          Unser Team wird sich in Kürze mit den nächsten Schritten bei Ihnen melden.
          Bei Rückfragen antworten Sie einfach auf diese E-Mail.
        </Text>

        <Text style={footer}>Mit freundlichen Grüßen<br/>Alix Lasers</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Auftragsbestätigung ${d?.order_number ?? d?.offer_number ?? ''}`.trim(),
  displayName: 'Alix Lasers – Auftragsbestätigung',
  previewData: {
    customer_name: 'Sehr geehrter Herr Mustermann',
    order_number: 'AUF-2026-12345',
    offer_number: 'ANG-2026-07405',
    signed_at: '12.06.2026 14:23',
    total_amount: '12.345,67 €',
    download_url: 'https://example.com/order-confirmation.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '620px' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px', letterSpacing: '0.5px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const card = { background: '#f7f7f9', borderRadius: '8px', padding: '14px 16px', margin: '8px 0' }
const kv = { fontSize: '14px', color: '#222', margin: '2px 0', lineHeight: '1.5' }
const kvLabel = { color: '#555', fontWeight: 600 }
const kvVal = { color: '#111' }
const hr = { borderColor: '#eee', margin: '20px 0' }
const footer = { fontSize: '13px', color: '#333', margin: '24px 0 0' }
const btn = { background: '#c5a155', color: '#fff', padding: '12px 22px', borderRadius: '6px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }
