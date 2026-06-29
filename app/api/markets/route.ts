import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export async function GET() {
  try {
    const markets = await prisma.marketInfrastructure.findMany({
      include: {
        partners: { orderBy: [{ type: 'asc' }, { name: 'asc' }] },
        bankAccounts: {
          include: { partner: true },
          orderBy: [{ market: 'asc' }, { currency: 'asc' }],
        },
      },
      orderBy: { market: 'asc' },
    })

    return NextResponse.json({ markets })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
