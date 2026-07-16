/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Ihr Anmeldecode für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>AlixWork · Anmeldung</Heading>
        <Text style={text}>
          Geben Sie den folgenden 6-stelligen Code auf der Anmeldeseite ein:
        </Text>
        {token ? <Text style={codeStyle}>{token}</Text> : null}
        <Text style={text}>
          Alternativ können Sie diesen Button klicken, um sich direkt anzumelden:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Jetzt anmelden
        </Button>
        <Text style={footer}>
          Code und Link sind 10 Minuten gültig. Wenn Sie diese Anmeldung nicht
          angefordert haben, ignorieren Sie diese E-Mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '480px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  letterSpacing: '8px',
  textAlign: 'center' as const,
  backgroundColor: '#f5f5f5',
  padding: '16px 0',
  borderRadius: '8px',
  margin: '0 0 24px',
}
const button = {
  backgroundColor: '#0a0a0a',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
