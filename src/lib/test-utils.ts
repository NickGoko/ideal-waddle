// src/lib/test-utils.ts
// Test harness for the lib modules.
//
// IMPORTANT: this module MUST be imported FIRST in every test file. Its top-level code
// redirects DATABASE_URL at an isolated test database and forces DEMO_MODE on BEFORE the
// Prisma singleton (imported transitively by sla.ts / alerts.ts) is constructed. That
// keeps the seeded dev.db completely untouched by tests.

import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const TEST_DB_PATH = path.join(process.cwd(), 'prisma', 'test.db')
const MIGRATION_SQL_PATH = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '20260629094118_init',
  'migration.sql',
)

// Set before any other module reads them.
process.env.DATABASE_URL = 'file:./test.db'
process.env.DEMO_MODE = 'true'

function removeTestDbFiles(): void {
  for (const suffix of ['', '-journal', '-shm', '-wal']) {
    const file = `${TEST_DB_PATH}${suffix}`
    if (existsSync(file)) rmSync(file)
  }
}

function migrationStatements(): string[] {
  const sql = readFileSync(MIGRATION_SQL_PATH, 'utf8')
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

/** Drops and recreates the test database schema from prisma/schema.prisma. */
export async function resetTestDb(): Promise<void> {
  removeTestDbFiles()

  const { prisma } = await import('./prisma')
  await prisma.$connect()
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF')

  for (const statement of migrationStatements()) {
    await prisma.$executeRawUnsafe(statement)
  }

  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')
}

/** Disconnects and deletes the test database so nothing is left behind. */
export async function cleanupTestDb(): Promise<void> {
  const { prisma } = await import('./prisma')
  await prisma.$disconnect()
  removeTestDbFiles()
}
