import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  appUrl?: string
}

const CapaCockpitAnnouncementEmail = ({ recipientName, appUrl = 'https://app.alixwork.de/bug-capa/capa-cockpit' }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Welcome CAPA 2.0 Cockpit – ab sofort für alle verfügbar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome CAPA 2.0 Cockpit</Heading>

        <Text style={paragraph}>Guten Tag{recipientName ? ` ${recipientName}` : ''},</Text>

        <Text style={paragraph}>
          auf Wunsch von Herrn Kantert wurde das <strong>CAPA 2.0 Cockpit</strong> in ALIXWORK umgesetzt
          und ist ab sofort online verfügbar.
        </Text>

        <Text style={paragraph}>
          Das Cockpit bildet den vollständigen CAPA-Prozess nach ISO 13485 / MDR in 12 Schritten ab –
          von der Reklamation über Vigilanz-Bewertung, Root-Cause-Analyse und Risikomanagement bis zu
          FSCA, Wirksamkeitsprüfung und Abschluss. Eine Reklamation löst dabei nicht automatisch eine
          CAPA aus: Eine dokumentierte „No-CAPA-Decision“ ist ausdrücklich vorgesehen.
        </Text>

        <Text style={paragraph}>
          Der Zugriff wurde für <strong>alle Mitarbeiterinnen und Mitarbeiter</strong> freigeschaltet.
          Das Bearbeiten der Fälle bleibt weiterhin dem QM-Bereich vorbehalten.
        </Text>

        <Text style={paragraph}>
          Direkt zum Cockpit: <Link href={appUrl} style={link}>{appUrl}</Link>
        </Text>

        <Hr style={hr} />
        <Text style={footer}>Diese Nachricht wurde automatisch von ALIXWORK versendet.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CapaCockpitAnnouncementEmail,
  subject: 'Welcome CAPA 2.0 Cockpit',
  displayName: 'CAPA 2.0 Cockpit – Ankündigung',
  previewData: { recipientName: 'Max Mustermann' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const link = { color: '#8a6d1f', textDecoration: 'underline' }
const hr = { borderColor: '#ececec', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
