import { NextResponse } from 'next/server'
import { getDemoActorId, getRoleFromRequest, requireRole } from '@/src/lib/auth'
import { transitionClient } from '@/src/lib/stateMachine'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!requireRole(request, ['RM', 'COMPLIANCE', 'LEGAL', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { toState, notes } = body

    if (typeof toState !== 'string') {
      return NextResponse.json({ error: 'Required body: { toState, notes? }' }, { status: 400 })
    }

    const role = getRoleFromRequest(request)
    const actorId = await getDemoActorId(role)

    const result = await transitionClient({
      clientId: params.id,
      toState,
      actorId,
      triggeredBy: 'HUMAN',
      notes: typeof notes === 'string' ? notes : null,
    })

    if (!result.success) {
      const status = result.error === 'Client not found' ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ client: result.client })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
