/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customerName?: string
  invoiceNumber?: string
  invoiceDate?: string
  dueDate?: string
  currency?: string
  bankFee?: number
  handlingFee?: number
  total?: number
  returnDate?: string
  returnReason?: string
  originalInvoice?: string
  senderName?: string
}

const fmt = (n?: number, cur = 'EUR') =>
  typeof n === 'number'
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n)
    : '–'

const Email = ({
  customerName, invoiceNumber, invoiceDate, dueDate, currency = 'EUR',
  bankFee, handlingFee, total, returnDate, returnReason, originalInvoice, senderName,
}: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Gebührenrechnung {invoiceNumber ?? ''} – {fmt(total, currency)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Gebührenrechnung nach Rücklastschrift</Heading>

        <Text style={p}>Sehr geehrte Damen und Herren{customerName ? `, ${customerName}` : ''},</Text>

        <Text style={p}>
          am {returnDate ?? 'zuletzt'} wurde eine Lastschrift
          {originalInvoice ? ` zur Rechnung ${originalInvoice}` : ''} von Ihrer Bank zurückgegeben
          {returnReason ? ` (Grund: ${returnReason})` : ''}. Für die dadurch entstandenen Kosten
          stellen wir Ihnen die nachfolgenden Gebühren in Rechnung.
        </Text>

        <Section style={box}>
          <Text style={row}><strong>Rechnungsnummer:</strong> {invoiceNumber ?? '–'}</Text>
          <Text style={row}><strong>Rechnungsdatum:</strong> {invoiceDate ?? '–'}</Text>
          <Hr style={hr} />
          <Text style={row}>Bankgebühren Rücklastschrift: {fmt(bankFee, currency)}</Text>
          <Text style={row}>Bearbeitungsgebühr: {fmt(handlingFee, currency)}</Text>
          <Hr style={hr} />
          <Text style={totalRow}><strong>Gesamtbetrag: {fmt(total, currency)}</strong></Text>
          <Text style={row}><strong>Zahlbar bis:</strong> {dueDate ?? '–'}</Text>
        </Section>

        <Text style={p}>
          Bitte überweisen Sie den Betrag bis zum genannten Termin unter Angabe der
          Rechnungsnummer {invoiceNumber ?? ''}. Die Gebühren werden als Verzugsschaden
          gemäß § 280 BGB berechnet und enthalten keine Umsatzsteuer.
        </Text>

        <Text style={p}>
          Mit freundlichen Grüßen<br />
          {senderName ?? 'Alix Lasers – Buchhaltung'}
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#f6f6f6', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '32px', maxWidth: '600px' }
const h1 = { fontSize: '20px', color: '#111827', margin: '0 0 16px' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#374151' }
const box = { backgroundColor: '#f9fafb', padding: '16px', borderRadius: '6px', margin: '16px 0' }
const row = { fontSize: '14px', color: '#374151', margin: '4px 0' }
const totalRow = { fontSize: '16px', color: '#111827', margin: '8px 0' }
const hr = { borderColor: '#e5e7eb', margin: '12px 0' }

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Rücklastschrift – Gebührenrechnung',
  subject: (data: Record<string, any>) =>
    `Gebührenrechnung ${data?.invoiceNumber ?? ''} nach Rücklastschrift`,
  previewData: {
    customerName: 'Beauty & More GmbH',
    invoiceNumber: 'GEB-2026-0001',
    invoiceDate: '05.08.2026',
    dueDate: '12.08.2026',
    currency: 'EUR',
    bankFee: 15,
    handlingFee: 30,
    total: 45,
    returnDate: '01.08.2026',
    returnReason: 'Konto nicht gedeckt',
    originalInvoice: 'INV-11132',
    senderName: 'Alix Lasers – Buchhaltung',
  },
}
