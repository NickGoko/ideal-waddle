import { PrismaClient } from '@prisma/client'
import {
  TRANSITIONS,
  ALL_STATES,
  validateTransition,
  transitionClient,
  InvalidTransitionError,
  type OnboardingState,
} from '../stateMachine'

// Use an in-memory SQLite DB for tests
const TEST_DB = 'file::memory:?cache=shared'

// Override the prisma singleton used by stateMachine with a test-scoped client
jest.mock('../prisma', () => {
  const { PrismaClient } = require('@prisma/client')
  const client = new PrismaClient({ datasources: { db: { url: 'file::memory:?cache=shared' } } })
  return { prisma: client }
})

// Pull the mocked prisma instance so we can run migrations / seed test data
const { prisma: testPrisma } = jest.requireMock('../prisma') as { prisma: PrismaClient }

// ── helpers ─────────────────────────────────────────────────────────────────

async function applySchema() {
  // SQLite: create tables directly from DDL (mirrors migration.sql key tables)
  await testPrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      market TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await testPrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currentState TEXT NOT NULL DEFAULT 'LEAD_RECEIVED',
      stateEnteredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      productScope TEXT NOT NULL,
      marketScope TEXT NOT NULL,
      rmId TEXT,
      industry TEXT,
      hqClientId TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await testPrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS client_state_log (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL,
      fromState TEXT,
      toState TEXT NOT NULL,
      triggeredBy TEXT NOT NULL,
      actorId TEXT,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `)
}

async function createTestClient(state: OnboardingState = 'LEAD_RECEIVED') {
  return testPrisma.client.create({
    data: {
      name: 'Test Corp',
      type: 'CORPORATE',
      currentState: state,
      stateEnteredAt: new Date(),
      productScope: '["PAYMENTS"]',
      marketScope: '["KE"]',
    },
  })
}

// ── setup / teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  await applySchema()
})

afterEach(async () => {
  await testPrisma.$executeRawUnsafe(`DELETE FROM client_state_log`)
  await testPrisma.$executeRawUnsafe(`DELETE FROM clients`)
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

// ── validateTransition ───────────────────────────────────────────────────────

describe('validateTransition', () => {
  test('returns true for all valid transitions in the map', () => {
    for (const [from, tos] of Object.entries(TRANSITIONS)) {
      for (const to of tos) {
        expect(validateTransition(from, to)).toBe(true)
      }
    }
  })

  test('returns false for a backward transition', () => {
    expect(validateTransition('PACK_SENT', 'LEAD_RECEIVED')).toBe(false)
  })

  test('returns false for a skipped-step transition', () => {
    expect(validateTransition('LEAD_RECEIVED', 'DOCS_SUBMITTED')).toBe(false)
  })

  test('returns false for a completely unknown state', () => {
    expect(validateTransition('BOGUS_STATE', 'LEAD_RECEIVED')).toBe(false)
  })

  test('returns false for the terminal TRADING state', () => {
    expect(validateTransition('TRADING', 'LEAD_RECEIVED')).toBe(false)
    expect(TRANSITIONS['TRADING']).toHaveLength(0)
  })

  test('DOCS_EXCEPTION can loop back to DOCS_PROCESSING', () => {
    expect(validateTransition('DOCS_EXCEPTION', 'DOCS_PROCESSING')).toBe(true)
  })

  test('COMPLIANCE_EXCEPTION can loop back to SAMSUB_SUBMITTED', () => {
    expect(validateTransition('COMPLIANCE_EXCEPTION', 'SAMSUB_SUBMITTED')).toBe(true)
  })

  test('CONTRACT_REVISED_SENT can loop back to CLIENT_REVIEWING_CONTRACT', () => {
    expect(validateTransition('CONTRACT_REVISED_SENT', 'CLIENT_REVIEWING_CONTRACT')).toBe(true)
  })
})

// ── TRANSITIONS completeness ──────────────────────────────────────────────────

describe('TRANSITIONS map', () => {
  test('every state in ALL_STATES has an entry in TRANSITIONS', () => {
    for (const state of ALL_STATES) {
      expect(TRANSITIONS).toHaveProperty(state)
    }
  })

  test('all target states in the map are valid OnboardingStates', () => {
    const stateSet = new Set<string>(ALL_STATES)
    for (const [, targets] of Object.entries(TRANSITIONS)) {
      for (const t of targets) {
        expect(stateSet.has(t)).toBe(true)
      }
    }
  })
})

// ── transitionClient ─────────────────────────────────────────────────────────

describe('transitionClient', () => {
  test('valid transition updates currentState and stateEnteredAt', async () => {
    const client = await createTestClient('LEAD_RECEIVED')
    const originalEnteredAt = client.stateEnteredAt

    // Small delay so timestamps differ
    await new Promise(r => setTimeout(r, 10))

    const updated = await transitionClient(client.id, 'PACK_SENT', null, 'HUMAN')

    expect(updated.currentState).toBe('PACK_SENT')
    expect(updated.stateEnteredAt.getTime()).toBeGreaterThan(originalEnteredAt.getTime())
  })

  test('valid transition always writes a ClientStateLog record', async () => {
    const client = await createTestClient('LEAD_RECEIVED')

    await transitionClient(client.id, 'PACK_SENT', null, 'AUTOMATION', 'auto-advance')

    const logs = await testPrisma.clientStateLog.findMany({ where: { clientId: client.id } })
    expect(logs).toHaveLength(1)
    expect(logs[0].fromState).toBe('LEAD_RECEIVED')
    expect(logs[0].toState).toBe('PACK_SENT')
    expect(logs[0].triggeredBy).toBe('AUTOMATION')
    expect(logs[0].notes).toBe('auto-advance')
  })

  test('log record stores actorId when provided', async () => {
    const client = await createTestClient('LEAD_RECEIVED')
    const actorId = 'user_abc123'

    await transitionClient(client.id, 'PACK_SENT', actorId, 'HUMAN')

    const log = await testPrisma.clientStateLog.findFirst({ where: { clientId: client.id } })
    expect(log?.actorId).toBe(actorId)
  })

  test('invalid transition throws InvalidTransitionError with statusCode 400', async () => {
    const client = await createTestClient('LEAD_RECEIVED')

    await expect(
      transitionClient(client.id, 'TRADING', null, 'HUMAN')
    ).rejects.toThrow(InvalidTransitionError)

    await expect(
      transitionClient(client.id, 'TRADING', null, 'HUMAN')
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('invalid transition does NOT write a log record', async () => {
    const client = await createTestClient('LEAD_RECEIVED')

    try {
      await transitionClient(client.id, 'COMPLIANCE_REVIEW', null, 'HUMAN')
    } catch {
      // expected
    }

    const logs = await testPrisma.clientStateLog.findMany({ where: { clientId: client.id } })
    expect(logs).toHaveLength(0)
  })

  test('invalid transition does NOT mutate the client record', async () => {
    const client = await createTestClient('PACK_SENT')

    try {
      await transitionClient(client.id, 'LEAD_RECEIVED', null, 'HUMAN') // backward — invalid
    } catch {
      // expected
    }

    const unchanged = await testPrisma.client.findUniqueOrThrow({ where: { id: client.id } })
    expect(unchanged.currentState).toBe('PACK_SENT')
  })

  test('multiple sequential transitions each write their own log record', async () => {
    const client = await createTestClient('LEAD_RECEIVED')

    await transitionClient(client.id, 'PACK_SENT', null, 'HUMAN')
    await transitionClient(client.id, 'DOCS_SUBMITTED', null, 'HUMAN')
    await transitionClient(client.id, 'DOCS_PROCESSING', null, 'AUTOMATION')

    const logs = await testPrisma.clientStateLog.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(logs).toHaveLength(3)
    expect(logs[0].fromState).toBe('LEAD_RECEIVED')
    expect(logs[0].toState).toBe('PACK_SENT')
    expect(logs[2].fromState).toBe('DOCS_SUBMITTED')
    expect(logs[2].toState).toBe('DOCS_PROCESSING')
  })

  test('DOCS_EXCEPTION loop: DOCS_EXCEPTION → DOCS_PROCESSING succeeds', async () => {
    const client = await createTestClient('DOCS_EXCEPTION')

    const updated = await transitionClient(client.id, 'DOCS_PROCESSING', null, 'HUMAN', 'client resubmitted')
    expect(updated.currentState).toBe('DOCS_PROCESSING')

    const log = await testPrisma.clientStateLog.findFirst({ where: { clientId: client.id } })
    expect(log?.fromState).toBe('DOCS_EXCEPTION')
    expect(log?.toState).toBe('DOCS_PROCESSING')
  })

  test('throws if client does not exist', async () => {
    await expect(
      transitionClient('nonexistent-id', 'PACK_SENT', null, 'HUMAN')
    ).rejects.toThrow()
  })
})
