import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customer_name?: string
  offer_number?: string
  signer_name?: string
  signed_at?: string
  total_amount?: string
  download_url?: string
  pdf_hash?: string
}

const Email = (p: Props) => {
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Ihr Angebot {p.offer_number ?? ''} wurde erfolgreich unterzeichnet</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Vielen Dank für Ihre Unterschrift</Heading>
          <Text style={paragraph}>{p.customer_name || 'Sehr geehrte/r Kundin/Kunde'},</Text>
          <Text style={paragraph}>
            wir bestätigen den Eingang Ihrer elektronischen Unterschrift über <strong>Alix Sign</strong>.
            Das Angebot gilt damit als verbindlich angenommen.
          </Text>

          <Section style={card}>
            {p.offer_number ? <Text style={kv}><span style={kvLabel}>Angebotsnummer: </span><span style={kvVal}>{p.offer_number}</span></Text> : null}
            {p.signer_name ? <Text style={kv}><span style={kvLabel}>Unterzeichnet von: </span><span style={kvVal}>{p.signer_name}</span></Text> : null}
            {p.signed_at ? <Text style={kv}><span style={kvLabel}>Zeitpunkt: </span><span style={kvVal}>{p.signed_at}</span></Text> : null}
            {p.total_amount ? <Text style={kv}><span style={kvLabel}>Gesamtbetrag: </span><span style={kvVal}>{p.total_amount}</span></Text> : null}
            {p.pdf_hash ? <Text style={kv}><span style={kvLabel}>Dokument-Hash (SHA-256): </span><span style={{ ...kvVal, fontFamily: 'monospace', fontSize: '11px' }}>{p.pdf_hash}</span></Text> : null}
          </Section>

          {p.download_url ? (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={p.download_url} style={btn}>Signiertes PDF herunterladen</Button>
              <Text style={{ fontSize: '12px', color: '#777', marginTop: '8px' }}>
                Der Download-Link ist 90 Tage gültig.
              </Text>
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={paragraph}>
            Das signierte PDF-Dokument enthält Ihre Annahmeerklärung, Zeitstempel und Prüfprotokoll
            (IP-Adresse, Geräteinformationen, kryptografischer Hash).
            Bitte bewahren Sie das Dokument für Ihre Unterlagen auf.
          </Text>
          <Text style={paragraph}>
            Unser Team wird sich in Kürze mit den nächsten Schritten bei Ihnen melden.
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
    `Bestätigung: Angebot ${d?.offer_number ?? ''} elektronisch unterzeichnet`.trim(),
  displayName: 'Alix Sign – Bestätigung',
  previewData: {
    customer_name: 'Sehr geehrter Herr Mustermann',
    offer_number: 'ANG-2026-10403',
    signer_name: 'Max Mustermann',
    signed_at: '12.06.2026 14:23',
    total_amount: '12.345,67 €',
    download_url: 'https://example.com/signed.pdf',
    pdf_hash: 'a1b2c3...',
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
const hr = { borderColor: '#eee', margin: '20px 0' }
const footer = { fontSize: '13px', color: '#333', margin: '24px 0 0' }
const btn = { background: '#c5a155', color: '#fff', padding: '12px 22px', borderRadius: '6px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }
