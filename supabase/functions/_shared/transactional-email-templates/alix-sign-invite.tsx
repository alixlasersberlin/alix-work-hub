import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customer_name?: string
  offer_number?: string
  total_amount?: string
  payment_type?: string
  sign_url?: string
  expires_at?: string
}

const Email = (p: Props) => {
  const name = p.customer_name || 'Sehr geehrte/r Kundin/Kunde'
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Ihr Angebot {p.offer_number ?? ''} — jetzt elektronisch über Alix Sign unterschreiben</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Ihr Angebot von Alix Lasers</Heading>
          <Text style={paragraph}>{name},</Text>
          <Text style={paragraph}>
            vielen Dank für Ihr Interesse an Alix Lasers. Über den folgenden sicheren Link
            können Sie Ihr Angebot prüfen und elektronisch über <strong>Alix Sign</strong> unterschreiben:
          </Text>

          <Section style={card}>
            {p.offer_number ? <Text style={kv}><span style={kvLabel}>Angebotsnummer: </span><span style={kvVal}>{p.offer_number}</span></Text> : null}
            {p.total_amount ? <Text style={kv}><span style={kvLabel}>Gesamtbetrag: </span><span style={kvVal}>{p.total_amount}</span></Text> : null}
            {p.payment_type ? <Text style={kv}><span style={kvLabel}>Zahlungsart: </span><span style={kvVal}>{p.payment_type}</span></Text> : null}
            {p.expires_at ? <Text style={kv}><span style={kvLabel}>Gültig bis: </span><span style={kvVal}>{p.expires_at}</span></Text> : null}
          </Section>

          {p.sign_url ? (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={p.sign_url} style={btn}>
                Angebot prüfen & unterschreiben
              </Button>
              <Text style={small}>Oder direkt: {p.sign_url}</Text>
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={paragraph}>
            Nach Ihrer Unterschrift wird das Angebot verbindlich angenommen und als Vertrag verarbeitet.
            Sie erhalten anschließend eine Bestätigung mit dem signierten PDF-Dokument.
          </Text>

          <Text style={small}>
            Der Signatur-Link ist persönlich und sollte nicht weitergegeben werden.
          </Text>

          <Text style={footer}>Mit freundlichen Grüßen<br/>Alix Lasers GmbH</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Ihr Angebot ${d?.offer_number ?? ''} von Alix Lasers – elektronische Unterschrift über Alix Sign`.trim(),
  displayName: 'Alix Sign – Einladung',
  previewData: {
    customer_name: 'Sehr geehrter Herr Mustermann',
    offer_number: 'ANG-2026-10403',
    total_amount: '12.345,67 €',
    payment_type: 'Mietkauf',
    sign_url: 'https://alixwork.de/sign/abc123',
    expires_at: '26.06.2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '620px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const card = { background: '#f7f7f9', borderRadius: '8px', padding: '14px 16px', margin: '8px 0' }
const kv = { fontSize: '14px', color: '#222', margin: '2px 0', lineHeight: '1.5' }
const kvLabel = { color: '#555', fontWeight: 600 }
const kvVal = { color: '#111' }
const btn = {
  backgroundColor: '#14386e',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
  fontSize: '15px',
}
const small = { fontSize: '12px', color: '#666', margin: '8px 0', wordBreak: 'break-all' as const }
const hr = { borderColor: '#eee', margin: '20px 0' }
const footer = { fontSize: '13px', color: '#333', margin: '24px 0 0' }
