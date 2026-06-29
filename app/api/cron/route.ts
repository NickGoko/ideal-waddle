import { NextResponse } from 'next/server'
import { fireAlert } from '@/src/lib/alerts'
import { checkSlaBreaches } from '@/src/lib/sla'

export const dynamic = 'force-dynamic'

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

interface SlaRunSummary {
  breachesFound: number
  alertsFired: number
  alertsSkipped: number
  ranAt: string
}

interface CronState {
  started: boolean
  interval?: NodeJS.Timeout
  lastRun?: SlaRunSummary
}

const globalForCron = globalThis as typeof globalThis & {
  poipSlaCron?: CronState
}

const cronState = globalForCron.poipSlaCron ?? { started: false }
globalForCron.poipSlaCron = cronState

async function runSlaCheck(): Promise<SlaRunSummary> {
  const breaches = await checkSlaBreaches()
  let alertsFired = 0
  let alertsSkipped = 0

  for (const { client, slaDefinition, hoursElapsed } of breaches) {
    const result = await fireAlert({
      type: 'SLA_BREACH',
      entityType: 'CLIENT',
      entityId: client.id,
      severity: hoursElapsed > slaDefinition.maxHours * 2 ? 'CRITICAL' : 'HIGH',
      channel: slaDefinition.channel,
      message: `SLA breach: ${client.name} has been in ${client.currentState} for ${Math.round(
        hoursElapsed,
      )} hours (limit: ${slaDefinition.maxHours}h)`,
    })

    if (result.fired) alertsFired += 1
    if (result.skipped) alertsSkipped += 1
  }

  const summary = {
    breachesFound: breaches.length,
    alertsFired,
    alertsSkipped,
    ranAt: new Date().toISOString(),
  }

  cronState.lastRun = summary
  console.log(
    `[CRON] SLA check complete. ${summary.breachesFound} breach(es) found, ${summary.alertsFired} fired, ${summary.alertsSkipped} skipped.`,
  )

  return summary
}

export async function GET() {
  try {
    if (!cronState.started) {
      cronState.started = true
      const initialRun = await runSlaCheck()
      cronState.interval = setInterval(() => {
        runSlaCheck().catch((error) => {
          console.error('[CRON] SLA check failed:', error)
        })
      }, FIFTEEN_MINUTES_MS)

      console.log('[CRON] SLA monitor started - runs every 15 minutes')

      return NextResponse.json({
        status: 'ok',
        message: 'Cron started',
        intervalMinutes: 15,
        lastRun: initialRun,
      })
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Cron is running',
      intervalMinutes: 15,
      lastRun: cronState.lastRun ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected cron error'
    console.error('[CRON] SLA monitor failed:', error)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}
