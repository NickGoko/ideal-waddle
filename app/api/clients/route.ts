import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getDemoActorId, getRoleFromRequest, requireRole } from '@/src/lib/auth'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: { rm: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ clients })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!requireRole(request, ['RM', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, type, productScope, marketScope, rmId, industry } = body

    if (
      typeof name !== 'string' ||
      typeof type !== 'string' ||
      typeof rmId !== 'string' ||
      !isStringArray(productScope) ||
      !isStringArray(marketScope)
    ) {
      return NextResponse.json(
        {
          error:
            'Required body: { name, type, productScope: string[], marketScope: string[], rmId, industry? }',
        },
        { status: 400 },
      )
    }

    const role = getRoleFromRequest(request)
    const actorId = await getDemoActorId(role)

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          name,
          type,
          productScope: JSON.stringify(productScope),
          marketScope: JSON.stringify(marketScope),
          rmId,
          industry: typeof industry === 'string' ? industry : null,
          currentState: 'LEAD_RECEIVED',
          stateEnteredAt: new Date(),
        },
        include: { rm: true },
      })

      await tx.clientStateLog.create({
        data: {
          clientId: created.id,
          fromState: null,
          toState: 'LEAD_RECEIVED',
          triggeredBy: 'HUMAN',
          actorId,
          notes: 'Client created',
        },
      })

      return created
    })

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
