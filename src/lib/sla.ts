// src/lib/sla.ts
// SLA definitions and breach detection.
//
// SLA_DEFINITIONS is hardcoded here (not a database query) and is the single source of
// truth for how long a client may sit in a given onboarding state before it breaches.
// It mirrors the SLA table in CLAUDE.md.

import type { Client } from '@prisma/client'
import { prisma } from './prisma'
import { SLA_DEFINITIONS, type SlaDefinition } from './slaDefinitions'
export { SLA_DEFINITIONS, type SlaChannel, type SlaDefinition } from './slaDefinitions'

const MS_PER_HOUR = 1000 * 60 * 60

export interface SlaBreach {
  client: Client
  slaDefinition: SlaDefinition
  hoursElapsed: number
}

/**
 * Finds every client currently parked in an SLA-tracked state for longer than that
 * state allows. Only states present in SLA_DEFINITIONS are considered; all other states
 * are ignored.
 */
export async function checkSlaBreaches(): Promise<SlaBreach[]> {
  const trackedStates = Object.keys(SLA_DEFINITIONS)

  const clients = await prisma.client.findMany({
    where: { currentState: { in: trackedStates } },
  })

  const now = Date.now()
  const breaches: SlaBreach[] = []

  for (const client of clients) {
    const slaDefinition = SLA_DEFINITIONS[client.currentState]
    if (!slaDefinition) continue // defensive: state not tracked

    const hoursElapsed = (now - client.stateEnteredAt.getTime()) / MS_PER_HOUR

    if (hoursElapsed > slaDefinition.maxHours) {
      breaches.push({ client, slaDefinition, hoursElapsed })
    }
  }

  return breaches
}
