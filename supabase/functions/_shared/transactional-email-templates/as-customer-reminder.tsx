/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

type Kind = 'app' | 'nisv' | 'schulung' | 'mediapaket' | 'feedback' | 'callback' | 'generic'

interface Props {
  customerName?: string
  kind?: Kind
  orderNumber?: string
  deviceModel?: string
  ctaLabel?: string
  ctaUrl?: string
  customMessage?: string
  signature?: string
}

const COPY: Record<Kind, { title: string; intro: string; cta: string }> = {
  app: {
    title: 'Ihre Alix Smart App wartet auf Sie',
    intro: 'wir möchten sicherstellen, dass Sie Ihr Gerät optimal nutzen können. Bitte installieren Sie die Alix Smart App und melden Sie sich an, um Schulungsinhalte, Behandlungsprotokolle und Wartungs-Hinweise direkt auf Ihrem Smartphone zu erhalten.',
    cta: 'Alix Smart App installieren',
  },
  nisv: {
    title: 'Wichtig: NiSV-Nachweis ausstehend',
    intro: 'für den rechtssicheren Betrieb Ihres Lasergerätes benötigen wir den NiSV-Nachweis Ihrer Anwender. Bitte laden Sie die entsprechenden Zertifikate in Ihrem Kundenportal hoch oder kontaktieren Sie uns für eine Schulung.',
    cta: 'NiSV-Nachweis hochladen',
  },
  schulung: {
    title: 'Schulungstermin – wir reservieren gern einen Platz für Sie',
    intro: 'damit Sie und Ihr Team das volle Potential Ihres Gerätes ausschöpfen können, empfehlen wir die Teilnahme an unserer Anwender­schulung. Wir haben aktuell freie Termine und schlagen Ihnen gern einen passenden vor.',
    cta: 'Schulungstermin auswählen',
  },
  mediapaket: {
    title: 'Ihr Mediapaket – damit Ihre Behandlungen sichtbar werden',
    intro: 'Ihr Mediapaket (Grafiken, Homepage-Module, Social Media Vorlagen) ist noch nicht final eingerichtet. Damit Sie schnell mit der Vermarktung Ihrer neuen Behandlungen starten können, fehlen uns nur noch wenige Informationen.',
    cta: 'Mediapaket-Daten ergänzen',
  },
  feedback: {
    title: 'Wie zufrieden sind Sie mit Alix?',
    intro: 'Ihre Meinung ist uns wichtig. Mit nur 2 Minuten Ihrer Zeit helfen Sie uns, unseren Service weiter zu verbessern. Wir würden uns sehr über Ihr Feedback und – wenn Sie zufrieden waren – eine Weiterempfehlung freuen.',
    cta: 'Feedback geben',
  },
  callback: {
    title: 'Wir melden uns gern bei Ihnen zurück',
    intro: 'unser Team möchte einen Rückruf mit Ihnen vereinbaren, um offene Themen zu klären und Sie bestmöglich zu unterstützen. Bitte teilen Sie uns einen für Sie passenden Zeitpunkt mit.',
    cta: 'Rückruf-Termin auswählen',
  },
  generic: {
    title: 'Eine Nachricht von Ihrem Alix After-Sales-Team',
    intro: 'wir möchten uns kurz bei Ihnen melden und sicherstellen, dass alles rund um Ihr Alix-Gerät zu Ihrer vollsten Zufriedenheit läuft.',
    cta: 'Jetzt antworten',
  },
}

const Email = ({
  customerName, kind = 'generic', orderNumber, deviceModel,
  ctaLabel, ctaUrl, customMessage, signature = 'Ihr Alix After-Sales-Team',
}: Props) => {
  const c = COPY[kind] ?? COPY.generic
  return (
    <Html lang="de">
      <Head />
      <Preview>{c.title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{c.title}</Heading>
          <Text style={p}>Sehr geehrte Damen und Herren{customerName ? `, ${customerName}` : ''},</Text>
          <Text style={p}>{customMessage ?? c.intro}</Text>

          {(orderNumber || deviceModel) && (
            <Section style={card}>
              <Text style={cardLabel}>Ihr Vorgang</Text>
              {orderNumber && <Text style={p}>Auftrag: <strong>{orderNumber}</strong></Text>}
              {deviceModel && <Text style={p}>Gerät: <strong>{deviceModel}</strong></Text>}
            </Section>
          )}

          {ctaUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={ctaUrl} style={btn}>{ctaLabel ?? c.cta}</Button>
            </Section>
          )}

          <Text style={p}>Bei Fragen stehen wir Ihnen jederzeit telefonisch oder per E-Mail zur Verfügung.</Text>
          <Text style={p}>Mit freundlichen Grüßen<br />{signature}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => (COPY[(d?.kind as Kind) ?? 'generic'] ?? COPY.generic).title,
  displayName: 'After Sales – Kunden-Erinnerung',
  previewData: {
    customerName: 'Frau Mustermann',
    kind: 'app',
    orderNumber: 'AUF-2026-0123',
    deviceModel: 'Alix Pro Diode',
    ctaUrl: 'https://alixwork.de',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container: React.CSSProperties = { padding: '24px', maxWidth: 640 }
const h1: React.CSSProperties = { color: '#111', fontSize: 22, fontWeight: 700, marginBottom: 16 }
const p: React.CSSProperties = { color: '#222', fontSize: 14, lineHeight: '22px', margin: '8px 0' }
const card: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, margin: '16px 0', backgroundColor: '#fafafa' }
const cardLabel: React.CSSProperties = { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }
const btn: React.CSSProperties = { backgroundColor: '#111827', color: '#ffffff', padding: '12px 22px', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600 }
