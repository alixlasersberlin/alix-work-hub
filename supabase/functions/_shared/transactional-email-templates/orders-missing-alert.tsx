import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers Datacenter'

interface MissingRow {
  source_system?: string
  order_number?: string
  external_order_id?: string
  customer_name?: string
  zoho_date?: string
  zoho_status?: string
  total?: number | string
}

interface Props {
  count?: number
  orders?: MissingRow[]
  portalUrl?: string
  testMode?: boolean
}

const OrdersMissingAlertEmail = ({ count = 0, orders = [], portalUrl, testMode }: Props) => {
  const subject = 'Alten Auftrag in Fremdsystemen gefunden - Sofort bearbeiten'
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={priorityBanner}>
            <Text style={priorityText}>⚠️ HÖCHSTE PRIORITÄT – SOFORT BEARBEITEN</Text>
          </Section>

          <Heading style={h1}>{subject}</Heading>

          {testMode && (
            <Section style={testBox}>
              <Text style={paragraph}><strong>🧪 TEST-E-MAIL</strong> – Dies ist ein Test der neuen Benachrichtigung.</Text>
            </Section>
          )}

          <Text style={paragraph}>
            Es wurden <strong>{count}</strong> alte Aufträge aus Fremdsystemen (Zoho DE/AT) gefunden,
            die noch nicht in AlixWork vorhanden waren. Diese müssen <strong>sofort</strong> bearbeitet werden:
            Zahlungen und Auftragsdaten prüfen, dann läuft der normale Ablauf wieder.
          </Text>

          {orders.length > 0 && (
            <Section style={listBox}>
              <Heading as="h2" style={h2}>Neue Einträge in „Aufträge gesucht"</Heading>
              {orders.slice(0, 50).map((o, i) => (
                <Text key={i} style={row}>
                  <strong>{o.order_number || o.external_order_id}</strong>
                  {o.customer_name ? ` · ${o.customer_name}` : ''}
                  {o.zoho_date ? ` · ${o.zoho_date}` : ''}
                  {o.source_system ? ` · ${o.source_system === 'zoho_eu_2' ? '🇦🇹 AT' : '🇩🇪 DE'}` : ''}
                  {o.zoho_status ? ` · ${o.zoho_status}` : ''}
                </Text>
              ))}
              {orders.length > 50 && (
                <Text style={paragraph}>… und {orders.length - 50} weitere.</Text>
              )}
            </Section>
          )}

          <Hr style={hr} />
          <Text style={paragraph}>
            Zur Bearbeitung öffnen: <a href={portalUrl || 'https://app.alixwork.de/auftraege/gesucht'} style={link}>Aufträge gesucht</a>
          </Text>

          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrdersMissingAlertEmail,
  subject: () => 'Alten Auftrag in Fremdsystemen gefunden - Sofort bearbeiten',
  displayName: 'Aufträge gesucht – Sofort-Benachrichtigung',
  previewData: {
    count: 2,
    orders: [
      { order_number: 'SO-3540', customer_name: 'Skin Master', zoho_date: '2024-12-04', source_system: 'zoho_eu_1', zoho_status: 'confirmed' },
      { order_number: 'SO-3658', customer_name: 'Blueice', zoho_date: '2025-04-28', source_system: 'zoho_eu_1', zoho_status: 'confirmed' },
    ],
    portalUrl: 'https://app.alixwork.de/auftraege/gesucht',
    testMode: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '680px' }
const priorityBanner = { background: '#b91c1c', padding: '10px 14px', borderRadius: '6px', margin: '0 0 16px' }
const priorityText = { color: '#ffffff', fontSize: '13px', fontWeight: 'bold', margin: 0, letterSpacing: '0.5px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 12px' }
const h2 = { fontSize: '15px', fontWeight: 'bold', color: '#0d0d0d', margin: '4px 0 8px' }
const testBox = { background: '#fef3c7', padding: '10px 12px', borderRadius: '6px', margin: '0 0 12px' }
const listBox = { background: '#f7f7f7', padding: '12px 14px', borderRadius: '6px', margin: '12px 0' }
const row = { fontSize: '13px', color: '#222', margin: '0 0 4px', lineHeight: '1.5', fontFamily: 'monospace' }
const paragraph = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 8px' }
const hr = { borderColor: '#e5e5e5', margin: '18px 0' }
const link = { color: '#b45309', fontWeight: 'bold' }
const footer = { fontSize: '12px', color: '#999', margin: '20px 0 0' }
