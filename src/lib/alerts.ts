// src/lib/alerts.ts
// Alert firing with per-day deduplication.
//
// Every alert is keyed by SHA256(type + entityId + today's UTC date). That key is a
// UNIQUE column on the alerts table, so a given alert type fires at most once per entity
// per day no matter how often the SLA monitor runs.

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface FireAlertInput {
  type: string // SLA_BREACH | MARKET_FLAG | DOCUMENT_EXCEPTION | API_FAILURE
  entityType: string // CLIENT | MARKET | PARTNER
  entityId: string
  severity: string // LOW | MEDIUM | HIGH | CRITICAL
  channel: string // SLACK | EMAIL | SMS
  message: string
  recipientId?: string
}

export type FireAlertResult =
  | { skipped: true; fired?: false }
  | { fired: true; alertId: string; skipped?: false }

/** UTC calendar date, e.g. "2026-06-29". */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function deduplicationKeyFor(type: string, entityId: string, date: string): string {
  return createHash('sha256').update(`${type}:${entityId}:${date}`).digest('hex')
}

const isDemoMode = () => process.env.DEMO_MODE === 'true'

/**
 * Fires an alert if one hasn't already been fired for this (type, entity, day).
 *
 * - Returns `{ skipped: true }` if a matching alert already exists — no insert, no send.
 * - Otherwise inserts the alert row, dispatches it (mocked in DEMO_MODE), and returns
 *   `{ fired: true, alertId }`.
 */
export async function fireAlert(input: FireAlertInput): Promise<FireAlertResult> {
  const { type, entityType, entityId, severity, channel, message, recipientId } = input

  const deduplicationKey = deduplicationKeyFor(type, entityId, todayUtc())

  // Fast path: already fired today.
  const existing = await prisma.alert.findUnique({ where: { deduplicationKey } })
  if (existing) {
    return { skipped: true }
  }

  let alert
  try {
    alert = await prisma.alert.create({
      data: {
        type,
        entityType,
        entityId,
        deduplicationKey,
        severity,
        channel,
        message,
        recipientId: recipientId ?? null,
      },
    })
  } catch (err) {
    // Race: another caller inserted the same key between findUnique and create.
    // The UNIQUE constraint is the real guarantee — treat the collision as a skip.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { skipped: true }
    }
    throw err
  }

  await dispatch(channel, message)

  return { fired: true, alertId: alert.id }
}

/** Sends the alert over its channel. Mocked in DEMO_MODE. */
async function dispatch(channel: string, message: string): Promise<void> {
  if (isDemoMode()) {
    const prefix = channel === 'EMAIL' ? '[MOCK EMAIL]' : '[MOCK SLACK]'
    console.log(prefix, message)
    return
  }

  if (channel === 'SLACK') {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('[ALERT] SLACK_WEBHOOK_URL not set — alert not delivered:', message)
      return
    }
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
    return
  }

  // Real EMAIL delivery (Resend) is out of scope for this step — it stays mocked.
  console.warn('[ALERT] Live EMAIL delivery not implemented (Resend mocked):', message)
}
