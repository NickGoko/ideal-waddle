import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        rm: true,
        stateLog: {
          include: { actor: true },
          orderBy: { createdAt: 'asc' },
        },
        documents: { orderBy: { createdAt: 'asc' } },
        complianceReviews: {
          include: { reviewer: true },
          orderBy: { createdAt: 'desc' },
        },
        contracts: {
          include: { signatories: true },
          orderBy: { createdAt: 'desc' },
        },
        trades: {
          include: { bankAccount: true },
          orderBy: { bookedAt: 'desc' },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ client })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
