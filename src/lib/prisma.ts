// src/lib/prisma.ts
// Shared PrismaClient singleton.
//
// Next.js dev mode hot-reloads modules on every change. Without this guard a new
// PrismaClient (and a new connection pool) would be created on each reload, eventually
// exhausting database connections. We stash one instance on globalThis and reuse it.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
