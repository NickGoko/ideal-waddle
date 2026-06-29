'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

interface ClientRecord {
  id: string
  name: string
  type: string
  currentState: string
}

interface UserRecord {
  id: string
  name: string
  role: string
}

interface AlertRecord {
  id: string
  type: string
  entityType: string
  entityId: string
  deduplicationKey: string
  severity: string
  recipientId: string | null
  channel: string
  message: string
  firedAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  client: ClientRecord | null
  recipient: UserRecord | null
}

type BannerTone = 'success' | 'error'

interface BannerState {
  tone: BannerTone
  message: string
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(Math.round(diffMs / 60000), 0)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hours ago`
  const days = Math.round(hours / 24)
  return `${days} days ago`
}

function formatLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

function severityTone(severity: string): string {
  if (severity === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (severity === 'MEDIUM') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function channelTone(channel: string): string {
  if (channel === 'EMAIL') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (channel === 'SLACK') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function SmallBadge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-normal ${className}`}
    >
      {children}
    </span>
  )
}

function Banner({ banner }: { banner: BannerState }) {
  const isSuccess = banner.tone === 'success'
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
        isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{banner.message}</span>
    </div>
  )
}

function MetricCard({
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
  tone: 'red' | 'amber' | 'green' | 'blue'
}) {
  const toneClass = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
  }[tone]

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <div className={`rounded-md border p-2 ${toneClass}`}>{icon}</div>
      </div>
      <div className="mt-3 text-sm text-slate-500">{helper}</div>
    </section>
  )
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'EMAIL') return <Mail className="h-3.5 w-3.5" />
  if (channel === 'SLACK') return <MessageSquare className="h-3.5 w-3.5" />
  return <BellRing className="h-3.5 w-3.5" />
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledgingId, setAcknowledgingId] = useState('')
  const [banner, setBanner] = useState<BannerState | null>(null)

  const loadAlerts = useCallback(async () => {
    const response = await fetch('/api/alerts', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to load alerts')
    }

    setAlerts((payload.alerts ?? []) as AlertRecord[])
  }, [])

  useEffect(() => {
    loadAlerts()
      .catch((error) => {
        setBanner({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Unable to load alerts',
        })
      })
      .finally(() => setLoading(false))
  }, [loadAlerts])

  const summary = useMemo(() => {
    const unacknowledged = alerts.filter((alert) => !alert.acknowledgedAt)
    return {
      total: alerts.length,
      unacknowledged: unacknowledged.length,
      critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
      acknowledged: alerts.filter((alert) => alert.acknowledgedAt).length,
    }
  }, [alerts])

  async function acknowledgeAlert(alertId: string) {
    setAcknowledgingId(alertId)
    setBanner(null)

    const response = await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    })
    const payload = await response.json().catch(() => ({}))
    setAcknowledgingId('')

    if (!response.ok) {
      setBanner({
        tone: 'error',
        message: payload.error ?? 'Unable to acknowledge alert',
      })
      return
    }

    setAlerts((current) => current.map((alert) => (alert.id === alertId ? payload.alert : alert)))
    setBanner({ tone: 'success', message: 'Alert acknowledged.' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Alert Log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fired operational alerts with delivery channel, severity, and acknowledgement status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadAlerts().catch((error) => {
              setBanner({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Unable to refresh alerts',
              })
            })
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {banner ? <Banner banner={banner} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Alerts"
          value={String(summary.total)}
          helper="All fired alert records"
          tone="blue"
          icon={<BellRing className="h-5 w-5" />}
        />
        <MetricCard
          label="Open"
          value={String(summary.unacknowledged)}
          helper="Awaiting acknowledgement"
          tone={summary.unacknowledged ? 'amber' : 'green'}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Critical"
          value={String(summary.critical)}
          helper="Highest severity alerts"
          tone={summary.critical ? 'red' : 'green'}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <MetricCard
          label="Acknowledged"
          value={String(summary.acknowledged)}
          helper="Marked as seen"
          tone="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Fired Alerts</h2>
          <p className="mt-1 text-sm text-slate-500">Acknowledgement updates the alert; rows are never deleted.</p>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-500">Loading alerts...</div>
        ) : alerts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Fired</th>
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const acknowledged = Boolean(alert.acknowledgedAt)
                  return (
                    <tr key={alert.id} className="border-b border-slate-100 align-top last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{formatDateTime(alert.firedAt)}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatRelativeTime(alert.firedAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <SmallBadge className="border-slate-200 bg-slate-50 text-slate-700">{formatLabel(alert.type)}</SmallBadge>
                          <span className="font-mono text-xs text-slate-400">{alert.deduplicationKey.slice(0, 8)}</span>
                        </div>
                        <p className="mt-2 max-w-xl text-slate-700">{alert.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        {alert.client ? (
                          <Link href={`/clients/${alert.client.id}`} className="font-medium text-sky-700 hover:text-sky-900">
                            {alert.client.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900">{alert.entityId}</span>
                        )}
                        <div className="mt-1 flex flex-wrap gap-2">
                          <SmallBadge className="border-slate-200 bg-slate-50 text-slate-700">{alert.entityType}</SmallBadge>
                          {alert.client ? (
                            <SmallBadge className="border-amber-200 bg-amber-50 text-amber-700">
                              {formatLabel(alert.client.currentState)}
                            </SmallBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SmallBadge className={severityTone(alert.severity)}>{alert.severity}</SmallBadge>
                      </td>
                      <td className="px-4 py-3">
                        <SmallBadge className={channelTone(alert.channel)}>
                          <span className="inline-flex items-center gap-1">
                            <ChannelIcon channel={alert.channel} />
                            {alert.channel}
                          </span>
                        </SmallBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {alert.recipient ? (
                          <div>
                            <div className="font-medium text-slate-900">{alert.recipient.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{alert.recipient.role}</div>
                          </div>
                        ) : (
                          'Ops queue'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {acknowledged ? (
                          <div>
                            <SmallBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">ACKNOWLEDGED</SmallBadge>
                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(alert.acknowledgedAt)}</div>
                          </div>
                        ) : (
                          <SmallBadge className="border-amber-200 bg-amber-50 text-amber-700">OPEN</SmallBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => acknowledgeAlert(alert.id)}
                          disabled={acknowledged || acknowledgingId === alert.id}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {acknowledged ? 'Acknowledged' : acknowledgingId === alert.id ? 'Saving...' : 'Acknowledge'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-500">No alerts fired yet.</div>
        )}
      </section>
    </div>
  )
}
