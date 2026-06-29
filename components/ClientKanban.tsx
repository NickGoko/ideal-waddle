'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye } from 'lucide-react'
import { getNextStates } from '@/src/lib/states'
import { SLA_DEFINITIONS } from '@/src/lib/slaDefinitions'
import { StateBadge } from './StateBadge'
import { SLATimer } from './SLATimer'

interface ClientRecord {
  id: string
  name: string
  type: string
  currentState: string
  stateEnteredAt: string
  marketScope: string
  productScope: string
}

interface ColumnDefinition {
  title: string
  states: string[]
}

const COLUMNS: ColumnDefinition[] = [
  { title: 'Intake', states: ['LEAD_RECEIVED', 'PACK_SENT'] },
  { title: 'Documents', states: ['DOCS_SUBMITTED', 'DOCS_PROCESSING', 'DOCS_EXCEPTION', 'DOCS_VALIDATED'] },
  {
    title: 'Compliance',
    states: [
      'HQ_PROFILE_CREATED',
      'SAMSUB_SUBMITTED',
      'SAMSUB_COMPLETE',
      'COMPLIANCE_REVIEW',
      'COMPLIANCE_EXCEPTION',
    ],
  },
  {
    title: 'Contract',
    states: [
      'COMPLIANCE_APPROVED',
      'CONTRACT_DRAFT_REQUESTED',
      'CONTRACT_SENT',
      'CLIENT_REVIEWING_CONTRACT',
      'CONTRACT_COMMENTS_RECEIVED',
      'LEGAL_REVIEW',
      'CONTRACT_REVISED_SENT',
      'CONTRACT_ACCEPTED',
    ],
  },
  {
    title: 'Signing',
    states: [
      'SIGNATORIES_REQUESTED',
      'DOCSIGN_PENDING',
      'DOCSIGN_SIGNED',
      'CONTRACT_UPLOADED_HQ',
      'USERS_REQUESTED',
      'USERS_CREATED',
    ],
  },
  { title: 'Live', states: ['CLIENT_ACTIVE', 'FIRST_TRADE_PENDING', 'TRADING'] },
]

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

function canTransition(role: string, state: string): boolean {
  return TRANSITION_ROLES.has(role) && getNextStates(state).length > 0
}

export function ClientKanban({ clients }: { clients: ClientRecord[] }) {
  const router = useRouter()
  const [role, setRole] = useState('RM')
  const [openClientId, setOpenClientId] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState('')
  const [pendingClientId, setPendingClientId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setRole(readRoleCookie())

    function handleRoleChange(event: Event) {
      const nextRole = (event as CustomEvent<string>).detail
      setRole(nextRole)
      setOpenClientId(null)
      setErrors({})
    }

    window.addEventListener('demo-role-change', handleRoleChange)
    return () => window.removeEventListener('demo-role-change', handleRoleChange)
  }, [])

  const groupedClients = useMemo(
    () =>
      COLUMNS.map((column) => ({
        ...column,
        clients: clients.filter((client) => column.states.includes(client.currentState)),
      })),
    [clients],
  )

  function openAdvance(client: ClientRecord) {
    const nextStates = getNextStates(client.currentState)
    setOpenClientId(client.id)
    setSelectedState(nextStates[0] ?? '')
    setErrors((current) => ({ ...current, [client.id]: '' }))
  }

  async function advanceClient(client: ClientRecord) {
    if (!selectedState) return
    setPendingClientId(client.id)
    setErrors((current) => ({ ...current, [client.id]: '' }))

    const response = await fetch(`/api/clients/${client.id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toState: selectedState,
        notes: `Advanced from Kanban as ${role}`,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    setPendingClientId(null)

    if (!response.ok) {
      setErrors((current) => ({
        ...current,
        [client.id]: payload.error ?? 'Unable to advance client',
      }))
      return
    }

    setOpenClientId(null)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Onboarding clients</h1>
          <p className="mt-1 text-sm text-slate-500">Live client movement from intake to trading.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Active role: <span className="font-semibold text-slate-900">{role}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        {groupedClients.map((column) => (
          <section key={column.title} className="min-h-[280px] rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{column.title}</h2>
              <span className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm">
                {column.clients.length}
              </span>
            </div>
            <div className="space-y-3 p-3">
              {column.clients.map((client) => {
                const nextStates = getNextStates(client.currentState)
                const markets = parseJsonList(client.marketScope)
                const sla = SLA_DEFINITIONS[client.currentState]
                const isOpen = openClientId === client.id
                const showAdvance = canTransition(role, client.currentState)

                return (
                  <article key={client.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{client.name}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex min-h-6 items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                            {client.type}
                          </span>
                          <StateBadge state={client.currentState} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs text-slate-500">
                          Markets <span className="font-mono text-slate-800">{markets.join(', ') || 'N/A'}</span>
                        </div>
                        {sla ? <SLATimer stateEnteredAt={client.stateEnteredAt} maxHours={sla.maxHours} /> : null}
                      </div>

                      {errors[client.id] ? (
                        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700">
                          {errors[client.id]}
                        </div>
                      ) : null}

                      {isOpen ? (
                        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                          <select
                            aria-label={`Next state for ${client.name}`}
                            value={selectedState}
                            onChange={(event) => setSelectedState(event.target.value)}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          >
                            {nextStates.map((state) => (
                              <option key={state} value={state}>
                                {state.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => advanceClient(client)}
                              disabled={pendingClientId === client.id}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenClientId(null)}
                              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className={showAdvance ? 'grid grid-cols-2 gap-2' : 'grid gap-2'}>
                        <Link
                          href={`/clients/${client.id}`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        {showAdvance ? (
                          <button
                            type="button"
                            onClick={() => openAdvance(client)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            Advance State
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
