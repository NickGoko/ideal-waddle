'use client'

import { useEffect, useMemo, useState } from 'react'

interface SLATimerProps {
  stateEnteredAt: string
  maxHours: number
}

function elapsedMsSince(timestamp: string): number {
  return Math.max(Date.now() - new Date(timestamp).getTime(), 0)
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

export function SLATimer({ stateEnteredAt, maxHours }: SLATimerProps) {
  const [elapsedMs, setElapsedMs] = useState(() => elapsedMsSince(stateEnteredAt))

  useEffect(() => {
    setElapsedMs(elapsedMsSince(stateEnteredAt))
    const timer = window.setInterval(() => {
      setElapsedMs(elapsedMsSince(stateEnteredAt))
    }, 60000)

    return () => window.clearInterval(timer)
  }, [stateEnteredAt])

  const tone = useMemo(() => {
    const ratio = elapsedMs / (maxHours * 60 * 60 * 1000)
    if (ratio < 0.5) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    if (ratio <= 0.9) return 'border-amber-200 bg-amber-50 text-amber-700'
    return 'border-red-200 bg-red-50 text-red-700'
  }, [elapsedMs, maxHours])

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`}
    >
      {formatElapsed(elapsedMs)}
    </span>
  )
}
