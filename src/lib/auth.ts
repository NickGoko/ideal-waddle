// src/lib/auth.ts
// DEMO_MODE role helpers for API routes.

import { prisma } from './prisma'

export const DEMO_ROLES = ['RM', 'COMPLIANCE', 'LEGAL', 'ADMIN', 'TREASURY'] as const

export type DemoRole = (typeof DEMO_ROLES)[number]

const DEFAULT_ROLE: DemoRole = 'RM'

export function getRoleFromRequest(request: Request): DemoRole {
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(/(?:^|;\s*)demo_role=([^;]+)/)
  const role = match ? decodeURIComponent(match[1]).toUpperCase() : DEFAULT_ROLE

  if (DEMO_ROLES.includes(role as DemoRole)) {
    return role as DemoRole
  }

  return DEFAULT_ROLE
}

export function requireRole(request: Request, allowed: readonly DemoRole[]): boolean {
  return allowed.includes(getRoleFromRequest(request))
}

export async function getDemoActorId(role: DemoRole): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { role, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return user?.id ?? null
}
