/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item { invoice_number?: string; amount?: number; due_date?: string; days_overdue?: number }

interface Props {
  customerName?: string
  level?: number
  amount?: number
  fee?: number
  interest?: number
  total?: number
  dueDate?: string
  items?: Item[]
  iban?: string
  bic?: string
  bankName?: string
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
  4: 'Letzte Mahnung – Inkasso-Vorstufe',
}

const LEVEL_INTRO: Record<number, string> = {
  1: 'wir möchten Sie freundlich daran erinnern, dass folgende Rechnung(en) noch offen sind. Möglicherweise hat sich Ihre Zahlung mit diesem Schreiben überschnitten – in diesem Fall betrachten Sie unser Anschreiben bitte als gegenstandslos.',
  2: 'trotz unserer Zahlungserinnerung konnten wir bisher keinen Zahlungseingang feststellen. Wir bitten Sie, den ausstehenden Betrag umgehend zu begleichen.',
  3: 'leider mussten wir feststellen, dass der offene Betrag trotz unserer 1. Mahnung weiterhin nicht beglichen wurde. Wir setzen Ihnen hiermit eine letzte Frist zur Zahlung.',
  4: 'da unsere bisherigen Mahnungen ohne Reaktion blieben, weisen wir Sie darauf hin, dass wir bei weiterem Verzug die Forderung an unser Inkassobüro übergeben werden. Damit verbundene Kosten gehen zu Ihren Lasten.',
}

const fmt = (n?: number) => typeof n === 'number'
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
  : '–'

const Email = ({ customerName, level = 1, amount = 0, fee = 0, interest = 0, total = 0, dueDate, items = [], iban, bic, bankName }: Props) => (
  <Html lang="de">
    <Head />
    <Preview>{LEVEL_TITLES[level] ?? 'Mahnung'} – offener Betrag {fmt(total)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{LEVEL_TITLES[level] ?? 'Mahnung'}</Heading>
        <Text style={p}>Sehr geehrte Damen und Herren{customerName ? `, ${customerName}` : ''},</Text>
        <Text style={p}>{LEVEL_INTRO[level] ?? LEVEL_INTRO[1]}</Text>

        <Section style={card}>
          <Text style={cardLabel}>Offene Posten</Text>
          {items.length === 0 ? (
            <Text style={p}>Betrag: <strong>{fmt(amount)}</strong></Text>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={th}>Rechnung</th>
                  <th style={th}>Fällig</th>
                  <th style={{ ...th, textAlign: 'right' }}>Tage</th>
                  <th style={{ ...th, textAlign: 'right' }}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={td}>{it.invoice_number ?? '–'}</td>
                    <td style={td}>{it.due_date ?? '–'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{it.days_overdue ?? '–'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Hr style={hr} />
          <table style={{ width: '100%', fontSize: 14 }}>
            <tbody>
              <tr><td style={td}>Offener Betrag</td><td style={{ ...td, textAlign: 'right' }}>{fmt(amount)}</td></tr>
              {fee > 0 && <tr><td style={td}>Mahngebühr</td><td style={{ ...td, textAlign: 'right' }}>{fmt(fee)}</td></tr>}
              {interest > 0 && <tr><td style={td}>Verzugszinsen</td><td style={{ ...td, textAlign: 'right' }}>{fmt(interest)}</td></tr>}
              <tr><td style={{ ...td, fontWeight: 700 }}>Gesamt</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td></tr>
            </tbody>
          </table>
        </Section>

        {dueDate && <Text style={p}>Bitte überweisen Sie den Gesamtbetrag bis spätestens <strong>{dueDate}</strong>.</Text>}

        {(iban || bic) && (
          <Section style={card}>
            <Text style={cardLabel}>Bankverbindung</Text>
            {bankName && <Text style={p}>{bankName}</Text>}
            {iban && <Text style={p}>IBAN: {iban}</Text>}
            {bic && <Text style={p}>BIC: {bic}</Text>}
          </Section>
        )}

        <Text style={p}>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</Text>
        <Text style={p}>Mit freundlichen Grüßen<br />Ihr Alix Lasers Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${LEVEL_TITLES[d?.level ?? 1] ?? 'Mahnung'} – offener Betrag`,
  displayName: 'Mahnung / Zahlungserinnerung',
  previewData: {
    customerName: 'Max Mustermann',
    level: 2,
    amount: 1250.00,
    fee: 5.00,
    interest: 3.20,
    total: 1258.20,
    dueDate: '24.06.2026',
    items: [{ invoice_number: 'INV-2025-1234', amount: 1250.00, due_date: '14.05.2026', days_overdue: 28 }],
    iban: 'DE12 3456 7890 1234 5678 90',
    bic: 'COBADEFFXXX',
    bankName: 'Commerzbank',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container: React.CSSProperties = { padding: '24px', maxWidth: 640 }
const h1: React.CSSProperties = { color: '#111', fontSize: 24, fontWeight: 700, marginBottom: 16 }
const p: React.CSSProperties = { color: '#222', fontSize: 14, lineHeight: '22px', margin: '8px 0' }
const card: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, margin: '16px 0', backgroundColor: '#fafafa' }
const cardLabel: React.CSSProperties = { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }
const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 600 }
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#222' }
const hr: React.CSSProperties = { borderColor: '#e5e7eb', margin: '12px 0' }
