'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'RM', label: 'RM' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'TREASURY', label: 'Treasury' },
  { value: 'ADMIN', label: 'Admin' },
] as const

function readRoleCookie(): string {
  if (typeof document === 'undefined') return 'RM'
  const match = document.cookie.match(/(?:^|;\s*)demo_role=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : 'RM'
}

export function RoleSwitcher() {
  const router = useRouter()
  const [role, setRole] = useState('RM')

  useEffect(() => {
    setRole(readRoleCookie())
  }, [])

  function handleRoleChange(nextRole: string) {
    document.cookie = `demo_role=${encodeURIComponent(nextRole)}; path=/; max-age=31536000; SameSite=Lax`
    setRole(nextRole)
    window.dispatchEvent(new CustomEvent('demo-role-change', { detail: nextRole }))
    router.refresh()
  }

  const label = ROLES.find((item) => item.value === role)?.label ?? 'RM'

  return (
    <div className="flex items-center gap-3">
      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-normal text-emerald-700">
        {label}
      </span>
      <select
        aria-label="Demo role"
        value={role}
        onChange={(event) => handleRoleChange(event.target.value)}
        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        {ROLES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  )
}
