'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface AnalyticsPayload {
  kpis: {
    totalClients: number
    activeClients: number
    pendingSlaBreaches: number
    tradesThisMonth: number
    totalVolumeUsd: number
  }
  volumeByDayOfWeek: Array<{
    dayOfWeek: number
    totalVolume: number
    tradeCount: number
  }>
  volumeByDayOfMonth: Array<{
    dayOfMonth: number
    totalVolume: number
    tradeCount: number
  }>
  marginByCurrencyPair: Array<{
    currencyPair: string
    avgMarginBps: number
    tradeCount: number
  }>
  revenueByClientType: Array<{
    clientType: string
    totalRevenueUsd: number
    tradeCount: number
  }>
}

interface ChartDatum {
  label: string
  value: number
  tradeCount?: number
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1000000 ? 1 : 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en').format(value)
}

function LoadingPanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
      Loading analytics...
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
      {message}
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string
  value: string
  helper: string
  icon: React.ReactNode
  tone: 'green' | 'amber' | 'red' | 'blue' | 'slate'
}) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <div className={`rounded-md border p-2 ${tones[tone]}`}>{icon}</div>
      </div>
      <div className="mt-3 text-sm text-slate-500">{helper}</div>
    </section>
  )
}

function ChartShell({
  title,
  subtitle,
  children,
  dataLength,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  dataLength: number
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <BarChart3 className="h-5 w-5 text-slate-400" />
      </div>
      <div className="h-80 p-4">
        {dataLength ? (
          children
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm font-medium text-slate-500">
            No data yet
          </div>
        )}
      </div>
    </section>
  )
}

function SimpleTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload?: ChartDatum }>
  label?: string
  formatter: (value: number) => string
}) {
  if (!active || !payload?.length) return null

  const value = Number(payload[0].value)
  const tradeCount = payload[0].payload?.tradeCount

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="font-semibold text-slate-950">{label}</div>
      <div className="mt-1 font-mono text-slate-700">{formatter(value)}</div>
      {typeof tradeCount === 'number' ? <div className="mt-1 text-xs text-slate-500">{tradeCount} trades</div> : null}
    </div>
  )
}

export default function Home() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true)
      setError('')

      const response = await fetch('/api/analytics', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load analytics')
      }

      setAnalytics(payload)
      setLoading(false)
    }

    loadAnalytics().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics')
      setLoading(false)
    })
  }, [])

  const chartData = useMemo(() => {
    if (!analytics) {
      return {
        week: [] as ChartDatum[],
        month: [] as ChartDatum[],
        margin: [] as ChartDatum[],
        revenue: [] as ChartDatum[],
      }
    }

    return {
      week: analytics.volumeByDayOfWeek.map((row) => ({
        label: DAY_LABELS[row.dayOfWeek] ?? `Day ${row.dayOfWeek}`,
        value: row.totalVolume,
        tradeCount: row.tradeCount,
      })),
      month: analytics.volumeByDayOfMonth.map((row) => ({
        label: String(row.dayOfMonth),
        value: row.totalVolume,
        tradeCount: row.tradeCount,
      })),
      margin: analytics.marginByCurrencyPair.map((row) => ({
        label: row.currencyPair,
        value: row.avgMarginBps,
        tradeCount: row.tradeCount,
      })),
      revenue: analytics.revenueByClientType.map((row) => ({
        label: row.clientType,
        value: row.totalRevenueUsd,
        tradeCount: row.tradeCount,
      })),
    }
  }, [analytics])

  if (loading) return <LoadingPanel />
  if (error || !analytics) return <ErrorPanel message={error || 'Analytics data is unavailable'} />

  const slaTone = analytics.kpis.pendingSlaBreaches > 0 ? 'red' : 'green'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Live operating metrics from onboarding and trade records.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Source: <span className="font-semibold text-slate-900">live database</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total Clients"
          value={formatNumber(analytics.kpis.totalClients)}
          helper="All onboarding records"
          tone="blue"
          icon={<UsersRound className="h-5 w-5" />}
        />
        <KpiCard
          label="Active Clients"
          value={formatNumber(analytics.kpis.activeClients)}
          helper="Currently trading"
          tone="green"
          icon={<BriefcaseBusiness className="h-5 w-5" />}
        />
        <KpiCard
          label="SLA Breaches"
          value={formatNumber(analytics.kpis.pendingSlaBreaches)}
          helper="Open workflow breaches"
          tone={slaTone}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label="Trades This Month"
          value={formatNumber(analytics.kpis.tradesThisMonth)}
          helper="Booked in current month"
          tone="amber"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Total Value"
          value={formatMoney(analytics.kpis.totalVolumeUsd)}
          helper="Booked trade value"
          tone="slate"
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartShell
          title="Volume by Day of Week"
          subtitle="Trade notional grouped by booking weekday"
          dataLength={chartData.week.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.week} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
              <Tooltip content={<SimpleTooltip formatter={(value) => formatNumber(value)} />} />
              <Bar dataKey="value" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Volume by Day of Month"
          subtitle="Daily trade notional for booked trades"
          dataLength={chartData.month.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData.month} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
              <Tooltip content={<SimpleTooltip formatter={(value) => formatNumber(value)} />} />
              <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Margin by Currency Pair"
          subtitle="Average booked margin in basis points"
          dataLength={chartData.margin.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.margin} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}bps`} />
              <Tooltip content={<SimpleTooltip formatter={(value) => `${value.toFixed(1)}bps`} />} />
              <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Revenue by Client Type"
          subtitle="Booked trade value grouped by client segment"
          dataLength={chartData.revenue.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.revenue} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
              <Tooltip content={<SimpleTooltip formatter={formatMoney} />} />
              <Bar dataKey="value" fill="#64748B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  )
}
