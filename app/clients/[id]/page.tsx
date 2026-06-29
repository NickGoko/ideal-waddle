'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FileText,
  ShieldCheck,
  Signature,
  TimerReset,
} from 'lucide-react'
import { SLATimer } from '@/components/SLATimer'
import { StateBadge } from '@/components/StateBadge'
import { getNextStates } from '@/src/lib/states'
import { SLA_DEFINITIONS } from '@/src/lib/slaDefinitions'

type Nullable<T> = T | null

interface UserRecord {
  id: string
  name: string
  email: string
  role: string
}

interface StateLogRecord {
  id: string
  fromState: Nullable<string>
  toState: string
  triggeredBy: string
  actor: Nullable<UserRecord>
  notes: Nullable<string>
  createdAt: string
}

interface DocumentRecord {
  id: string
  docType: string
  status: string
  ocrConfidence: Nullable<number>
  fileName: Nullable<string>
  exceptionReason: Nullable<string>
}

interface ComplianceReviewRecord {
  id: string
  status: string
  samsub_reportUrl: Nullable<string>
  issuesSummary: Nullable<string>
  reviewer: Nullable<UserRecord>
  reviewedAt: Nullable<string>
  createdAt: string
}

interface SignatoryRecord {
  id: string
  name: string
  email: string
  type: string
  hasSigned: boolean
}

interface ContractRecord {
  id: string
  type: string
  version: number
  status: string
  docsignEnvelopeId: Nullable<string>
  signatories: SignatoryRecord[]
}

interface TradeRecord {
  id: string
  bookedAt: string
  currencyPair: string
  direction: string
  volume: number
  rate: number
  marginBps: Nullable<number>
  market: string
  source: string
}

interface ClientRecord {
  id: string
  name: string
  type: string
  currentState: string
  stateEnteredAt: string
  productScope: string
  marketScope: string
  industry: Nullable<string>
  createdAt: string
  rm: Nullable<UserRecord>
  stateLog: StateLogRecord[]
  documents: DocumentRecord[]
  complianceReviews: ComplianceReviewRecord[]
  contracts: ContractRecord[]
  trades: TradeRecord[]
}

const TRANSITION_ROLES = new Set(['RM', 'COMPLIANCE', 'LEGAL', 'ADMIN'])

function parseJsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function readRoleCookie(): string {
  if (typeof document === 'undefined') return 'RM'
  const match = document.cookie.match(/(?:^|;\s*)demo_role=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : 'RM'
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

function formatDate(value: Nullable<string>): string {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value))
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
}

function statusTone(status: string): string {
  if (status.includes('EXCEPTION') || status.includes('REJECTED') || status.includes('EXPIRED')) {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  if (status.includes('APPROVED') || status.includes('EXECUTED') || status.includes('ACCEPTED')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
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

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        {icon}
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id
  const [client, setClient] = useState<ClientRecord | null>(null)
  const [role, setRole] = useState('RM')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [notes, setNotes] = useState('')
  const [advanceError, setAdvanceError] = useState('')
  const [advancing, setAdvancing] = useState(false)

  const loadClient = useCallback(async () => {
    setLoading(true)
    setError('')
    const response = await fetch(`/api/clients/${clientId}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error ?? 'Unable to load client')
      setLoading(false)
      return
    }

    setClient(payload.client)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    setRole(readRoleCookie())
    loadClient().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load client')
      setLoading(false)
    })
  }, [loadClient])

  const nextStates = client ? getNextStates(client.currentState) : []
  const sla = client ? SLA_DEFINITIONS[client.currentState] : undefined
  const productScope = client ? parseJsonList(client.productScope) : []
  const marketScope = client ? parseJsonList(client.marketScope) : []
  const canAdvance = client ? TRANSITION_ROLES.has(role) && nextStates.length > 0 : false
  const latestReview = client?.complianceReviews[0]
  const displayedTrades = useMemo(() => client?.trades ?? [], [client?.trades])

  const tradeSummary = useMemo(() => {
    const totalVolume = displayedTrades.reduce((sum, trade) => sum + trade.volume, 0)
    const margins = displayedTrades
      .map((trade) => trade.marginBps)
      .filter((margin): margin is number => typeof margin === 'number')
    const averageMargin = margins.length ? margins.reduce((sum, margin) => sum + margin, 0) / margins.length : null
    return { totalVolume, averageMargin }
  }, [displayedTrades])

  async function advanceState() {
    if (!client || !selectedState) return
    setAdvancing(true)
    setAdvanceError('')

    const response = await fetch(`/api/clients/${client.id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toState: selectedState,
        notes: notes.trim() || undefined,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setAdvancing(false)

    if (!response.ok) {
      setAdvanceError(payload.error ?? 'Unable to advance client')
      return
    }

    setSelectedState('')
    setNotes('')
    await loadClient()
    router.refresh()
  }

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading client record...</div>
  }

  if (error || !client) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
        {error || 'Client not found'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">{client.name}</h1>
            <StateBadge state={client.currentState} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Operational record for onboarding, compliance, contracts, and trade activity.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-medium uppercase text-slate-500">Current state age</div>
          <div className="mt-2">{sla ? <SLATimer stateEnteredAt={client.stateEnteredAt} maxHours={sla.maxHours} /> : <span className="text-sm text-slate-600">No SLA timer</span>}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="space-y-6">
          <Section title="State Timeline" icon={<TimerReset className="h-4 w-4 text-sky-600" />}>
            <div className="space-y-4">
              {client.stateLog.map((entry, index) => {
                const isCurrent = index === client.stateLog.length - 1
                return (
                  <div key={entry.id} className="relative pl-8">
                    <div className="absolute left-2 top-1.5 h-full w-px bg-slate-200" />
                    <span
                      className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-white ${
                        isCurrent ? 'animate-pulse bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.15)]' : 'bg-slate-300'
                      }`}
                    />
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StateBadge state={entry.toState} />
                        <SmallBadge className="border-slate-200 bg-white text-slate-700">{entry.triggeredBy}</SmallBadge>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        {entry.actor?.name ?? 'System'} <span className="text-slate-400">-</span>{' '}
                        <span title={formatDateTime(entry.createdAt)}>{formatRelativeTime(entry.createdAt)}</span>
                      </div>
                      {entry.notes ? <p className="mt-2 text-sm text-slate-600">{entry.notes}</p> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Documents" icon={<FileText className="h-4 w-4 text-sky-600" />}>
            {client.documents.length ? (
              <div className="space-y-3">
                {client.documents.map((document) => (
                  <div key={document.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{document.docType.replaceAll('_', ' ')}</div>
                        <div className="mt-1 text-xs text-slate-500">{document.fileName ?? 'File pending'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SmallBadge className={statusTone(document.status)}>{document.status}</SmallBadge>
                        {typeof document.ocrConfidence === 'number' ? (
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {Math.round(document.ocrConfidence * 100)}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {document.status === 'EXCEPTION' && document.exceptionReason ? (
                      <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        {document.exceptionReason}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No onboarding documents recorded yet.</div>
            )}
          </Section>

          <Section title="Compliance" icon={<ShieldCheck className="h-4 w-4 text-sky-600" />}>
            {latestReview ? (
              <div className="space-y-3">
                {latestReview.status === 'APPROVED' ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    Compliance Approved
                  </div>
                ) : null}
                {latestReview.status === 'ISSUES_FOUND' ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                    {latestReview.issuesSummary ?? 'Compliance issues require follow-up.'}
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Status</div>
                    <div className="mt-1">
                      <SmallBadge className={statusTone(latestReview.status)}>{latestReview.status}</SmallBadge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Reviewer</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{latestReview.reviewer?.name ?? 'Not assigned'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Reviewed</div>
                    <div className="mt-1 text-sm text-slate-700">{formatDate(latestReview.reviewedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Sumsub report</div>
                    {latestReview.samsub_reportUrl ? (
                      <a
                        href={latestReview.samsub_reportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900"
                      >
                        Open report
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <div className="mt-1 text-sm text-slate-500">No report linked</div>
                    )}
                  </div>
                </div>
                {latestReview.issuesSummary ? <p className="text-sm text-slate-600">{latestReview.issuesSummary}</p> : null}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No compliance review recorded yet.</div>
            )}
          </Section>

          <Section title="Contracts" icon={<Signature className="h-4 w-4 text-sky-600" />}>
            {client.contracts.length ? (
              <div className="space-y-3">
                {client.contracts.map((contract) => (
                  <div key={contract.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {contract.type} agreement v{contract.version}
                      </div>
                      <SmallBadge className={statusTone(contract.status)}>{contract.status}</SmallBadge>
                    </div>
                    {contract.docsignEnvelopeId ? (
                      <div className="mt-2 text-xs text-slate-500">
                        DocuSign envelope <span className="font-mono text-slate-800">{contract.docsignEnvelopeId}</span>
                      </div>
                    ) : null}
                    {contract.signatories.length ? (
                      <div className="mt-3 space-y-2">
                        {contract.signatories.map((signatory) => (
                          <div key={signatory.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                            <div>
                              <div className="font-medium text-slate-900">{signatory.name}</div>
                              <div className="text-xs text-slate-500">{signatory.email}</div>
                            </div>
                            <SmallBadge className={signatory.hasSigned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                              {signatory.hasSigned ? 'SIGNED' : signatory.type}
                            </SmallBadge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-500">No signatories linked yet.</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No contracts recorded yet.</div>
            )}
          </Section>

          <Section title="Trade History" icon={<BriefcaseBusiness className="h-4 w-4 text-sky-600" />}>
            {displayedTrades.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Pair</th>
                      <th className="py-2 pr-3">Dir</th>
                      <th className="py-2 pr-3 text-right">Volume</th>
                      <th className="py-2 pr-3 text-right">Rate</th>
                      <th className="py-2 pr-3 text-right">Margin</th>
                      <th className="py-2 pr-3">Market</th>
                      <th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{formatDate(trade.bookedAt)}</td>
                        <td className="py-2 pr-3 font-mono font-semibold text-slate-900">{trade.currencyPair}</td>
                        <td className="py-2 pr-3">
                          <SmallBadge className={trade.direction === 'BUY' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
                            {trade.direction}
                          </SmallBadge>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-900">{formatNumber(trade.volume)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-900">{trade.rate.toFixed(4)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-900">
                          {typeof trade.marginBps === 'number' ? `${trade.marginBps}bps` : 'N/A'}
                        </td>
                        <td className="py-2 pr-3">
                          <SmallBadge className="border-sky-200 bg-sky-50 text-sky-700">{trade.market}</SmallBadge>
                        </td>
                        <td className="py-2">
                          <SmallBadge className="border-slate-200 bg-slate-50 text-slate-700">{trade.source}</SmallBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold text-slate-900">
                      <td className="py-3 pr-3" colSpan={3}>
                        Total
                      </td>
                      <td className="py-3 pr-3 text-right font-mono">{formatNumber(tradeSummary.totalVolume)}</td>
                      <td className="py-3 pr-3" />
                      <td className="py-3 pr-3 text-right font-mono">
                        {tradeSummary.averageMargin === null ? 'N/A' : `${tradeSummary.averageMargin.toFixed(1)}bps`}
                      </td>
                      <td className="py-3" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No trades logged for this client.</div>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{client.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SmallBadge className="border-sky-200 bg-sky-50 text-sky-700">{client.type}</SmallBadge>
                  <StateBadge state={client.currentState} />
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Industry</div>
                <div className="mt-1 text-sm text-slate-900">{client.industry ?? 'Not recorded'}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Products</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {productScope.map((product) => (
                    <SmallBadge key={product} className="border-slate-200 bg-slate-50 text-slate-700">
                      {product}
                    </SmallBadge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Markets</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {marketScope.map((market) => (
                    <SmallBadge key={market} className="border-sky-200 bg-sky-50 text-sky-700">
                      {market}
                    </SmallBadge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">RM</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{client.rm?.name ?? 'Unassigned'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Created</div>
                  <div className="mt-1 text-sm text-slate-900">{formatDate(client.createdAt)}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-950">Advance State</h2>
            </div>

            {!canAdvance ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {nextStates.length ? `${role} cannot transition this client.` : 'This client has no valid next state.'}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid gap-2">
                  {nextStates.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setSelectedState(state)}
                      className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                        selectedState === state
                          ? 'border-sky-500 bg-sky-50 text-sky-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {state.replaceAll('_', ' ')}
                    </button>
                  ))}
                </div>
                {selectedState ? (
                  <div className="space-y-2">
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add transition notes"
                      className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    {advanceError ? <div className="text-sm font-medium text-red-700">{advanceError}</div> : null}
                    <button
                      type="button"
                      onClick={advanceState}
                      disabled={advancing}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowRight className="h-4 w-4" />
                      {advancing ? 'Advancing...' : 'Confirm'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
