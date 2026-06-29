import { prisma } from './prisma'

// All valid states in the onboarding flow
export type OnboardingState =
  | 'LEAD_RECEIVED'
  | 'PACK_SENT'
  | 'DOCS_SUBMITTED'
  | 'DOCS_PROCESSING'
  | 'DOCS_EXCEPTION'
  | 'DOCS_VALIDATED'
  | 'HQ_PROFILE_CREATED'
  | 'SAMSUB_SUBMITTED'
  | 'SAMSUB_COMPLETE'
  | 'COMPLIANCE_REVIEW'
  | 'COMPLIANCE_EXCEPTION'
  | 'COMPLIANCE_APPROVED'
  | 'CONTRACT_DRAFT_REQUESTED'
  | 'CONTRACT_SENT'
  | 'CLIENT_REVIEWING_CONTRACT'
  | 'CONTRACT_COMMENTS_RECEIVED'
  | 'LEGAL_REVIEW'
  | 'CONTRACT_REVISED_SENT'
  | 'CONTRACT_ACCEPTED'
  | 'SIGNATORIES_REQUESTED'
  | 'DOCSIGN_PENDING'
  | 'DOCSIGN_SIGNED'
  | 'CONTRACT_UPLOADED_HQ'
  | 'USERS_REQUESTED'
  | 'USERS_CREATED'
  | 'CLIENT_ACTIVE'
  | 'FIRST_TRADE_PENDING'
  | 'TRADING'

export type TriggeredBy = 'HUMAN' | 'AUTOMATION' | 'AI'

// The only source of truth for valid state transitions.
// Any transition not listed here must be rejected.
export const TRANSITIONS: Record<OnboardingState, OnboardingState[]> = {
  LEAD_RECEIVED:               ['PACK_SENT'],
  PACK_SENT:                   ['DOCS_SUBMITTED'],
  DOCS_SUBMITTED:              ['DOCS_PROCESSING'],
  DOCS_PROCESSING:             ['DOCS_VALIDATED', 'DOCS_EXCEPTION'],
  DOCS_EXCEPTION:              ['DOCS_PROCESSING'], // client resubmits docs
  DOCS_VALIDATED:              ['HQ_PROFILE_CREATED'],
  HQ_PROFILE_CREATED:          ['SAMSUB_SUBMITTED'],
  SAMSUB_SUBMITTED:            ['SAMSUB_COMPLETE'],
  SAMSUB_COMPLETE:             ['COMPLIANCE_REVIEW'],
  COMPLIANCE_REVIEW:           ['COMPLIANCE_APPROVED', 'COMPLIANCE_EXCEPTION'],
  COMPLIANCE_EXCEPTION:        ['SAMSUB_SUBMITTED'], // docs re-uploaded, restart KYC
  COMPLIANCE_APPROVED:         ['CONTRACT_DRAFT_REQUESTED'],
  CONTRACT_DRAFT_REQUESTED:    ['CONTRACT_SENT'],
  CONTRACT_SENT:               ['CLIENT_REVIEWING_CONTRACT'],
  CLIENT_REVIEWING_CONTRACT:   ['CONTRACT_ACCEPTED', 'CONTRACT_COMMENTS_RECEIVED'],
  CONTRACT_COMMENTS_RECEIVED:  ['LEGAL_REVIEW'],
  LEGAL_REVIEW:                ['CONTRACT_REVISED_SENT'],
  CONTRACT_REVISED_SENT:       ['CLIENT_REVIEWING_CONTRACT'], // loop back if more comments
  CONTRACT_ACCEPTED:           ['SIGNATORIES_REQUESTED'],
  SIGNATORIES_REQUESTED:       ['DOCSIGN_PENDING'],
  DOCSIGN_PENDING:             ['DOCSIGN_SIGNED'],
  DOCSIGN_SIGNED:              ['CONTRACT_UPLOADED_HQ'],
  CONTRACT_UPLOADED_HQ:        ['USERS_REQUESTED'],
  USERS_REQUESTED:             ['USERS_CREATED'],
  USERS_CREATED:               ['CLIENT_ACTIVE'],
  CLIENT_ACTIVE:               ['FIRST_TRADE_PENDING'],
  FIRST_TRADE_PENDING:         ['TRADING'],
  TRADING:                     [], // terminal state
}

export const ALL_STATES = Object.keys(TRANSITIONS) as OnboardingState[]

export function validateTransition(fromState: string, toState: string): boolean {
  const allowed = TRANSITIONS[fromState as OnboardingState]
  if (!allowed) return false
  return allowed.includes(toState as OnboardingState)
}

export class InvalidTransitionError extends Error {
  readonly statusCode = 400
  constructor(fromState: string, toState: string) {
    super(`Invalid transition: ${fromState} → ${toState}`)
    this.name = 'InvalidTransitionError'
  }
}

/**
 * The single authoritative function for advancing client state.
 * Never update clients.currentState anywhere else.
 */
export async function transitionClient(
  clientId: string,
  toState: OnboardingState,
  actorId: string | null,
  triggeredBy: TriggeredBy,
  notes?: string
) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } })

  if (!validateTransition(client.currentState, toState)) {
    throw new InvalidTransitionError(client.currentState, toState)
  }

  const now = new Date()

  const [updatedClient] = await prisma.$transaction([
    prisma.client.update({
      where: { id: clientId },
      data: {
        currentState: toState,
        stateEnteredAt: now,
        updatedAt: now,
      },
    }),
    prisma.clientStateLog.create({
      data: {
        clientId,
        fromState: client.currentState,
        toState,
        triggeredBy,
        actorId,
        notes: notes ?? null,
        createdAt: now,
      },
    }),
  ])

  return updatedClient
}
