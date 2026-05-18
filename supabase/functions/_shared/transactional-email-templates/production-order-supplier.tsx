/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Alix Work"

interface ProductionOrderSupplierProps {
  order_number?: string
  supplier_name?: string
  modellname?: string
  farbe?: string
  power_handstueck?: string
  liefertermin?: string
  bearbeiter?: string
  anmerkungen?: string
  pdf_url?: string
  is_reclamation?: boolean
}

const ProductionOrderSupplierEmail = ({
  order_number = '—',
  supplier_name = '',
  modellname = '—',
  farbe = '—',
  power_handstueck = '—',
  liefertermin = '',
  bearbeiter = '—',
  anmerkungen = '',
  pdf_url = '#',
  is_reclamation = false,
}: ProductionOrderSupplierProps) => {
  const titleEn = is_reclamation ? 'Reclamation' : 'Order'
  const titleZh = is_reclamation ? '索赔' : '订单'
  const formattedDate = liefertermin ? new Date(liefertermin).toLocaleDateString('en-GB') : '—'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{titleEn} {order_number} – {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* ===== ENGLISH ===== */}
          <Heading style={h1}>{SITE_NAME} – {titleEn} {order_number}</Heading>
          <Text style={text}>
            {supplier_name ? `Dear ${supplier_name} team,` : 'Dear Sir or Madam,'}
          </Text>
          <Text style={text}>
            please find attached our {titleEn.toLowerCase()} <strong>{order_number}</strong>.
            The complete bilingual order PDF can be downloaded via the button below.
          </Text>
          <Section style={infoSection}>
            <Text style={infoRow}><strong>Model:</strong> {modellname || '—'}</Text>
            <Text style={infoRow}><strong>Color:</strong> {farbe || '—'}</Text>
            <Text style={infoRow}><strong>Handpiece Power:</strong> {power_handstueck || '—'}</Text>
            <Text style={infoRow}><strong>Delivery Date:</strong> {formattedDate}</Text>
            <Text style={infoRow}><strong>Contact:</strong> {bearbeiter || '—'}</Text>
          </Section>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={pdf_url} style={btn}>Download Order PDF</Button>
          </Section>
          {anmerkungen ? (
            <Section>
              <Text style={text}><strong>Notes:</strong></Text>
              <Text style={text}>{anmerkungen}</Text>
            </Section>
          ) : null}
          <Text style={text}>
            Please confirm receipt and the expected delivery date.
          </Text>
          <Text style={footer}>Best regards</Text>
          <Text style={footer}>— {SITE_NAME}</Text>

          <Hr style={hr} />

          {/* ===== CHINESE ===== */}
          <Heading style={h1}>{SITE_NAME} – {titleZh} {order_number}</Heading>
          <Text style={text}>
            {supplier_name ? `尊敬的 ${supplier_name} 团队：` : '尊敬的女士／先生：'}
          </Text>
          <Text style={text}>
            随函附上我们的{titleZh} <strong>{order_number}</strong>。
            完整的双语订单 PDF 可通过下方按钮下载。
          </Text>
          <Section style={infoSection}>
            <Text style={infoRow}><strong>型号：</strong> {modellname || '—'}</Text>
            <Text style={infoRow}><strong>颜色：</strong> {farbe || '—'}</Text>
            <Text style={infoRow}><strong>手柄功率：</strong> {power_handstueck || '—'}</Text>
            <Text style={infoRow}><strong>交货日期：</strong> {formattedDate}</Text>
            <Text style={infoRow}><strong>联系人：</strong> {bearbeiter || '—'}</Text>
          </Section>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={pdf_url} style={btn}>下载订单 PDF</Button>
          </Section>
          {anmerkungen ? (
            <Section>
              <Text style={text}><strong>备注：</strong></Text>
              <Text style={text}>{anmerkungen}</Text>
            </Section>
          ) : null}
          <Text style={text}>
            请确认收到并告知预计交货日期。
          </Text>
          <Hr style={hr} />
          <Text style={footer}>此致敬礼</Text>
          <Text style={footer}>— {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ProductionOrderSupplierEmail,
  subject: (data: Record<string, any>) => {
    const en = data.is_reclamation ? 'Reclamation' : 'Order'
    const zh = data.is_reclamation ? '索赔' : '订单'
    return `${en} / ${zh} ${data.order_number ?? ''} – ${SITE_NAME}`
  },
  displayName: 'Produktionsbestellung an Zulieferer (EN/ZH)',
  previewData: {
    order_number: 'OR-00012-SO-1234',
    supplier_name: 'Beispiel GmbH',
    modellname: 'Alix Pro 3',
    farbe: 'Black - Gold',
    power_handstueck: '2000W',
    liefertermin: '2026-06-01',
    bearbeiter: 'Max Mustermann',
    anmerkungen: 'Please deliver on time.',
    pdf_url: 'https://example.com/order.pdf',
    is_reclamation: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif" }
const container = { padding: '40px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#000000', margin: '0 0 24px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const infoSection = { backgroundColor: '#f5f0e6', borderRadius: '8px', padding: '20px', margin: '0 0 16px', border: '1px solid #e8dfc8' }
const infoRow = { fontSize: '13px', color: '#333', margin: '4px 0', lineHeight: '1.5' }
const btn = { backgroundColor: '#9a7b2d', color: '#fff', padding: '14px 28px', borderRadius: '6px', textDecoration: 'none', fontWeight: '600' as const, fontSize: '14px' }
const hr = { borderColor: '#e8dfc8', margin: '32px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '4px 0 0', lineHeight: '1.5' }
