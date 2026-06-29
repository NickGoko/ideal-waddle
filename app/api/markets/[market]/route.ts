import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { requireRole } from '@/src/lib/auth'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export async function GET(_request: Request, { params }: { params: { market: string } }) {
  try {
    const market = await prisma.marketInfrastructure.findUnique({
      where: { market: params.market.toUpperCase() },
      include: {
        partners: { orderBy: [{ type: 'asc' }, { name: 'asc' }] },
        bankAccounts: {
          include: { partner: true },
          orderBy: [{ currency: 'asc' }],
        },
      },
    })

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    return NextResponse.json({ market })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { market: string } }) {
  try {
    if (!requireRole(request, ['ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data: {
      setupType?: string | null
      isActive?: boolean
      paymentsCapable?: boolean
    } = {}

    if ('setupType' in body) {
      data.setupType = typeof body.setupType === 'string' ? body.setupType : null
    }
    if ('isActive' in body && typeof body.isActive === 'boolean') {
      data.isActive = body.isActive
    }
    if ('paymentsCapable' in body && typeof body.paymentsCapable === 'boolean') {
      data.paymentsCapable = body.paymentsCapable
    }

    const market = await prisma.marketInfrastructure.update({
      where: { market: params.market.toUpperCase() },
      data,
      include: { partners: true, bankAccounts: true },
    })

    return NextResponse.json({ market })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
