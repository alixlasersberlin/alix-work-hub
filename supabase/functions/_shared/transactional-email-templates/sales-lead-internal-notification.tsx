import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  lead_id?: string
  lead_number?: string | null
  source?: string | null
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  country_code?: string | null
  country?: string | null
  city?: string | null
  zip?: string | null
  interests?: string[] | null
  additional_interests?: string[] | null
  requested_products?: string | null
  delivery_preference?: string | null
  consultation_type?: string | null
  notes?: string | null
  lead_score?: number | null
  score_category?: string | null
  ai_priority?: string | null
  ai_summary?: string | null
  app_base_url?: string | null
}

const Email = (p: Props) => {
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
  const url = p.app_base_url && p.lead_id
    ? `${p.app_base_url.replace(/\/$/, '')}/verkauf/anfragen/${p.lead_id}`
    : null

  const row = (label: string, value?: string | null | number) =>
    value !== null && value !== undefined && String(value).length > 0 ? (
      <Text style={kv}>
        <span style={kvLabel}>{label}: </span>
        <span style={kvVal}>{String(value)}</span>
      </Text>
    ) : null

  const list = (label: string, arr?: string[] | null) =>
    arr && arr.length ? row(label, arr.join(', ')) : null

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Neue Verkaufsanfrage – {fullName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Neue Verkaufsanfrage</Heading>
          {p.lead_number ? <Text style={paragraph}><strong>Anfrage-Nr.:</strong> {p.lead_number}</Text> : null}
          {p.score_category || p.lead_score != null ? (
            <Text style={paragraph}>
              <strong>Score:</strong> {p.lead_score ?? '—'} ({p.score_category ?? '—'})
              {p.ai_priority ? ` · Priorität: ${p.ai_priority}` : ''}
            </Text>
          ) : null}

          <Hr style={hr} />
          <Heading as="h2" style={h2}>Kontakt</Heading>
          <Section>
            {row('Name', fullName)}
            {row('Firma', p.company)}
            {row('E-Mail', p.email)}
            {row('Telefon', [p.country_code, p.phone].filter(Boolean).join(' '))}
            {row('Ort', [p.zip, p.city, p.country].filter(Boolean).join(' '))}
            {row('Quelle', p.source)}
          </Section>

          <Hr style={hr} />
          <Heading as="h2" style={h2}>Anliegen</Heading>
          <Section>
            {list('Interessen', p.interests)}
            {list('Zusatzinteressen', p.additional_interests)}
            {row('Produkte', p.requested_products)}
            {row('Lieferung', p.delivery_preference)}
            {row('Beratungsart', p.consultation_type)}
            {row('Notizen', p.notes)}
          </Section>

          {p.ai_summary ? (
            <>
              <Hr style={hr} />
              <Heading as="h2" style={h2}>KI-Zusammenfassung</Heading>
              <Text style={paragraph}>{p.ai_summary}</Text>
            </>
          ) : null}

          {url ? (
            <>
              <Hr style={hr} />
              <Text style={paragraph}>
                <Link href={url} style={link}>Anfrage in Alix Work öffnen →</Link>
              </Text>
            </>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>Automatische interne Benachrichtigung · Alix Lasers ®</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.company || 'Unbekannt'
    const score = d.score_category ? ` · ${d.score_category}` : ''
    return `Neue Verkaufsanfrage – ${name}${score}`
  },
  displayName: 'Interne Benachrichtigung – Neue Verkaufsanfrage',
  previewData: {
    first_name: 'Max',
    last_name: 'Mustermann',
    company: 'Beispiel GmbH',
    email: 'max@example.com',
    phone: '0151 1234567',
    interests: ['Alix One', 'Alix Academy'],
    score_category: 'Heiß',
    lead_score: 78,
    ai_summary: 'Kunde mit konkretem Bedarf, kurze Lieferzeit gewünscht.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '22px', color: '#0a0f24', margin: '0 0 8px' }
const h2 = { fontSize: '15px', color: '#0a0f24', margin: '16px 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const paragraph = { fontSize: '14px', color: '#1f2937', lineHeight: '1.55', margin: '6px 0' }
const kv = { fontSize: '14px', color: '#1f2937', lineHeight: '1.55', margin: '2px 0' }
const kvLabel = { color: '#6b7280' }
const kvVal = { color: '#0a0f24', fontWeight: 600 as const }
const hr = { borderColor: '#e5e7eb', margin: '18px 0' }
const link = { color: '#b8860b', fontWeight: 600 as const }
const footer = { fontSize: '12px', color: '#6b7280', marginTop: '12px' }
