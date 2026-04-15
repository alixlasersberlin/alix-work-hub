/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Alix Work"

interface OtpCodeProps {
  otp?: string
}

const OtpCodeEmail = ({ otp = '000000' }: OtpCodeProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihr Sicherheitscode: {otp}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Text style={text}>Ihr Sicherheitscode lautet:</Text>
        <Section style={codeSection}>
          <Text style={codeText}>{otp}</Text>
        </Section>
        <Text style={text}>
          Dieser Code ist 5 Minuten gültig. Teilen Sie ihn niemals mit anderen Personen.
        </Text>
        <Text style={footer}>
          Falls Sie diesen Code nicht angefordert haben, können Sie diese E-Mail ignorieren.
        </Text>
        <Text style={footer}>— {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OtpCodeEmail,
  subject: 'Ihr Sicherheitscode – Alix Work',
  displayName: 'OTP Sicherheitscode',
  previewData: { otp: '123456' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#000000', margin: '0 0 24px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const codeSection = { 
  backgroundColor: '#f5f0e6', 
  borderRadius: '8px', 
  padding: '20px', 
  textAlign: 'center' as const, 
  margin: '0 0 24px',
  border: '1px solid #e8dfc8',
}
const codeText = { 
  fontSize: '32px', 
  fontWeight: '700' as const, 
  letterSpacing: '0.3em', 
  color: '#9a7b2d', 
  margin: '0', 
  fontFamily: "'Space Grotesk', monospace",
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0', lineHeight: '1.5' }
