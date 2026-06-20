/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customerName?: string
  orderNumber?: string
  depositAmount?: number
  depositOkDate?: string
  invoiceLink?: string
  iban?: string
  bic?: string
  bankName?: string
  senderName?: string
}

const fmt = (n?: number) => typeof n === 'number'
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
  : '–'

const Email = ({
  customerName, orderNumber, depositAmount, depositOkDate, invoiceLink, iban, bic, bankName, senderName,
}: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Erinnerung an Ihre offene Anzahlungsrechnung {orderNumber ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Erinnerung: Anzahlungsrechnung</Heading>
        <Text style={p}>Sehr geehrte Damen und Herren{customerName ? `, ${customerName}` : ''},</Text>
        <Text style={p}>
          zu Ihrer Bestellung <strong>{orderNumber ?? ''}</strong>{depositOkDate ? ` vom ${depositOkDate}` : ''} haben wir
          Ihnen eine Anzahlungsrechnung über <strong>{fmt(depositAmount)}</strong> übermittelt. Nach unseren Unterlagen
          ist der Betrag bisher leider noch nicht bei uns eingegangen.
        </Text>
        <Text style={p}>
          Möglicherweise hat sich Ihre Überweisung mit diesem Schreiben überschnitten – in diesem Fall betrachten Sie
          unsere Erinnerung bitte als gegenstandslos. Andernfalls bitten wir Sie, die Zahlung in den nächsten Tagen
          vorzunehmen, damit wir Ihre Bestellung unverzüglich in die Produktion geben können.
        </Text>

        {invoiceLink && (
          <Section style={ctaWrap}>
            <a href={invoiceLink} style={cta}>Anzahlungsrechnung öffnen</a>
          </Section>
        )}

        {(iban || bic || bankName) && (
          <Section style={bankBox}>
            <Text style={bankTitle}>Bankverbindung</Text>
            {bankName && <Text style={bankLine}>Bank: {bankName}</Text>}
            {iban && <Text style={bankLine}>IBAN: {iban}</Text>}
            {bic && <Text style={bankLine}>BIC: {bic}</Text>}
            {orderNumber && <Text style={bankLine}>Verwendungszweck: {orderNumber}</Text>}
          </Section>
        )}

        <Hr style={hr} />
        <Text style={small}>
          Bei Fragen oder Unklarheiten stehen wir Ihnen jederzeit gerne zur Verfügung.
        </Text>
        <Text style={small}>
          Mit freundlichen Grüßen<br />
          {senderName ?? 'Alix Lasers'}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Erinnerung: Anzahlungsrechnung ${d.orderNumber ?? ''}`.trim(),
  displayName: 'Anzahlungsrechnung – Mahnung',
  previewData: {
    customerName: 'Mustermann GmbH',
    orderNumber: 'SO-12345',
    depositAmount: 1500,
    depositOkDate: '01.06.2026',
    invoiceLink: 'https://alixwork.de/d/example',
    iban: 'DE00 0000 0000 0000 0000 00',
    bic: 'XXXDEFFXXX',
    bankName: 'Beispielbank',
    senderName: 'Alix Lasers',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0b0b0b' }
const container: React.CSSProperties = { padding: '24px 28px', maxWidth: '620px', margin: '0 auto' }
const h1: React.CSSProperties = { fontSize: '20px', margin: '0 0 16px 0', color: '#0b0b0b' }
const p: React.CSSProperties = { fontSize: '14px', lineHeight: '22px', margin: '0 0 12px 0' }
const ctaWrap: React.CSSProperties = { textAlign: 'center', margin: '20px 0' }
const cta: React.CSSProperties = { display: 'inline-block', padding: '10px 18px', backgroundColor: '#C9A24B', color: '#0b0b0b', textDecoration: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '14px' }
const bankBox: React.CSSProperties = { backgroundColor: '#f7f5ef', border: '1px solid #e6dfc8', padding: '12px 14px', borderRadius: '6px', margin: '12px 0' }
const bankTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, margin: '0 0 6px 0' }
const bankLine: React.CSSProperties = { fontSize: '13px', margin: '2px 0' }
const hr: React.CSSProperties = { borderTop: '1px solid #e5e5e5', margin: '18px 0' }
const small: React.CSSProperties = { fontSize: '12px', color: '#555', margin: '4px 0' }
