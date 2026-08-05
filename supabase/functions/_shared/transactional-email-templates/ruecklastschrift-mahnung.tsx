/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item { invoice_number?: string | null; amount?: number; due_date?: string | null }

interface Props {
  customerName?: string
  returnDate?: string
  returnReason?: string
  returnCode?: string
  amount?: number
  fee?: number
  total?: number
  currency?: string
  payUntil?: string
  blockDate?: string
  mandateBlocked?: boolean
  items?: Item[]
  iban?: string
  bic?: string
  bankName?: string
  reference?: string
  senderName?: string
}

const fmt = (n?: number, cur = 'EUR') =>
  typeof n === 'number'
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n)
    : '–'

const Email = ({
  customerName, returnDate, returnReason, returnCode, amount, fee, total,
  currency = 'EUR', payUntil, blockDate, mandateBlocked, items = [],
  iban, bic, bankName, reference, senderName,
}: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Rücklastschrift – offene Forderung {fmt(total, currency)}, bitte bis {payUntil ?? 'zum genannten Termin'} ausgleichen</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Zahlungsaufforderung nach Rücklastschrift</Heading>

        <Text style={p}>Sehr geehrte Damen und Herren{customerName ? `, ${customerName}` : ''},</Text>

        <Text style={p}>
          die von uns eingezogene Lastschrift wurde{returnDate ? ` am ${returnDate}` : ''} von Ihrem
          Kreditinstitut zurückgegeben{returnReason ? ` – Grund: ${returnReason}` : ''}
          {returnCode ? ` (Rückgabecode ${returnCode})` : ''}. Die betroffene Forderung ist damit
          wieder offen; die zugehörige Rechnung wurde in unserem System erneut geöffnet.
        </Text>

        <Section style={box}>
          <Text style={boxTitle}>Offene Forderung</Text>
          {items.map((i, idx) => (
            <Text key={idx} style={line}>
              Rechnung {i.invoice_number ?? '–'}: {fmt(i.amount, currency)}
              {i.due_date ? ` (ursprünglich fällig am ${i.due_date})` : ''}
            </Text>
          ))}
          <Text style={line}>Rückbelasteter Betrag: {fmt(amount, currency)}</Text>
          {typeof fee === 'number' && fee > 0 && (
            <Text style={line}>Rücklastschriftgebühr: {fmt(fee, currency)}</Text>
          )}
          <Text style={lineStrong}>Gesamtbetrag: {fmt(total, currency)}</Text>
          {payUntil && <Text style={lineStrong}>Zahlbar bis: {payUntil}</Text>}
        </Section>

        <Section style={warnBox}>
          <Text style={warnTitle}>Wichtiger Hinweis: bevorstehende Sperre der Leistungen</Text>
          <Text style={warnText}>
            Sollte der Gesamtbetrag nicht bis zum {payUntil ?? 'genannten Termin'} vollständig auf
            unserem Konto eingegangen sein, sind wir gezwungen, sämtliche Leistungen von
            Alix Lasers{blockDate ? ` mit Wirkung zum ${blockDate}` : ''} vorübergehend zu sperren.
          </Text>
          <Text style={warnText}>
            Dies betrifft insbesondere die Freischaltung und den Betrieb Ihres Gerätes, Service- und
            Wartungsleistungen, Support, Schulungen sowie ausstehende Lieferungen. Die Sperre wird
            unmittelbar nach vollständigem Zahlungseingang wieder aufgehoben.
          </Text>
          {mandateBlocked && (
            <Text style={warnText}>
              Ihr SEPA-Lastschriftmandat haben wir vorsorglich gesperrt. Bitte überweisen Sie den
              Betrag daher manuell auf das unten genannte Konto.
            </Text>
          )}
        </Section>

        {(iban || bic || bankName) && (
          <Section style={bankBox}>
            <Text style={boxTitle}>Bankverbindung — Alix Lasers</Text>
            {bankName && <Text style={line}>Bank: {bankName}</Text>}
            {iban && <Text style={line}>IBAN: {iban}</Text>}
            {bic && <Text style={line}>SWIFT/BIC: {bic}</Text>}
            {reference && <Text style={line}>Verwendungszweck: {reference}</Text>}
          </Section>
        )}

        <Text style={p}>
          Sollte die Rücklastschrift auf einem Irrtum Ihres Kreditinstituts beruhen oder haben Sie
          den Betrag bereits ausgeglichen, setzen Sie sich bitte kurzfristig mit uns in Verbindung.
        </Text>

        <Hr style={hr} />
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
  subject: (d: Record<string, any>) =>
    `Rücklastschrift – offene Forderung${d.items?.[0]?.invoice_number ? ` zu Rechnung ${d.items[0].invoice_number}` : ''} und angekündigte Leistungssperre`,
  displayName: 'Rücklastschrift – Mahnung & Sperrankündigung',
  previewData: {
    customerName: 'Mustermann GmbH',
    returnDate: '05.08.2026',
    returnReason: 'Kontodeckung nicht ausreichend',
    returnCode: 'AM04',
    amount: 1200,
    fee: 8,
    total: 1208,
    currency: 'EUR',
    payUntil: '12.08.2026',
    blockDate: '13.08.2026',
    mandateBlocked: true,
    items: [{ invoice_number: 'INV-10960', amount: 1200, due_date: '01.08.2026' }],
    iban: 'DE00 0000 0000 0000 0000 00',
    bic: 'XXXDEFFXXX',
    bankName: 'Beispielbank',
    reference: 'INV-10960',
    senderName: 'Alix Lasers – Buchhaltung',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0b0b0b' }
const container: React.CSSProperties = { padding: '24px 28px', maxWidth: '620px', margin: '0 auto' }
const h1: React.CSSProperties = { fontSize: '20px', margin: '0 0 16px 0', color: '#0b0b0b' }
const p: React.CSSProperties = { fontSize: '14px', lineHeight: '22px', margin: '0 0 12px 0' }
const box: React.CSSProperties = { backgroundColor: '#f7f5ef', border: '1px solid #e6dfc8', padding: '12px 14px', borderRadius: '6px', margin: '12px 0' }
const bankBox: React.CSSProperties = box
const boxTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, margin: '0 0 6px 0' }
const line: React.CSSProperties = { fontSize: '13px', margin: '2px 0' }
const lineStrong: React.CSSProperties = { fontSize: '13px', margin: '4px 0 0 0', fontWeight: 700 }
const warnBox: React.CSSProperties = { backgroundColor: '#fdf2f2', border: '1px solid #f0b3b3', padding: '12px 14px', borderRadius: '6px', margin: '12px 0' }
const warnTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, margin: '0 0 6px 0', color: '#9b1c1c' }
const warnText: React.CSSProperties = { fontSize: '13px', lineHeight: '20px', margin: '4px 0', color: '#7a1616' }
const hr: React.CSSProperties = { borderTop: '1px solid #e5e5e5', margin: '18px 0' }
const small: React.CSSProperties = { fontSize: '12px', color: '#555', margin: '4px 0' }
