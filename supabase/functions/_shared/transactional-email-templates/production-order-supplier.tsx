/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Alix Work"

interface ProductionOrderSupplierProps {
  order_number?: string
  supplier_name?: string
  modellname?: string
  farbe?: string
  power_handstueck?: string
  liefertermin?: string
  bearbeiter?: string
  anmerkungen?: string
  pdf_url?: string
  expires_in_days?: number
  is_reclamation?: boolean
}

const ProductionOrderSupplierEmail = ({
  order_number = '—',
  supplier_name = '',
  modellname = '—',
  farbe = '—',
  power_handstueck = '—',
  liefertermin = '',
  bearbeiter = '—',
  anmerkungen = '',
  pdf_url = '#',
  expires_in_days = 14,
  is_reclamation = false,
}: ProductionOrderSupplierProps) => {
  const title = is_reclamation ? 'Reklamation' : 'Bestellung'
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{title} {order_number} – {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{SITE_NAME} – {title} {order_number}</Heading>
          <Text style={text}>
            {supplier_name ? `Sehr geehrtes Team von ${supplier_name},` : 'Sehr geehrte Damen und Herren,'}
          </Text>
          <Text style={text}>
            anbei finden Sie unsere {title.toLowerCase()} <strong>{order_number}</strong>.
            Das vollständige Bestell-PDF (zweisprachig) kann über den Button unten heruntergeladen werden.
          </Text>
          <Section style={infoSection}>
            <Text style={infoRow}><strong>Modell:</strong> {modellname || '—'}</Text>
            <Text style={infoRow}><strong>Farbe:</strong> {farbe || '—'}</Text>
            <Text style={infoRow}><strong>Power Handstück:</strong> {power_handstueck || '—'}</Text>
            <Text style={infoRow}><strong>Liefertermin:</strong> {liefertermin ? new Date(liefertermin).toLocaleDateString('de-DE') : '—'}</Text>
            <Text style={infoRow}><strong>Bearbeiter:</strong> {bearbeiter || '—'}</Text>
          </Section>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={pdf_url} style={btn}>Bestell-PDF herunterladen</Button>
          </Section>
          {anmerkungen ? (
            <Section>
              <Text style={text}><strong>Anmerkungen:</strong></Text>
              <Text style={text}>{anmerkungen}</Text>
            </Section>
          ) : null}
          <Text style={text}>
            Der Download-Link ist <strong>{expires_in_days} Tage</strong> gültig. Bitte bestätigen Sie den Erhalt
            und den voraussichtlichen Liefertermin.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Mit freundlichen Grüßen</Text>
          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ProductionOrderSupplierEmail,
  subject: (data: Record<string, any>) =>
    `${data.is_reclamation ? 'Reklamation' : 'Bestellung'} ${data.order_number ?? ''} – ${SITE_NAME}`,
  displayName: 'Produktionsbestellung an Zulieferer',
  previewData: {
    order_number: 'OR-00012-SO-1234',
    supplier_name: 'Beispiel GmbH',
    modellname: 'Alix Pro 3',
    farbe: 'Schwarz - Gold',
    power_handstueck: '2000W',
    liefertermin: '2026-06-01',
    bearbeiter: 'Max Mustermann',
    anmerkungen: 'Bitte rechtzeitig liefern.',
    pdf_url: 'https://example.com/order.pdf',
    expires_in_days: 14,
    is_reclamation: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#000000', margin: '0 0 24px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const infoSection = { backgroundColor: '#f5f0e6', borderRadius: '8px', padding: '20px', margin: '0 0 16px', border: '1px solid #e8dfc8' }
const infoRow = { fontSize: '13px', color: '#333', margin: '4px 0', lineHeight: '1.5' }
const btn = { backgroundColor: '#9a7b2d', color: '#fff', padding: '14px 28px', borderRadius: '6px', textDecoration: 'none', fontWeight: '600' as const, fontSize: '14px' }
const hr = { borderColor: '#e8dfc8', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '4px 0 0', lineHeight: '1.5' }
