// src/lib/alerts.test.ts
// Tests for fireAlert. Run via: npm test
//
// NOTE: ./test-utils is imported FIRST on purpose — it redirects DATABASE_URL at an
// isolated test DB (and sets DEMO_MODE=true) before the Prisma singleton pulled in by
// ./alerts is constructed.
import { resetTestDb, cleanupTestDb } from './test-utils'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from './prisma'
import { fireAlert, type FireAlertInput } from './alerts'

let clientId: string

// alerts.entityId is a FK to clients.id, so the alert must point at a real client.
before(async () => {
  await resetTestDb()
  const client = await prisma.client.create({
    data: {
      name: 'Alert Target Ltd',
      type: 'CORPORATE',
      currentState: 'DOCS_EXCEPTION',
      productScope: JSON.stringify(['PAYMENTS']),
      marketScope: JSON.stringify(['KE']),
    },
  })
  clientId = client.id
})

after(() => cleanupTestDb())

function alertInput(): FireAlertInput {
  return {
    type: 'SLA_BREACH',
    entityType: 'CLIENT',
    entityId: clientId,
    severity: 'HIGH',
    channel: 'SLACK',
    message: 'Alert Target Ltd has breached its DOCS_EXCEPTION SLA',
  }
}

test('fireAlert fires and inserts a record on the first call', async () => {
  const result = await fireAlert(alertInput())

  assert.equal(result.fired, true)
  assert.equal(await prisma.alert.count(), 1)
})

test('fireAlert skips an identical alert on the same day and does not insert again', async () => {
  const result = await fireAlert(alertInput())

  assert.equal(result.skipped, true)
  assert.equal(await prisma.alert.count(), 1)
})
