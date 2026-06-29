// src/lib/stateMachine.test.ts
// Tests for transitionClient. Run via: npm test
//
// NOTE: ./test-utils is imported FIRST so the Prisma singleton points at the
// isolated test DB before stateMachine.ts imports it.
import { resetTestDb, cleanupTestDb } from './test-utils'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from './prisma'
import { transitionClient, validateTransition } from './stateMachine'

let clientId: string

before(async () => {
  await resetTestDb()
  const client = await prisma.client.create({
    data: {
      name: 'State Machine Ltd',
      type: 'CORPORATE',
      currentState: 'LEAD_RECEIVED',
      productScope: JSON.stringify(['PAYMENTS']),
      marketScope: JSON.stringify(['KE']),
    },
  })
  clientId = client.id
})

after(() => cleanupTestDb())

test('validateTransition accepts known valid transitions and rejects invalid ones', () => {
  assert.equal(validateTransition('LEAD_RECEIVED', 'PACK_SENT'), true)
  assert.equal(validateTransition('LEAD_RECEIVED', 'TRADING'), false)
  assert.equal(validateTransition('UNKNOWN', 'PACK_SENT'), false)
})

test('transitionClient updates client state and writes a log for a valid transition', async () => {
  const result = await transitionClient({
    clientId,
    toState: 'PACK_SENT',
    triggeredBy: 'HUMAN',
  })

  assert.equal(result.success, true)
  if (!result.success) assert.fail('expected valid transition to succeed')

  assert.equal(result.client.currentState, 'PACK_SENT')

  const log = await prisma.clientStateLog.findFirstOrThrow({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  })

  assert.equal(log.fromState, 'LEAD_RECEIVED')
  assert.equal(log.toState, 'PACK_SENT')
})

test('transitionClient rejects invalid transitions without changing state or writing a log', async () => {
  const beforeLogCount = await prisma.clientStateLog.count({ where: { clientId } })

  const result = await transitionClient({
    clientId,
    toState: 'TRADING',
    triggeredBy: 'HUMAN',
  })

  assert.equal(result.success, false)
  if (result.success) assert.fail('expected invalid transition to fail')
  assert.match(result.error, /Invalid transition/)

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } })
  const afterLogCount = await prisma.clientStateLog.count({ where: { clientId } })

  assert.equal(client.currentState, 'PACK_SENT')
  assert.equal(afterLogCount, beforeLogCount)
})

test('transitionClient always writes a log record on success', async () => {
  const result = await transitionClient({
    clientId,
    toState: 'DOCS_SUBMITTED',
    triggeredBy: 'HUMAN',
    notes: 'Documents received',
  })

  assert.equal(result.success, true)

  const logs = await prisma.clientStateLog.findMany({
    where: { clientId },
    orderBy: { createdAt: 'asc' },
  })

  assert.equal(logs.length, 2)
  assert.equal(logs[1].fromState, 'PACK_SENT')
  assert.equal(logs[1].toState, 'DOCS_SUBMITTED')
  assert.equal(logs[1].notes, 'Documents received')
})
