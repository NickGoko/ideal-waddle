import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { checkSlaBreaches } from '@/src/lib/sla'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

type RevenueRow = {
  clientType: string
  totalRevenueUsd: number | null
  tradeCount: number | bigint
}

export async function GET() {
  try {
    const [
      volumeByDayOfWeekRows,
      volumeByDayOfMonthRows,
      marginByCurrencyPairRows,
      revenueByClientTypeRows,
      totalClients,
      activeClients,
      pendingSlaBreaches,
      tradesThisMonth,
      totalVolume,
    ] = await Promise.all([
      prisma.trade.groupBy({
        by: ['dayOfWeek'],
        _sum: { volume: true },
        _count: { _all: true },
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.trade.groupBy({
        by: ['dayOfMonth'],
        _sum: { volume: true },
        _count: { _all: true },
        orderBy: { dayOfMonth: 'asc' },
      }),
      prisma.trade.groupBy({
        by: ['currencyPair'],
        _avg: { marginBps: true },
        _count: { _all: true },
        orderBy: { currencyPair: 'asc' },
      }),
      prisma.$queryRaw<RevenueRow[]>`
        SELECT clients.type AS clientType,
               SUM(trades.valueUsd) AS totalRevenueUsd,
               COUNT(*) AS tradeCount
        FROM trades
        JOIN clients ON clients.id = trades.clientId
        GROUP BY clients.type
        ORDER BY totalRevenueUsd DESC
      `,
      prisma.client.count(),
      prisma.client.count({ where: { currentState: 'TRADING' } }),
      checkSlaBreaches(),
      prisma.trade.count({ where: { monthOfYear: new Date().getMonth() + 1 } }),
      prisma.trade.aggregate({ _sum: { valueUsd: true } }),
    ])

    const volumeByDayOfWeek = volumeByDayOfWeekRows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      totalVolume: row._sum.volume ?? 0,
      tradeCount: row._count._all,
    }))

    const volumeByDayOfMonth = volumeByDayOfMonthRows.map((row) => ({
      dayOfMonth: row.dayOfMonth,
      totalVolume: row._sum.volume ?? 0,
      tradeCount: row._count._all,
    }))

    const marginByCurrencyPair = marginByCurrencyPairRows.map((row) => ({
      currencyPair: row.currencyPair,
      avgMarginBps: row._avg.marginBps ?? 0,
      tradeCount: row._count._all,
    }))

    const revenueByClientType = revenueByClientTypeRows.map((row) => ({
      clientType: row.clientType,
      totalRevenueUsd: Number(row.totalRevenueUsd ?? 0),
      tradeCount: Number(row.tradeCount),
    }))

    return NextResponse.json({
      kpis: {
        totalClients,
        activeClients,
        pendingSlaBreaches: pendingSlaBreaches.length,
        tradesThisMonth,
        totalVolumeUsd: totalVolume._sum.valueUsd ?? 0,
      },
      volumeByDayOfWeek,
      volumeByDayOfMonth,
      marginByCurrencyPair,
      revenueByClientType,
    })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
