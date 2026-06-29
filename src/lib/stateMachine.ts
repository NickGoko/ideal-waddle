// src/lib/stateMachine.ts
// Onboarding finite state machine.
//
// This module is the only runtime writer of clients.currentState. Route handlers and
// future automation should call transitionClient() instead of updating client state
// directly so every move is validated and logged.

import type { Client } from '@prisma/client'
import { prisma } from './prisma'
export { TRANSITIONS } from './states'
import { TRANSITIONS } from './states'

export type TransitionTrigger = 'HUMAN' | 'AUTOMATION' | 'AI'

export interface TransitionClientInput {
  clientId: string
  toState: string
  actorId?: string | null
  triggeredBy: TransitionTrigger
  notes?: string | null
}

export type TransitionClientResult =
  | { success: true; client: Client }
  | { success: false; error: string }

export function validateTransition(fromState: string, toState: string): boolean {
  const allowed = TRANSITIONS[fromState]
  if (!allowed) return false
  return allowed.includes(toState)
}

export async function transitionClient(
  params: TransitionClientInput,
): Promise<TransitionClientResult> {
  const client = await prisma.client.findUnique({ where: { id: params.clientId } })

  if (!client) {
    return { success: false, error: 'Client not found' }
  }

  if (!validateTransition(client.currentState, params.toState)) {
    return {
      success: false,
      error: `Invalid transition: ${client.currentState} -> ${params.toState}`,
    }
  }

  const [updatedClient] = await prisma.$transaction([
    prisma.client.update({
      where: { id: params.clientId },
      data: {
        currentState: params.toState,
        stateEnteredAt: new Date(),
      },
    }),
    prisma.clientStateLog.create({
      data: {
        clientId: params.clientId,
        fromState: client.currentState,
        toState: params.toState,
        triggeredBy: params.triggeredBy,
        actorId: params.actorId ?? null,
        notes: params.notes ?? null,
      },
    }),
  ])

  return { success: true, client: updatedClient }
}
