import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers Datacenter'

interface TaskRow {
  offer_number?: string
  customer_name?: string
  title?: string
  stage?: number
  due_at?: string
  priority?: string
  overdue_days?: number
}

interface Props {
  ownerName?: string
  tasks?: TaskRow[]
  portalUrl?: string
}

const fmtDate = (v?: string) => {
  if (!v) return ''
  try { return new Date(v).toLocaleDateString('de-DE') } catch { return String(v) }
}

const OfferFollowupDigestEmail = ({ ownerName, tasks = [], portalUrl }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>{`${tasks.length} Angebote zum Nachfassen`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nachfass-Erinnerung: {tasks.length} Angebote</Heading>
        <Text style={paragraph}>
          Hallo {ownerName || 'Team'}, folgende Angebote sind heute zum Nachfassen fällig:
        </Text>

        <Section style={listBox}>
          {tasks.slice(0, 60).map((t, i) => (
            <Text key={i} style={row}>
              <strong>{t.offer_number}</strong>
              {t.customer_name ? ` · ${t.customer_name}` : ''}
              {t.title ? ` · ${t.title}` : ''}
              {t.due_at ? ` · fällig ${fmtDate(t.due_at)}` : ''}
              {t.overdue_days && t.overdue_days > 0 ? ` · ${t.overdue_days} Tage überfällig` : ''}
            </Text>
          ))}
          {tasks.length > 60 && <Text style={paragraph}>… und {tasks.length - 60} weitere.</Text>}
        </Section>

        <Hr style={hr} />
        <Text style={paragraph}>
          Öffnen: <a href={portalUrl || 'https://app.alixwork.de/verkauf/angebotsanalyse'} style={link}>Angebotsanalyse – Nachfassen</a>
        </Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OfferFollowupDigestEmail,
  subject: (data: Record<string, any>) =>
    `Nachfassen: ${Array.isArray(data?.tasks) ? data.tasks.length : 0} Angebote fällig`,
  displayName: 'Angebote – Nachfass-Erinnerung',
  previewData: {
    ownerName: 'Max Mustermann',
    tasks: [
      { offer_number: 'ANG-1001', customer_name: 'Beauty Lounge', title: 'Nachfassen', due_at: new Date().toISOString(), overdue_days: 2 },
    ],
    portalUrl: 'https://app.alixwork.de/verkauf/angebotsanalyse',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '680px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 12px' }
const listBox = { background: '#f7f7f7', padding: '12px 14px', borderRadius: '6px', margin: '12px 0' }
const row = { fontSize: '13px', color: '#222', margin: '0 0 4px', lineHeight: '1.5', fontFamily: 'monospace' }
const paragraph = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 8px' }
const hr = { borderColor: '#e5e5e5', margin: '18px 0' }
const link = { color: '#b45309', fontWeight: 'bold' }
const footer = { fontSize: '12px', color: '#999', margin: '20px 0 0' }
