'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Globe2,
  RefreshCw,
  Save,
  ShieldCheck,
  Wifi,
} from 'lucide-react'

interface PartnerRecord {
  id: string
  market: string
  name: string
  type: string
  apiIntegrationStatus: string
  noObjectionLetterStatus: string
  noObjectionLetterExpiry: string | null
  channels: string | null
}

interface BankAccountRecord {
  id: string
  market: string
  accountType: string
  currency: string
  accountNumber: string | null
  swiftCode: string | null
  isActive: boolean
  partner: PartnerRecord
}

interface MarketRecord {
  id: string
  market: string
  setupType: string | null
  licenseStatus: string | null
  isActive: boolean
  bankRelationshipCount: number
  paymentsCapable: boolean
  lastReviewedAt: string | null
  updatedAt: string
  partners: PartnerRecord[]
  bankAccounts: BankAccountRecord[]
}

interface MarketDraft {
  setupType: string
  isActive: boolean
  paymentsCapable: boolean
}

type BannerTone = 'success' | 'warning' | 'error'

interface BannerState {
  tone: BannerTone
  message: string
}

const MARKET_NAMES: Record<string, string> = {
  ETH: 'Ethiopia',
  KE: 'Kenya',
  RW: 'Rwanda',
  TZ: 'Tanzania',
  UG: 'Uganda',
  ZM: 'Zambia',
}

const SETUP_TYPES = ['LOCAL_REGISTRATION', 'PARTNERSHIP', 'NON_RESIDENT_ACCOUNT']

function readRoleCookie(): string {
  if (typeof document === 'undefined') return 'RM'
  const match = document.cookie.match(/(?:^|;\s*)demo_role=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : 'RM'
}

function parseJsonList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function formatLabel(value: string | null): string {
  return value ? value.replaceAll('_', ' ') : 'Not set'
}

function formatDate(value: string | null): string {
  if (!value) return 'Not reviewed'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function statusTone(status: string): string {
  if (['ACTIVE', 'OBTAINED'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (['IN_PROGRESS', 'PENDING', 'NOT_REQUIRED'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-red-200 bg-red-50 text-red-700'
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
  const tone = {
    success: {
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    error: {
      icon: AlertTriangle,
      className: 'border-red-200 bg-red-50 text-red-700',
    },
  }[banner.tone]
  const Icon = tone.icon

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm font-medium ${tone.className}`}>
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
}: {
  label: string
  value: string
  helper: string
  icon: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-sky-700">{icon}</div>
      </div>
      <div className="mt-3 text-sm text-slate-500">{helper}</div>
    </section>
  )
}

function FlagRow({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'red'
  children: React.ReactNode
}) {
  const toneClass = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }[tone]

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm font-medium ${toneClass}`}>
      {tone === 'green' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

function MarketCard({
  market,
  draft,
  canEdit,
  saving,
  onDraftChange,
  onSave,
}: {
  market: MarketRecord
  draft: MarketDraft
  canEdit: boolean
  saving: boolean
  onDraftChange: (marketCode: string, patch: Partial<MarketDraft>) => void
  onSave: (marketCode: string) => void
}) {
  const bankPartners = market.partners.filter((partner) => partner.type === 'BANK')
  const activeBankAccounts = market.bankAccounts.filter((account) => account.isActive)
  const apiGaps = market.partners.filter((partner) => partner.apiIntegrationStatus !== 'ACTIVE')
  const lonGaps = market.partners.filter(
    (partner) =>
      partner.noObjectionLetterStatus !== 'OBTAINED' && partner.noObjectionLetterStatus !== 'NOT_REQUIRED',
  )
  const hasBankFlag = market.bankRelationshipCount < 3
  const hasPaymentsFlag = !market.paymentsCapable
  const hasApiFlag = apiGaps.length > 0
  const hasLonFlag = lonGaps.length > 0

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                {MARKET_NAMES[market.market] ?? market.market}
              </h2>
              <SmallBadge className="border-sky-200 bg-sky-50 text-sky-700">{market.market}</SmallBadge>
              <SmallBadge
                className={
                  market.isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }
              >
                {market.isActive ? 'ACTIVE' : 'INACTIVE'}
              </SmallBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {formatLabel(market.setupType)} setup reviewed {formatDate(market.lastReviewedAt)}.
            </p>
          </div>
          <SmallBadge className={statusTone(market.licenseStatus ?? 'NONE')}>
            License {formatLabel(market.licenseStatus)}
          </SmallBadge>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Bank Coverage</div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-950">
                {market.bankRelationshipCount}/3
              </div>
              <div className="mt-1 text-xs text-slate-500">{activeBankAccounts.length} active accounts</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Partners</div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-950">{market.partners.length}</div>
              <div className="mt-1 text-xs text-slate-500">{bankPartners.length} bank partners</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Payments</div>
              <div className="mt-2">
                <SmallBadge
                  className={
                    market.paymentsCapable
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }
                >
                  {market.paymentsCapable ? 'CAPABLE' : 'BLOCKED'}
                </SmallBadge>
              </div>
              <div className="mt-2 text-xs text-slate-500">Operational payment readiness</div>
            </div>
          </div>

          <div className="space-y-2">
            {hasBankFlag ? (
              <FlagRow tone="red">Bank coverage below policy minimum: {market.bankRelationshipCount}/3 relationships.</FlagRow>
            ) : (
              <FlagRow tone="green">Bank coverage meets the 3-bank operating threshold.</FlagRow>
            )}
            {hasPaymentsFlag ? (
              <FlagRow tone="red">Payments capability is not enabled for this market.</FlagRow>
            ) : (
              <FlagRow tone="green">Payments capability is enabled.</FlagRow>
            )}
            {hasApiFlag ? (
              <FlagRow tone="amber">
                API readiness needs follow-up: {apiGaps.map((partner) => `${partner.name} ${formatLabel(partner.apiIntegrationStatus)}`).join(', ')}.
              </FlagRow>
            ) : (
              <FlagRow tone="green">All listed partners have active API integrations.</FlagRow>
            )}
            {hasLonFlag ? (
              <FlagRow tone="amber">
                LON status needs follow-up: {lonGaps.map((partner) => `${partner.name} ${formatLabel(partner.noObjectionLetterStatus)}`).join(', ')}.
              </FlagRow>
            ) : (
              <FlagRow tone="green">LON status is clear for required partners.</FlagRow>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Wifi className="h-4 w-4 text-sky-600" />
              Partner Infrastructure
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Partner</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">API Status</th>
                    <th className="px-3 py-2">LON Status</th>
                    <th className="px-3 py-2">Channels</th>
                  </tr>
                </thead>
                <tbody>
                  {market.partners.map((partner) => {
                    const channels = parseJsonList(partner.channels)
                    return (
                      <tr key={partner.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-3 font-medium text-slate-900">{partner.name}</td>
                        <td className="px-3 py-3">
                          <SmallBadge className="border-slate-200 bg-slate-50 text-slate-700">{partner.type}</SmallBadge>
                        </td>
                        <td className="px-3 py-3">
                          <SmallBadge className={statusTone(partner.apiIntegrationStatus)}>
                            {formatLabel(partner.apiIntegrationStatus)}
                          </SmallBadge>
                        </td>
                        <td className="px-3 py-3">
                          <SmallBadge className={statusTone(partner.noObjectionLetterStatus)}>
                            {formatLabel(partner.noObjectionLetterStatus)}
                          </SmallBadge>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {channels.length ? channels.join(', ') : 'No channel scope'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Banknote className="h-4 w-4 text-sky-600" />
              Bank Accounts
            </div>
            {market.bankAccounts.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {market.bankAccounts.map((account) => (
                  <div key={account.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{account.partner.name}</div>
                      <SmallBadge
                        className={
                          account.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }
                      >
                        {account.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </SmallBadge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div>
                        Currency <span className="font-mono font-semibold text-slate-800">{account.currency}</span>
                      </div>
                      <div>
                        Type <span className="font-semibold text-slate-800">{formatLabel(account.accountType)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                No active bank accounts configured for this market.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-950">Admin Controls</h3>
          </div>

          {!canEdit ? (
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              Switch to Admin to edit setup type, active status, or payments capability.
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Setup Type</span>
                <select
                  value={draft.setupType}
                  onChange={(event) => onDraftChange(market.market, { setupType: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {SETUP_TYPES.map((setupType) => (
                    <option key={setupType} value={setupType}>
                      {formatLabel(setupType)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                Market active
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => onDraftChange(market.market, { isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                Payments capable
                <input
                  type="checkbox"
                  checked={draft.paymentsCapable}
                  onChange={(event) => onDraftChange(market.market, { paymentsCapable: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
              </label>

              <button
                type="button"
                onClick={() => onSave(market.market)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save market'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketRecord[]>([])
  const [drafts, setDrafts] = useState<Record<string, MarketDraft>>({})
  const [role, setRole] = useState('RM')
  const [loading, setLoading] = useState(true)
  const [savingMarket, setSavingMarket] = useState('')
  const [banner, setBanner] = useState<BannerState | null>(null)

  const loadMarkets = useCallback(async () => {
    const response = await fetch('/api/markets', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to load market infrastructure')
    }

    const nextMarkets = (payload.markets ?? []) as MarketRecord[]
    setMarkets(nextMarkets)
    setDrafts(
      Object.fromEntries(
        nextMarkets.map((market) => [
          market.market,
          {
            setupType: market.setupType ?? SETUP_TYPES[0],
            isActive: market.isActive,
            paymentsCapable: market.paymentsCapable,
          },
        ]),
      ),
    )
  }, [])

  useEffect(() => {
    setRole(readRoleCookie())

    function handleRoleChange(event: Event) {
      setRole((event as CustomEvent<string>).detail)
    }

    window.addEventListener('demo-role-change', handleRoleChange)
    return () => window.removeEventListener('demo-role-change', handleRoleChange)
  }, [])

  useEffect(() => {
    loadMarkets()
      .catch((error) => {
        setBanner({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Unable to load market infrastructure',
        })
      })
      .finally(() => setLoading(false))
  }, [loadMarkets])

  const summary = useMemo(() => {
    const flaggedMarkets = markets.filter(
      (market) =>
        market.bankRelationshipCount < 3 ||
        !market.paymentsCapable ||
        market.partners.some((partner) => partner.apiIntegrationStatus !== 'ACTIVE'),
    )
    return {
      total: markets.length,
      active: markets.filter((market) => market.isActive).length,
      paymentsCapable: markets.filter((market) => market.paymentsCapable).length,
      flagged: flaggedMarkets.length,
    }
  }, [markets])

  function updateDraft(marketCode: string, patch: Partial<MarketDraft>) {
    setDrafts((current) => ({
      ...current,
      [marketCode]: {
        ...current[marketCode],
        ...patch,
      },
    }))
  }

  async function saveMarket(marketCode: string) {
    const draft = drafts[marketCode]
    if (!draft) return

    setSavingMarket(marketCode)
    setBanner(null)

    const response = await fetch(`/api/markets/${marketCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const payload = await response.json().catch(() => ({}))
    setSavingMarket('')

    if (!response.ok) {
      setBanner({
        tone: 'error',
        message: payload.error ?? `Unable to update ${marketCode}`,
      })
      return
    }

    setBanner({ tone: 'success', message: `${marketCode} market settings updated.` })
    await loadMarkets()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Market Infrastructure</h1>
          <p className="mt-1 text-sm text-slate-500">
            Operating readiness across bank partners, APIs, LON status, and payment rails.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadMarkets().catch((error) => {
              setBanner({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Unable to refresh markets',
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
          label="Markets"
          value={String(summary.total)}
          helper="Configured operating countries"
          icon={<Globe2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Active"
          value={String(summary.active)}
          helper="Open for onboarding workflows"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Payments Ready"
          value={String(summary.paymentsCapable)}
          helper="Markets enabled for payments"
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
        <MetricCard
          label="Flagged"
          value={String(summary.flagged)}
          helper="Require infrastructure follow-up"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading market infrastructure...
        </div>
      ) : (
        <div className="space-y-5">
          {markets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              draft={drafts[market.market] ?? { setupType: market.setupType ?? SETUP_TYPES[0], isActive: market.isActive, paymentsCapable: market.paymentsCapable }}
              canEdit={role === 'ADMIN'}
              saving={savingMarket === market.market}
              onDraftChange={updateDraft}
              onSave={saveMarket}
            />
          ))}
        </div>
      )}
    </div>
  )
}
