import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers'

interface Props {
  orderNumber?: string
  customerName?: string
  customerAddress?: string
  customerEmail?: string
  customerPhone?: string
  purchasePrice?: number | string | null
  downPayment?: number | string | null
  termMonths?: number | string | null
  residualValue?: number | string | null
  requestDate?: string
  totalAmount?: number | string | null
  currency?: string
  note?: string
  senderName?: string
}

const fmtMoney = (v: any, c = 'EUR') => {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return String(v)
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n)
  } catch {
    return `${n.toFixed(2)} ${c}`
  }
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Text style={rowText}>
    <span style={labelStyle}>{label}:</span> <span style={valueStyle}>{value}</span>
  </Text>
)

const BankFinancingRequestEmail = ({
  orderNumber,
  customerName,
  customerAddress,
  customerEmail,
  customerPhone,
  purchasePrice,
  downPayment,
  termMonths,
  residualValue,
  requestDate,
  totalAmount,
  currency,
  note,
  senderName,
}: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Leasing-Anfrage {orderNumber ?? ''} – {customerName ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Neue Leasing-Anfrage</Heading>
        <Text style={paragraph}>Guten Tag,</Text>
        <Text style={paragraph}>
          anbei eine neue Finanzierungs-/Leasing-Anfrage zur Prüfung. Bitte um kurze
          Rückmeldung, sobald eine Entscheidung vorliegt.
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Auftrag</Heading>
          <Row label="Auftragsnummer" value={orderNumber ?? '—'} />
          <Row label="Anfragedatum" value={requestDate ?? '—'} />
          <Row label="Gesamtbetrag" value={fmtMoney(totalAmount, currency)} />
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Kunde</Heading>
          <Row label="Name" value={customerName ?? '—'} />
          {customerAddress && <Row label="Adresse" value={customerAddress} />}
          {customerEmail && <Row label="E-Mail" value={customerEmail} />}
          {customerPhone && <Row label="Telefon" value={customerPhone} />}
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Konditionen</Heading>
          <Row label="Kaufpreis" value={fmtMoney(purchasePrice, currency)} />
          <Row label="Anzahlung" value={fmtMoney(downPayment, currency)} />
          <Row label="Laufzeit" value={termMonths ? `${termMonths} Monate` : '—'} />
          <Row label="Restwert" value={fmtMoney(residualValue, currency)} />
        </Section>

        {note && (
          <Section style={card}>
            <Heading as="h2" style={h2}>Anmerkung</Heading>
            <Text style={paragraph}>{note}</Text>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Mit freundlichen Grüßen<br />
          {senderName || SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BankFinancingRequestEmail,
  subject: (data: Record<string, any>) =>
    `Leasing-Anfrage ${data?.orderNumber ?? ''}${data?.customerName ? ' – ' + data.customerName : ''}`.trim(),
  displayName: 'Bank – Leasing-Anfrage',
  previewData: {
    orderNumber: 'SO-4153',
    customerName: 'Mustermann GmbH',
    customerAddress: 'Musterstr. 1, 12345 Musterstadt',
    customerEmail: 'info@mustermann.de',
    customerPhone: '+49 30 1234567',
    purchasePrice: 24500,
    downPayment: 5000,
    termMonths: 48,
    residualValue: 1000,
    requestDate: '01.05.2026',
    totalAmount: 24500,
    currency: 'EUR',
    note: 'Bitte zeitnah prüfen.',
    senderName: 'Alix Lasers Finanzteam',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const h2 = { fontSize: '15px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 10px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const card = {
  background: '#faf8f3',
  border: '1px solid #ece5d3',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '12px 0',
}
const rowText = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '4px 0' }
const labelStyle = { color: '#777', display: 'inline-block', minWidth: '130px' }
const valueStyle = { color: '#0d0d0d', fontWeight: 600 as const }
const hr = { borderColor: '#eeeeee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#777777', margin: '12px 0 0' }
