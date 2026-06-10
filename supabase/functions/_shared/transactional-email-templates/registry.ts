/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as otpCode } from './otp-code.tsx'
import { template as backupReady } from './backup-ready.tsx'
import { template as productionOrderSupplier } from './production-order-supplier.tsx'
import { template as customerShippingNotice } from './customer-shipping-notice.tsx'
import { template as backupFailureAlert } from './backup-failure-alert.tsx'
import { template as bankFinancingRequest } from './bank-financing-request.tsx'
import { template as bugCapaNotification } from './bug-capa-notification.tsx'
import { template as reviewInvitation } from './review-invitation.tsx'
import { template as financeReminder } from './finance-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'otp-code': otpCode,
  'backup-ready': backupReady,
  'production-order-supplier': productionOrderSupplier,
  'customer-shipping-notice': customerShippingNotice,
  'backup-failure-alert': backupFailureAlert,
  'bank-financing-request': bankFinancingRequest,
  'bug-capa-notification': bugCapaNotification,
  'review-invitation': reviewInvitation,
  'finance-reminder': financeReminder,
}
