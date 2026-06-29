interface StateBadgeProps {
  state: string
}

function stateTone(state: string): string {
  if (state.includes('EXCEPTION') || state.includes('BREACH')) {
    return 'border-red-200 bg-red-50 text-red-700'
  }

  if (
    state.includes('APPROVED') ||
    state.includes('ACTIVE') ||
    state.includes('TRADING') ||
    state.includes('COMPLETE')
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export function StateBadge({ state }: StateBadgeProps) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-normal ${stateTone(
        state,
      )}`}
    >
      {state.replaceAll('_', ' ')}
    </span>
  )
}
