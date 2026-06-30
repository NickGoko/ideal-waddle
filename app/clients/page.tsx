import { ClientKanban } from '@/components/ClientKanban'
import { prisma } from '@/src/lib/prisma'

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

// Query the database directly in this Server Component. Previously this fetched
// its own /api/clients route over HTTP using an absolute base URL, which broke on
// Vercel (no localhost server in a serverless function). An in-process Prisma
// query is faster and host-independent.
async function getClients(): Promise<ClientRecord[]> {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    type: client.type,
    currentState: client.currentState,
    stateEnteredAt: client.stateEnteredAt.toISOString(),
    marketScope: client.marketScope,
    productScope: client.productScope,
  }))
}

export default async function ClientsPage() {
  const clients = await getClients()

  return <ClientKanban clients={clients} />
}
