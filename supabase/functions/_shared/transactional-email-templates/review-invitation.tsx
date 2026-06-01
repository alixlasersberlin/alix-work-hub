import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Alix Lasers'

interface Props {
  customerName?: string
  orderNumber?: string
  reviewUrl?: string
}

const ReviewInvitationEmail = ({ customerName, orderNumber, reviewUrl }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihre Bewertung zu Ihrer {SITE_NAME} Lieferung</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ihre Meinung ist uns wichtig</Heading>
        <Text style={text}>
          {customerName ? `Sehr geehrte/r ${customerName},` : 'Sehr geehrte Kundin, sehr geehrter Kunde,'}
        </Text>
        <Text style={text}>
          vielen Dank für Ihr Vertrauen in {SITE_NAME}.
        </Text>
        <Text style={text}>
          Wir möchten unseren Service stetig verbessern und bitten Sie daher um eine
          kurze Bewertung Ihrer Lieferung{orderNumber ? ` (Auftrag ${orderNumber})` : ''} und Einweisung.
        </Text>
        {reviewUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={reviewUrl} style={button}>Jetzt Bewertung abgeben</Button>
          </Section>
        )}
        <Text style={text}>Vielen Dank.</Text>
        <Text style={footer}>Ihr {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReviewInvitationEmail,
  subject: 'Ihre Bewertung zu Ihrer Alix Lasers Lieferung',
  displayName: 'Bewertungseinladung',
  previewData: {
    customerName: 'Max Mustermann',
    orderNumber: 'SO-12345',
    reviewUrl: 'https://alix-finance.de/bewertung/example-token',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0d0d0d', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 14px' }
const footer = { fontSize: '13px', color: '#666666', margin: '24px 0 0' }
const button = {
  backgroundColor: '#0d0d0d',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
}
