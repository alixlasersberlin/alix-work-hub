import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers ®'

interface Props {
  first_name?: string
  last_name?: string
  company?: string | null
  email?: string
  phone?: string
  country_code?: string | null
  interests?: string[]
  additional_interests?: string[]
  delivery_preference?: string | null
  consultation_type?: string | null
  notes?: string | null
  service_rating?: number | null
}

const FAKTEN = [
  '16 Jahre Erfahrung',
  '10 Jahre Geräte - Garantie',
  'bis 132 Millionen Laserschüsse Laufleistung',
  'Kein Aufladen oder Einsenden von Schüssen',
  'Ersatzgerät bei Ausfall vor Ort',
  'flexible Finanzierung ohne Anzahlung',
  'Alix Mietkauf mit 0% Zinsen',
  'Alix Akademie zur Online Schule',
  '24/7 Betreuung durch Hotline',
  'Original Alix Lasers Ware',
]

const Email = (p: Props) => {
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sehr geehrte/r Kundin/Kunde'
  const row = (label: string, value?: string | null) =>
    value ? (
      <Text style={kv}>
        <span style={kvLabel}>{label}: </span>
        <span style={kvVal}>{value}</span>
      </Text>
    ) : null

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Vielen Dank für Ihre Anfrage bei Alix Lasers ®</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Vielen Dank für Ihre Anfrage!</Heading>
          <Text style={paragraph}>Hallo {fullName},</Text>
          <Text style={paragraph}>
            wir werden schnellstmöglich Ihre Anfrage bearbeiten.
          </Text>

          <Hr style={hr} />
          <Heading as="h2" style={h2}>Ihre Angaben</Heading>
          <Section style={card}>
            {row('Name', fullName)}
            {row('Firma', p.company ?? undefined)}
            {row('E-Mail', p.email)}
            {row('Telefon', [p.country_code, p.phone].filter(Boolean).join(' '))}
            {row('Beratungsart', p.consultation_type ?? undefined)}
            {row('Lieferzeitraum', p.delivery_preference ?? undefined)}
            {row(
              'Interessen',
              (p.interests && p.interests.length ? p.interests.join(', ') : undefined),
            )}
            {row(
              'Weitere Interessen',
              (p.additional_interests && p.additional_interests.length
                ? p.additional_interests.join(', ')
                : undefined),
            )}
            {row('Bewertung', p.service_rating ? `${p.service_rating} / 5` : undefined)}
            {p.notes ? (
              <>
                <Text style={kvLabel}>Nachricht:</Text>
                <Text style={kvVal}>{p.notes}</Text>
              </>
            ) : null}
          </Section>

          <Hr style={hr} />
          <Heading as="h2" style={h2}>Über {SITE_NAME}</Heading>
          <Text style={paragraph}>
            Seit 2010 steht Alix Lasers® für höchste Qualität und Innovation in der
            Beauty-Branche. Als weltweit erster Hersteller von Lasergeräten mit 100 %
            AI-Technologie setzen wir neue Maßstäbe in Präzision, Sicherheit und
            Effizienz. Mit über einem Jahrzehnt Erfahrung hat sich Alix Lasers® als
            verlässlicher Partner für Kosmetikstudios und medizinische Einrichtungen
            etabliert, die ihren Kunden nur das Beste bieten wollen.
          </Text>
          <Text style={paragraph}>
            Unsere revolutionären Systeme basieren auf vollständig AI-gestützter
            Technologie und nutzen automatisierte Haut- und Haarscanner, um sich in
            Echtzeit an individuelle Haut- und Haartypen anzupassen. Dadurch garantieren
            wir eine noch nie dagewesene Präzision, maximalen Komfort und beeindruckende
            Behandlungsergebnisse – ganz ohne manuelle Anpassungen.
          </Text>
          <Text style={paragraph}>
            Dank kontinuierlicher Forschung und Weiterentwicklung ermöglichen unsere
            AI-basierten Lasergeräte einen Arbeitsalltag, der effizienter, sicherer und
            komfortabler ist als je zuvor. Alix Lasers® bleibt seiner Vision treu:
            Fortschrittliche Technologien schaffen, die Deine Arbeit erleichtern und
            Deine Kunden nachhaltig beeindrucken. Entscheide Dich für Erfahrung,
            Qualität und die Zukunft der Laser-Technologie – entscheide Dich für
            Alix Lasers®.
          </Text>

          <Heading as="h2" style={h2}>Alix Lasers Fakten</Heading>
          <Section style={card}>
            {FAKTEN.map((f, i) => (
              <Text key={i} style={fact}>• {f}</Text>
            ))}
          </Section>

          <Text style={footer}>— Ihr {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Vielen Dank für Ihre Anfrage – Alix Lasers ®',
  displayName: 'Sales Wizard – Bestätigung',
  previewData: {
    first_name: 'Max',
    last_name: 'Mustermann',
    company: 'Musterstudio',
    email: 'max@example.com',
    phone: '0151 1234567',
    country_code: '+49',
    interests: ['Haarentfernung', 'Gesichtsbehandlungen'],
    additional_interests: ['Alix Academy'],
    delivery_preference: 'schnellstmöglich',
    consultation_type: 'Studio Beratung',
    notes: 'Bitte um Rückruf am Vormittag.',
    service_rating: 5,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '620px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold', color: '#0d0d0d', margin: '20px 0 10px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const card = { background: '#f7f7f9', borderRadius: '8px', padding: '14px 16px', margin: '0 0 8px' }
const kv = { fontSize: '14px', color: '#222', margin: '2px 0', lineHeight: '1.5' }
const kvLabel = { color: '#555', fontWeight: 600 }
const kvVal = { color: '#111' }
const fact = { fontSize: '14px', color: '#222', margin: '2px 0', lineHeight: '1.5' }
const hr = { borderColor: '#eee', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
