import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Work'

interface Props {
  customerName?: string
  ticketNumber?: string
  subject?: string
  csatUrl?: string
}

const stars = ['1', '2', '3', '4', '5']

const TicketCsatEmail = ({ customerName, ticketNumber, subject, csatUrl }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Wie zufrieden waren Sie mit der Bearbeitung?</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Wie zufrieden waren Sie?</Heading>
        <Text style={text}>
          {customerName ? `Hallo ${customerName},` : 'Hallo,'}
        </Text>
        <Text style={text}>
          Ihr Anliegen {ticketNumber ? <>zum Ticket <strong>{ticketNumber}</strong></> : null}
          {subject ? <> („{subject}")</> : null} wurde bearbeitet.
          Bitte helfen Sie uns mit einer kurzen Bewertung — ein Klick genügt.
        </Text>
        {csatUrl && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <table style={{ margin: '0 auto' }}><tbody><tr>
              {stars.map((n) => (
                <td key={n} style={{ padding: '0 4px' }}>
                  <a href={`${csatUrl}?r=${n}`} style={starBtn}>{'★'.repeat(Number(n))}<div style={starLabel}>{n}</div></a>
                </td>
              ))}
            </tr></tbody></table>
          </Section>
        )}
        {csatUrl && (
          <Section style={{ textAlign: 'center', margin: '10px 0 20px' }}>
            <Button href={csatUrl} style={button}>Bewertung öffnen</Button>
          </Section>
        )}
        <Text style={footer}>Vielen Dank — Ihr {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TicketCsatEmail,
  subject: (d: Record<string, any>) => `Ihre Bewertung zu Ticket ${d.ticketNumber ?? ''}`.trim(),
  displayName: 'Ticket-Zufriedenheit (CSAT)',
  previewData: {
    customerName: 'Max Mustermann',
    ticketNumber: 'TCK-12345',
    subject: 'Frage zu Rechnung',
    csatUrl: 'https://alixwork.de/csat/example-token',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 14px' }
const footer = { fontSize: '13px', color: '#666', margin: '24px 0 0' }
const starBtn = { display: 'inline-block', textDecoration: 'none', color: '#f5b301', fontSize: '18px', textAlign: 'center' as const }
const starLabel = { color: '#666', fontSize: '11px', marginTop: '2px' }
const button = {
  backgroundColor: '#0d0d0d', color: '#fff', padding: '12px 22px',
  borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600,
}
