import { ClientKanban } from '@/components/ClientKanban'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

interface ClientRecord {
  id: string
  name: string
  type: string
  currentState: string
  stateEnteredAt: string
  marketScope: string
  productScope: string
}

async function getClients(): Promise<ClientRecord[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const response = await fetch(`${baseUrl}/api/clients`, {
    cache: 'no-store',
    headers: { cookie: cookies().toString() },
  })

  if (!response.ok) {
    throw new Error(`Unable to load clients: ${response.status}`)
  }

  const payload = (await response.json()) as { clients: ClientRecord[] }
  return payload.clients
}

export default async function ClientsPage() {
  const clients = await getClients()

  return <ClientKanban clients={clients} />
}
