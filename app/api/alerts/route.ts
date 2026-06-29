import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { requireRole } from '@/src/lib/auth'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export async function GET(request: Request) {
  try {
    if (!requireRole(request, ['ADMIN', 'COMPLIANCE', 'RM'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const alerts = await prisma.alert.findMany({
      include: { client: true, recipient: true },
      orderBy: { firedAt: 'desc' },
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requireRole(request, ['ADMIN', 'COMPLIANCE', 'RM'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { alertId } = body

    if (typeof alertId !== 'string') {
      return NextResponse.json({ error: 'Required body: { alertId }' }, { status: 400 })
    }

    const existing = await prisma.alert.findUnique({ where: { id: alertId } })
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { acknowledgedAt: existing.acknowledgedAt ?? new Date() },
      include: { client: true, recipient: true },
    })

    return NextResponse.json({ alert })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
