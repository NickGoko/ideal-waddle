import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { requireRole } from '@/src/lib/auth'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

function requiredNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    const trades = await prisma.trade.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true, bankAccount: true },
      orderBy: { bookedAt: 'desc' },
    })

    return NextResponse.json({ trades })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!requireRole(request, ['RM', 'TREASURY', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { clientId, currencyPair, direction, market, bookedAt, bankAccountId, source } = body
    const volume = requiredNumber(body.volume)
    const rate = requiredNumber(body.rate)
    const marginBps = body.marginBps === undefined || body.marginBps === null ? null : requiredNumber(body.marginBps)
    const bookedAtDate = new Date(bookedAt)

    if (
      typeof clientId !== 'string' ||
      typeof currencyPair !== 'string' ||
      typeof direction !== 'string' ||
      typeof market !== 'string' ||
      volume === null ||
      rate === null ||
      marginBps === null && body.marginBps !== undefined && body.marginBps !== null ||
      Number.isNaN(bookedAtDate.getTime())
    ) {
      return NextResponse.json(
        {
          error:
            'Required body: { clientId, currencyPair, direction, volume, rate, marginBps?, market, bookedAt, bankAccountId?, source? }',
        },
        { status: 400 },
      )
    }

    const idempotencyKey = createHash('sha256')
      .update(`${clientId}_${currencyPair}_${direction}_${volume}_${bookedAtDate.toISOString()}`)
      .digest('hex')

    try {
      const trade = await prisma.trade.create({
        data: {
          idempotencyKey,
          clientId,
          currencyPair,
          direction,
          volume,
          valueUsd: Math.round(volume * rate * 100) / 100,
          rate,
          marginBps,
          market,
          bankAccountId: typeof bankAccountId === 'string' && bankAccountId ? bankAccountId : null,
          source: typeof source === 'string' ? source : 'PORTAL',
          bookedAt: bookedAtDate,
          dayOfWeek: bookedAtDate.getDay(),
          dayOfMonth: bookedAtDate.getDate(),
          monthOfYear: bookedAtDate.getMonth() + 1,
        },
        include: { client: true, bankAccount: true },
      })

      return NextResponse.json({ trade }, { status: 201 })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({
          status: 'DUPLICATE_REJECTED',
          message: 'Trade already recorded',
        })
      }
      throw error
    }
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
