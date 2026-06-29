// src/lib/sla.test.ts
// Tests for checkSlaBreaches. Run via: npm test
//
// NOTE: ./test-utils is imported FIRST on purpose — it redirects DATABASE_URL at an
// isolated test DB before the Prisma singleton (pulled in by ./sla) is constructed.
import { resetTestDb, cleanupTestDb } from './test-utils'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from './prisma'
import { checkSlaBreaches } from './sla'

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000)

const baseClient = {
  type: 'CORPORATE',
  currentState: 'COMPLIANCE_REVIEW', // 48h SLA limit
  productScope: JSON.stringify(['PAYMENTS']),
  marketScope: JSON.stringify(['KE']),
}

before(() => resetTestDb())
after(() => cleanupTestDb())

test('checkSlaBreaches flags a client past its SLA limit', async () => {
  const breaching = await prisma.client.create({
    data: { ...baseClient, name: 'Stale Co', stateEnteredAt: hoursAgo(50) },
  })

  const breaches = await checkSlaBreaches()
  const found = breaches.find((b) => b.client.id === breaching.id)

  assert.ok(found, 'expected the stale client to be flagged as a breach')
  assert.equal(found.slaDefinition.maxHours, 48)
  assert.ok(found.hoursElapsed > 48, `hoursElapsed (${found.hoursElapsed}) should exceed 48`)
})

test('checkSlaBreaches does not flag a client within its SLA limit', async () => {
  const fresh = await prisma.client.create({
    data: { ...baseClient, name: 'Fresh Co', stateEnteredAt: hoursAgo(1) },
  })

  const breaches = await checkSlaBreaches()
  const found = breaches.find((b) => b.client.id === fresh.id)

  assert.equal(found, undefined, 'a client within its SLA window should not be flagged')
})
