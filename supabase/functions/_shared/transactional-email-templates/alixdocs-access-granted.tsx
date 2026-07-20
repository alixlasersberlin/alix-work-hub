import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers Datacenter'

interface Props {
  recipientName?: string
  appUrl?: string
}

const AlixDocsAccessGrantedEmail = ({ recipientName, appUrl = 'https://app.alixwork.de/dokumente/dashboard' }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>ALIXDOCS – Zugriff freigeschaltet</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>ALIXDOCS – Zugriff freigeschaltet</Heading>
        <Text style={paragraph}>Hallo {recipientName || ''},</Text>
        <Text style={paragraph}>
          du hast ab sofort Zugriff auf das Modul <strong>ALIXDOCS</strong> in AlixWork
          mit folgenden Bereichen:
        </Text>
        <Section style={box}>
          <Text style={li}>• Dashboard</Text>
          <Text style={li}>• Dokumentensuche</Text>
          <Text style={li}>• Bulk Import</Text>
          <Text style={li}>• AI-Suche ✨</Text>
        </Section>
        <Section style={{ textAlign: 'center' as const, margin: '20px 0' }}>
          <Button href={appUrl} style={button}>ALIXDOCS öffnen</Button>
        </Section>
        <Text style={paragraph}>
          Bei Fragen wende dich gerne an das Alix Work Team.
        </Text>
        <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AlixDocsAccessGrantedEmail,
  subject: () => 'ALIXDOCS – Zugriff freigeschaltet',
  displayName: 'ALIXDOCS – Zugriff freigeschaltet',
  previewData: { recipientName: 'Max Mustermann' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 16px' }
const paragraph = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 8px' }
const box = { background: '#f7f7f7', padding: '14px 16px', borderRadius: '6px', margin: '12px 0' }
const li = { fontSize: '14px', color: '#333333', margin: '0 0 4px', lineHeight: '1.6' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', padding: '12px 22px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
