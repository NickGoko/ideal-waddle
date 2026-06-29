// src/lib/slaDefinitions.ts
// Pure SLA metadata shared by the SLA engine and client UI timers.

export type SlaChannel = 'SLACK' | 'EMAIL'

export interface SlaDefinition {
  maxHours: number
  escalationRole: string
  channel: SlaChannel
}

export const SLA_DEFINITIONS: Record<string, SlaDefinition> = {
  DOCS_SUBMITTED: { maxHours: 4, escalationRole: 'RM', channel: 'SLACK' },
  DOCS_PROCESSING: { maxHours: 2, escalationRole: 'SYSTEM', channel: 'SLACK' },
  DOCS_EXCEPTION: { maxHours: 24, escalationRole: 'RM', channel: 'EMAIL' },
  SAMSUB_SUBMITTED: { maxHours: 4, escalationRole: 'SYSTEM', channel: 'SLACK' },
  COMPLIANCE_REVIEW: { maxHours: 48, escalationRole: 'COMPLIANCE', channel: 'SLACK' },
  COMPLIANCE_EXCEPTION: { maxHours: 24, escalationRole: 'RM', channel: 'EMAIL' },
  CONTRACT_SENT: { maxHours: 72, escalationRole: 'RM', channel: 'SLACK' },
  LEGAL_REVIEW: { maxHours: 48, escalationRole: 'LEGAL', channel: 'SLACK' },
  DOCSIGN_PENDING: { maxHours: 24, escalationRole: 'RM', channel: 'EMAIL' },
  USERS_REQUESTED: { maxHours: 24, escalationRole: 'SYSTEM', channel: 'SLACK' },
}
