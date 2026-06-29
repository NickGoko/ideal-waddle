'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, CircleDollarSign, RefreshCw } from 'lucide-react'

interface ClientRecord {
  id: string
  name: string
  type: string
}

interface TradeRecord {
  id: string
  bookedAt: string
  currencyPair: string
  direction: string
  volume: number
  rate: number
  marginBps: number | null
  market: string
  source: string
  client: ClientRecord
}

interface FormState {
  clientId: string
  currencyPair: string
  direction: 'BUY' | 'SELL'
  volume: string
  rate: string
  marginBps: string
  market: string
  bookedAt: string
  source: 'PORTAL'
}

type BannerTone = 'success' | 'warning' | 'error'

interface BannerState {
  tone: BannerTone
  message: string
}

const CURRENCY_PAIRS = [
  'KES/USD',
  'TZS/USD',
  'RWF/USD',
  'UGX/USD',
  'ETB/USD',
  'ZMW/USD',
  'USD/KES',
  'USD/TZS',
  'KES/EUR',
  'KES/GBP',
  'KES/AED',
]

const MARKETS = ['KE', 'TZ', 'RW', 'UG', 'ETH', 'ZM']

function localDateTimeValue(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 19)
}

function createInitialForm(): FormState {
  return {
    clientId: '',
    currencyPair: 'KES/USD',
    direction: 'SELL',
    volume: '',
    rate: '',
    marginBps: '',
    market: 'KE',
    bookedAt: localDateTimeValue(),
    source: 'PORTAL',
  }
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatAmount(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function splitPair(pair: string): [string, string] {
  const [base = '', quote = ''] = pair.split('/')
  return [base, quote]
}

function calculateEstimatedUsd(pair: string, volume: number | null, rate: number | null): number {
  if (volume === null) return 0
  const [base, quote] = splitPair(pair)
  if (base === 'USD') return volume
  if (quote === 'USD' && rate !== null) return volume * rate
  return rate === null ? 0 : volume * rate
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
      {type}
    </span>
  )
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBuy = direction === 'BUY'
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
        isBuy ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {direction}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
      {source}
    </span>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-slate-200 px-5 py-4">{children}</div>
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-950">{children}</h2>
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <div className="mt-1.5 text-xs text-slate-500">{hint}</div> : null}
    </label>
  )
}

function Banner({ banner }: { banner: BannerState }) {
  const tone = {
    success: {
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    warning: {
      icon: AlertCircle,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    error: {
      icon: AlertCircle,
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

function ClientDropdown({
  clients,
  value,
  onChange,
}: {
  clients: ClientRecord[]
  value: string
  onChange: (clientId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedClient = clients.find((client) => client.id === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 outline-none transition hover:bg-slate-50 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedClient ? (
            <>
              <span className="truncate font-medium">{selectedClient.name}</span>
              <TypeBadge type={selectedClient.type} />
            </>
          ) : (
            <span className="text-slate-500">Select client</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => {
                onChange(client.id)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                client.id === value ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="truncate font-medium">{client.name}</span>
              <TypeBadge type={client.type} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function TradesPage() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [form, setForm] = useState<FormState>(() => createInitialForm())
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [loading, setLoading] = useState(true)

  const loadClients = useCallback(async () => {
    const response = await fetch('/api/clients', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to load clients')
    }

    const nextClients = (payload.clients ?? []) as ClientRecord[]
    setClients(nextClients)
    setForm((current) => ({
      ...current,
      clientId: current.clientId || nextClients[0]?.id || '',
    }))
  }, [])

  const loadTrades = useCallback(async () => {
    const response = await fetch('/api/trades', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to load trades')
    }

    setTrades(((payload.trades ?? []) as TradeRecord[]).slice(0, 20))
  }, [])

  useEffect(() => {
    Promise.all([loadClients(), loadTrades()])
      .catch((error) => {
        setBanner({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Unable to load trade workspace',
        })
      })
      .finally(() => setLoading(false))
  }, [loadClients, loadTrades])

  const volume = parseNumber(form.volume)
  const rate = parseNumber(form.rate)
  const marginBps = form.marginBps ? parseNumber(form.marginBps) : 0
  const [baseCurrency] = splitPair(form.currencyPair)
  const estimatedUsd = calculateEstimatedUsd(form.currencyPair, volume, rate)
  const marginPercent = marginBps === null ? 0 : marginBps / 100

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBanner(null)

    const submittedVolume = parseNumber(form.volume)
    const submittedRate = parseNumber(form.rate)
    const submittedMargin = form.marginBps ? parseNumber(form.marginBps) : null

    if (!form.clientId || submittedVolume === null || submittedRate === null || submittedMargin === null) {
      setBanner({ tone: 'error', message: 'Complete the required trade fields before logging.' })
      return
    }

    const response = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: form.clientId,
        currencyPair: form.currencyPair,
        direction: form.direction,
        volume: submittedVolume,
        rate: submittedRate,
        marginBps: submittedMargin,
        market: form.market,
        bookedAt: new Date(form.bookedAt).toISOString(),
        source: form.source,
      }),
    })
    const payload = await response.json().catch(() => ({}))

    if (payload.status === 'DUPLICATE_REJECTED') {
      setBanner({
        tone: 'warning',
        message: 'This trade has already been recorded. No duplicate created.',
      })
      await loadTrades()
      return
    }

    if (!response.ok) {
      setBanner({
        tone: 'error',
        message: payload.error ?? 'Unable to log trade',
      })
      return
    }

    setBanner({ tone: 'success', message: 'Trade logged successfully' })
    await loadTrades()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Trades</h1>
          <p className="mt-1 text-sm text-slate-500">Manual trade capture for payments and treasury operations.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadTrades().catch((error) => {
              setBanner({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Unable to refresh trades',
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

      <Card>
        <CardHeader>
          <CardTitle>Log New Trade</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="source" value={form.source} />

            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Client">
                <ClientDropdown
                  clients={clients}
                  value={form.clientId}
                  onChange={(clientId) => updateForm('clientId', clientId)}
                />
              </Field>

              <Field label="Currency Pair">
                <select
                  required
                  value={form.currencyPair}
                  onChange={(event) => updateForm('currencyPair', event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {CURRENCY_PAIRS.map((pair) => (
                    <option key={pair} value={pair}>
                      {pair}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Direction">
                <div className="grid grid-cols-2 gap-2">
                  {(['BUY', 'SELL'] as const).map((direction) => (
                    <label
                      key={direction}
                      className={`flex h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold transition ${
                        form.direction === direction
                          ? direction === 'BUY'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-red-300 bg-red-50 text-red-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        required
                        type="radio"
                        name="direction"
                        value={direction}
                        checked={form.direction === direction}
                        onChange={() => updateForm('direction', direction)}
                        className="sr-only"
                      />
                      {direction}
                    </label>
                  ))}
                </div>
              </Field>

              <Field
                label="Volume"
                hint={
                  volume === null ? (
                    'Enter trade notional'
                  ) : (
                    <span className="font-mono text-slate-700">{`${formatAmount(volume)} ${baseCurrency}`}</span>
                  )
                }
              >
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.volume}
                  onChange={(event) => updateForm('volume', event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 font-mono text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </Field>

              <Field label="Exchange Rate">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.00000001"
                  value={form.rate}
                  onChange={(event) => updateForm('rate', event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 font-mono text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </Field>

              <Field
                label="Margin (bps)"
                hint={<span className="font-mono text-slate-700">{`= ${formatAmount(marginPercent, 2)}%`}</span>}
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.marginBps}
                  onChange={(event) => updateForm('marginBps', event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 font-mono text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </Field>

              <Field label="Market">
                <select
                  required
                  value={form.market}
                  onChange={(event) => updateForm('market', event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {MARKETS.map((market) => (
                    <option key={market} value={market}>
                      {market}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date and Time">
                <input
                  required
                  type="datetime-local"
                  step="1"
                  value={form.bookedAt}
                  onChange={(event) => updateForm('bookedAt', event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 font-mono text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </Field>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <CircleDollarSign className="h-4 w-4 text-sky-600" />
                  Trade Preview
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Estimated Value</span>
                    <span className="font-mono font-semibold text-slate-950">USD {formatAmount(estimatedUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Margin</span>
                    <span className="font-mono font-semibold text-slate-950">
                      {formatAmount(marginPercent, 2)}% ({marginBps ?? 0} bps)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Log Trade
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recent Trades</CardTitle>
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
              {loading ? '...' : trades.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 text-sm text-slate-500">Loading recent trades...</div>
          ) : trades.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Pair</th>
                    <th className="px-4 py-3">Dir</th>
                    <th className="px-4 py-3 text-right">Volume</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                    <th className="px-4 py-3">Market</th>
                    <th className="px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(trade.bookedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{trade.client.name}</span>
                          <TypeBadge type={trade.client.type} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{trade.currencyPair}</td>
                      <td className="px-4 py-3">
                        <DirectionBadge direction={trade.direction} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">{formatAmount(trade.volume)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">{trade.rate.toFixed(6)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">
                        {typeof trade.marginBps === 'number' ? `${trade.marginBps}bps` : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex min-h-6 items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {trade.market}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={trade.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-500">No trades logged yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
