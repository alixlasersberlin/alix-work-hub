import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers Datacenter'

interface CommentEntry { author?: string; created_at?: string; text: string }

interface Props {
  ticketNumber?: string
  title?: string
  description?: string
  reporterName?: string
  closedBy?: string
  closedAt?: string
  newStatus?: string
  fields?: Array<{ label: string; value: string }>
  comments?: CommentEntry[]
}

const BugClosedNotificationEmail = ({
  ticketNumber,
  title,
  description,
  reporterName,
  closedBy,
  closedAt,
  newStatus = 'geschlossen',
  fields = [],
  comments = [],
}: Props) => {
  const subjectLine = `Bug ${ticketNumber ?? ''} ${newStatus === 'erledigt' ? 'erledigt' : 'geschlossen'}${title ? ` – ${title}` : ''}`.trim()
  const descLines = (description ?? '').split('\n')
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{subjectLine}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subjectLine}</Heading>

          <Text style={paragraph}>
            Guten Tag{reporterName ? ` ${reporterName}` : ''},
          </Text>
          <Text style={paragraph}>
            Ihr gemeldeter Bug wurde als <strong>{newStatus}</strong> markiert
            {closedBy ? ` von ${closedBy}` : ''}
            {closedAt ? ` am ${closedAt}` : ''}.
          </Text>

          <Section style={metaBox}>
            {ticketNumber && <Text style={metaRow}><strong>Nummer:</strong> {ticketNumber}</Text>}
            {title && <Text style={metaRow}><strong>Titel:</strong> {title}</Text>}
            {fields.map((f, i) => (
              <Text key={i} style={metaRow}><strong>{f.label}:</strong> {f.value || '—'}</Text>
            ))}
          </Section>

          {descLines.some((l) => l.trim() !== '') && (
            <Section>
              <Heading as="h2" style={h2}>Ursprüngliche Beschreibung</Heading>
              {descLines.map((line, i) =>
                line.trim() === ''
                  ? <div key={i} style={{ height: 8 }} />
                  : <Text key={i} style={paragraph}>{line}</Text>
              )}
            </Section>
          )}

          {comments.length > 0 && (
            <Section>
              <Heading as="h2" style={h2}>Antwort / Verlauf</Heading>
              {comments.map((c, i) => (
                <Section key={i} style={commentBox}>
                  <Text style={commentMeta}>
                    {c.author || 'Team'}{c.created_at ? ` · ${c.created_at}` : ''}
                  </Text>
                  {c.text.split('\n').map((line, j) => (
                    <Text key={j} style={paragraph}>{line || '\u00A0'}</Text>
                  ))}
                </Section>
              ))}
            </Section>
          )}

          <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />
          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BugClosedNotificationEmail,
  subject: (data: Record<string, any>) => {
    const t = (data?.ticketNumber as string) || ''
    const title = (data?.title as string) || ''
    const status = (data?.newStatus as string) === 'erledigt' ? 'erledigt' : 'geschlossen'
    return `[Bug ${t}] ${status}${title ? ` – ${title}` : ''}`.trim()
  },
  displayName: 'Bug – Geschlossen-Benachrichtigung',
  previewData: {
    ticketNumber: 'BUG-00012',
    title: 'Display flackert bei Demo-Modus',
    description: 'Beim Wechsel in den Demo-Modus flackert das Display für ca. 2 Sekunden.',
    reporterName: 'Max Mustermann',
    closedBy: 'QM Team',
    closedAt: '2026-07-19',
    newStatus: 'geschlossen',
    fields: [
      { label: 'Produkt', value: 'Lumix Pro' },
      { label: 'Priorität', value: 'hoch' },
    ],
    comments: [
      { author: 'QM', created_at: '2026-07-18', text: 'Ursache identifiziert: Firmware-Bug in v2.14.\nFix in v2.15 ausgerollt.' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const h2 = { fontSize: '15px', fontWeight: 'bold', color: '#0d0d0d', margin: '18px 0 8px' }
const metaBox = { background: '#f7f7f7', padding: '12px 14px', borderRadius: '6px', margin: '0 0 16px' }
const metaRow = { fontSize: '13px', color: '#333333', margin: '0 0 4px', lineHeight: '1.5' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 8px' }
const commentBox = { background: '#fafafa', border: '1px solid #ececec', borderRadius: '6px', padding: '10px 12px', margin: '0 0 10px' }
const commentMeta = { fontSize: '12px', color: '#666666', margin: '0 0 6px', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
