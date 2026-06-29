'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, BarChart3, BriefcaseBusiness, CircleDollarSign, LayoutDashboard } from 'lucide-react'
import { RoleSwitcher } from './RoleSwitcher'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: BriefcaseBusiness },
  { href: '/trades', label: 'Trades', icon: CircleDollarSign },
  { href: '/markets', label: 'Markets', icon: BarChart3 },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[220px] flex-col bg-[#0F172A] text-slate-100 md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-sm font-semibold uppercase tracking-normal text-sky-200">POIP</div>
          <div className="mt-1 text-xs text-slate-400">Payments onboarding</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const active =
              item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                  active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="min-h-screen md:pl-[220px]">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div>
            <div className="text-sm font-semibold text-slate-900">Payments Onboarding & Intelligence</div>
            <div className="text-xs text-slate-500">Client workflow control tower</div>
          </div>
          <RoleSwitcher />
        </header>
        <main className="bg-white px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}
