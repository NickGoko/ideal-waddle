// scripts/apply-migration-turso.mjs
// One-time: create the database tables on a remote Turso (libSQL) database by
// executing the checked-in Prisma migration SQL.
//
// Why this exists: `prisma db push` / `prisma migrate` cannot target Turso — the
// Prisma schema engine does not speak the libsql:// protocol. So we apply the
// already-generated migration SQL directly through the libSQL client instead.
//
// Usage (run in a TEMPORARY shell so the token does not leak into normal dev):
//   PowerShell:
//     $env:DATABASE_URL="libsql://<your-db>.turso.io"
//     $env:DATABASE_AUTH_TOKEN="<your-token>"
//     node scripts/apply-migration-turso.mjs
//
// This is idempotent enough for a fresh DB; re-running on an existing schema will
// error on "table already exists" — that just means it was already applied.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@libsql/client'

const here = dirname(fileURLToPath(import.meta.url))
const migrationPath = resolve(
  here,
  '../prisma/migrations/20260629094118_init/migration.sql',
)

const url = process.env.DATABASE_URL
const authToken = process.env.DATABASE_AUTH_TOKEN

if (!url || !authToken) {
  console.error(
    'Missing env. Set DATABASE_URL (libsql://...) and DATABASE_AUTH_TOKEN, then re-run.',
  )
  process.exit(1)
}
if (!url.startsWith('libsql://')) {
  console.error(`DATABASE_URL must be a libsql:// Turso URL. Got: ${url}`)
  process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')
const client = createClient({ url, authToken })

console.log(`Applying migration to ${url} ...`)
try {
  await client.executeMultiple(sql)
  console.log('✓ Tables created on Turso.')
} catch (err) {
  console.error('✗ Failed to apply migration:', err.message ?? err)
  process.exit(1)
}
