// src/lib/prisma.ts
// Shared PrismaClient singleton.
//
// Next.js dev mode hot-reloads modules on every change. Without this guard a new
// PrismaClient (and a new connection pool) would be created on each reload, eventually
// exhausting database connections. We stash one instance on globalThis and reuse it.
//
// Database selection is environment-driven:
//   - DATABASE_AUTH_TOKEN present  -> Turso (libSQL) via the driver adapter (Vercel/prod).
//   - DATABASE_AUTH_TOKEN absent   -> plain PrismaClient against DATABASE_URL (local file SQLite).
// This keeps local dev on prisma/dev.db while production runs on Turso, with one code path.

import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  if (url && authToken) {
    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
