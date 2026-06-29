import { createHash } from 'crypto'
import { prisma } from '../src/lib/prisma'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

async function main() {
  console.log('Seeding database...')

  // ── USERS ──────────────────────────────────────────────────────────────────
  const grace = await prisma.user.upsert({
    where: { email: 'grace.wanjiku@poip.io' },
    update: {},
    create: { name: 'Grace Wanjiku', email: 'grace.wanjiku@poip.io', role: 'RM', market: 'KE' },
  })
  const david = await prisma.user.upsert({
    where: { email: 'david.osei@poip.io' },
    update: {},
    create: { name: 'David Osei', email: 'david.osei@poip.io', role: 'RM', market: 'GH' },
  })
  const nicole = await prisma.user.upsert({
    where: { email: 'nicole.achieng@poip.io' },
    update: {},
    create: { name: 'Nicole Achieng', email: 'nicole.achieng@poip.io', role: 'COMPLIANCE', market: 'KE' },
  })
  const lauren = await prisma.user.upsert({
    where: { email: 'lauren.mutua@poip.io' },
    update: {},
    create: { name: 'Lauren Mutua', email: 'lauren.mutua@poip.io', role: 'LEGAL', market: 'KE' },
  })
  const james = await prisma.user.upsert({
    where: { email: 'james.kariuki@poip.io' },
    update: {},
    create: { name: 'James Kariuki', email: 'james.kariuki@poip.io', role: 'TREASURY', market: 'KE' },
  })
  const admin = await prisma.user.upsert({
    where: { email: 'admin@poip.io' },
    update: {},
    create: { name: 'Admin User', email: 'admin@poip.io', role: 'ADMIN' },
  })

  console.log('✓ Users seeded:', [grace, david, nicole, lauren, james, admin].map(u => u.name).join(', '))

  // ── MARKET INFRASTRUCTURE ──────────────────────────────────────────────────
  const markets = [
    { market: 'KE', setupType: 'LOCAL_REGISTRATION', isActive: true, bankRelationshipCount: 3, paymentsCapable: true },
    { market: 'TZ', setupType: 'PARTNERSHIP', isActive: true, bankRelationshipCount: 2, paymentsCapable: true },
    { market: 'RW', setupType: 'LOCAL_REGISTRATION', isActive: true, bankRelationshipCount: 3, paymentsCapable: true },
    { market: 'UG', setupType: 'NON_RESIDENT_ACCOUNT', isActive: true, bankRelationshipCount: 1, paymentsCapable: false },
    { market: 'ETH', setupType: 'PARTNERSHIP', isActive: true, bankRelationshipCount: 1, paymentsCapable: false },
    { market: 'ZM', setupType: 'LOCAL_REGISTRATION', isActive: true, bankRelationshipCount: 3, paymentsCapable: true },
  ]

  for (const m of markets) {
    await prisma.marketInfrastructure.upsert({
      where: { market: m.market },
      update: {},
      create: { ...m, licenseStatus: 'ACTIVE', lastReviewedAt: new Date() },
    })
  }

  console.log('✓ Markets seeded:', markets.map(m => m.market).join(', '))

  // ── PARTNERS ───────────────────────────────────────────────────────────────
  const partnerDefs = [
    // Kenya
    { market: 'KE', name: 'Equity Bank', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'KE', name: 'KCB', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'KE', name: 'Co-op Bank', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'KE', name: 'Safaricom', type: 'TELCO', apiIntegrationStatus: 'ACTIVE' },
    { market: 'KE', name: 'Airtel Kenya', type: 'TELCO', apiIntegrationStatus: 'ACTIVE' },
    // Tanzania
    { market: 'TZ', name: 'CRDB', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'TZ', name: 'NMB', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'TZ', name: 'Vodacom', type: 'TELCO', apiIntegrationStatus: 'IN_PROGRESS' },
    // Rwanda
    { market: 'RW', name: 'Bank of Kigali', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'RW', name: 'BPR Atlas Mara', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'RW', name: 'MTN Rwanda', type: 'TELCO', apiIntegrationStatus: 'ACTIVE' },
    // Uganda
    { market: 'UG', name: 'Stanbic Uganda', type: 'BANK', apiIntegrationStatus: 'NONE' },
    { market: 'UG', name: 'MTN Uganda', type: 'TELCO', apiIntegrationStatus: 'ACTIVE' },
    // Ethiopia
    { market: 'ETH', name: 'CBE', type: 'BANK', apiIntegrationStatus: 'IN_PROGRESS' },
    { market: 'ETH', name: 'Telebirr', type: 'TELCO', apiIntegrationStatus: 'NONE' },
    // Zambia
    { market: 'ZM', name: 'Zanaco', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'ZM', name: 'FNB Zambia', type: 'BANK', apiIntegrationStatus: 'ACTIVE' },
    { market: 'ZM', name: 'Airtel Money', type: 'TELCO', apiIntegrationStatus: 'ACTIVE' },
  ]

  const partnerRecords: Record<string, { id: string }> = {}
  for (const p of partnerDefs) {
    const rec = await prisma.partner.create({
      data: {
        market: p.market,
        name: p.name,
        type: p.type,
        apiIntegrationStatus: p.apiIntegrationStatus,
        noObjectionLetterStatus: p.type === 'BANK' ? 'OBTAINED' : 'NOT_REQUIRED',
        channels: JSON.stringify(['COLLECTION', 'PAYOUT']),
      },
    })
    partnerRecords[`${p.market}:${p.name}`] = rec
  }

  console.log('✓ Partners seeded:', partnerDefs.length)

  // ── BANK ACCOUNTS ──────────────────────────────────────────────────────────
  const currencyByMarket: Record<string, string> = {
    KE: 'KES', TZ: 'TZS', RW: 'RWF', UG: 'UGX', ETH: 'ETB', ZM: 'ZMW',
  }

  const bankAccounts: Record<string, { id: string }> = {}
  for (const p of partnerDefs) {
    if (p.type === 'BANK' && p.apiIntegrationStatus === 'ACTIVE') {
      const partner = partnerRecords[`${p.market}:${p.name}`]
      const acct = await prisma.bankAccount.create({
        data: {
          partnerId: partner.id,
          market: p.market,
          accountType: 'LOCAL',
          currency: currencyByMarket[p.market] ?? 'USD',
          accountNumber: Math.floor(Math.random() * 9000000000 + 1000000000).toString(),
          isActive: true,
        },
      })
      bankAccounts[`${p.market}:${p.name}`] = acct
    }
  }

  console.log('✓ Bank accounts seeded:', Object.keys(bankAccounts).length)

  // ── CLIENTS ────────────────────────────────────────────────────────────────
  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

  const acme = await prisma.client.create({
    data: {
      name: 'Acme Imports Ltd',
      type: 'CORPORATE',
      currentState: 'COMPLIANCE_REVIEW',
      stateEnteredAt: daysAgo(3),
      productScope: JSON.stringify(['PAYMENTS']),
      marketScope: JSON.stringify(['KE', 'RW']),
      rmId: grace.id,
      industry: 'Import/Export',
    },
  })

  const savanna = await prisma.client.create({
    data: {
      name: 'Savanna Trade Co',
      type: 'NON_FI',
      currentState: 'CONTRACT_SENT',
      stateEnteredAt: daysAgo(5),
      productScope: JSON.stringify(['OTC']),
      marketScope: JSON.stringify(['TZ', 'UG']),
      rmId: david.id,
      industry: 'Commodities Trading',
    },
  })

  const bluesky = await prisma.client.create({
    data: {
      name: 'BlueSky Remittances',
      type: 'FI',
      currentState: 'TRADING',
      stateEnteredAt: daysAgo(90),
      productScope: JSON.stringify(['PAYMENTS', 'OTC']),
      marketScope: JSON.stringify(['KE', 'ZM']),
      rmId: grace.id,
      industry: 'Remittances',
    },
  })

  const horizon = await prisma.client.create({
    data: {
      name: 'Horizon Capital',
      type: 'FI',
      currentState: 'DOCS_EXCEPTION',
      stateEnteredAt: daysAgo(2),
      productScope: JSON.stringify(['OTC']),
      marketScope: JSON.stringify(['ETH', 'RW']),
      rmId: david.id,
      industry: 'Asset Management',
    },
  })

  const fastpay = await prisma.client.create({
    data: {
      name: 'FastPay Solutions',
      type: 'CORPORATE',
      currentState: 'LEAD_RECEIVED',
      stateEnteredAt: daysAgo(1),
      productScope: JSON.stringify(['PAYMENTS']),
      marketScope: JSON.stringify(['KE']),
      rmId: grace.id,
      industry: 'Fintech',
    },
  })

  console.log('✓ Clients seeded:', [acme, savanna, bluesky, horizon, fastpay].map(c => c.name).join(', '))

  // ── STATE LOGS ─────────────────────────────────────────────────────────────
  // Acme: LEAD_RECEIVED → ... → COMPLIANCE_REVIEW
  const acmeStates = [
    'LEAD_RECEIVED', 'PACK_SENT', 'DOCS_SUBMITTED', 'DOCS_PROCESSING',
    'DOCS_VALIDATED', 'HQ_PROFILE_CREATED', 'SAMSUB_SUBMITTED', 'SAMSUB_COMPLETE', 'COMPLIANCE_REVIEW',
  ]
  for (let i = 0; i < acmeStates.length; i++) {
    await prisma.clientStateLog.create({
      data: {
        clientId: acme.id,
        fromState: i === 0 ? null : acmeStates[i - 1],
        toState: acmeStates[i],
        triggeredBy: i === 0 ? 'HUMAN' : 'HUMAN',
        actorId: grace.id,
        createdAt: daysAgo(20 - i * 2),
      },
    })
  }

  // Savanna: up to CONTRACT_SENT
  const savannaStates = [
    'LEAD_RECEIVED', 'PACK_SENT', 'DOCS_SUBMITTED', 'DOCS_PROCESSING',
    'DOCS_VALIDATED', 'HQ_PROFILE_CREATED', 'SAMSUB_SUBMITTED', 'SAMSUB_COMPLETE',
    'COMPLIANCE_REVIEW', 'COMPLIANCE_APPROVED', 'CONTRACT_DRAFT_REQUESTED', 'CONTRACT_SENT',
  ]
  for (let i = 0; i < savannaStates.length; i++) {
    await prisma.clientStateLog.create({
      data: {
        clientId: savanna.id,
        fromState: i === 0 ? null : savannaStates[i - 1],
        toState: savannaStates[i],
        triggeredBy: 'HUMAN',
        actorId: david.id,
        createdAt: daysAgo(30 - i * 2),
      },
    })
  }

  // BlueSky: all the way to TRADING
  const blueskyStates = [
    'LEAD_RECEIVED', 'PACK_SENT', 'DOCS_SUBMITTED', 'DOCS_PROCESSING',
    'DOCS_VALIDATED', 'HQ_PROFILE_CREATED', 'SAMSUB_SUBMITTED', 'SAMSUB_COMPLETE',
    'COMPLIANCE_REVIEW', 'COMPLIANCE_APPROVED', 'CONTRACT_DRAFT_REQUESTED', 'CONTRACT_SENT',
    'CLIENT_REVIEWING_CONTRACT', 'CONTRACT_ACCEPTED', 'SIGNATORIES_REQUESTED', 'DOCSIGN_PENDING',
    'DOCSIGN_SIGNED', 'CONTRACT_UPLOADED_HQ', 'USERS_REQUESTED', 'USERS_CREATED',
    'CLIENT_ACTIVE', 'FIRST_TRADE_PENDING', 'TRADING',
  ]
  for (let i = 0; i < blueskyStates.length; i++) {
    await prisma.clientStateLog.create({
      data: {
        clientId: bluesky.id,
        fromState: i === 0 ? null : blueskyStates[i - 1],
        toState: blueskyStates[i],
        triggeredBy: i % 3 === 0 ? 'AUTOMATION' : 'HUMAN',
        actorId: grace.id,
        createdAt: daysAgo(120 - i * 4),
      },
    })
  }

  // Horizon: LEAD → DOCS_EXCEPTION
  const horizonStates = ['LEAD_RECEIVED', 'PACK_SENT', 'DOCS_SUBMITTED', 'DOCS_PROCESSING', 'DOCS_EXCEPTION']
  for (let i = 0; i < horizonStates.length; i++) {
    await prisma.clientStateLog.create({
      data: {
        clientId: horizon.id,
        fromState: i === 0 ? null : horizonStates[i - 1],
        toState: horizonStates[i],
        triggeredBy: 'HUMAN',
        actorId: david.id,
        createdAt: daysAgo(10 - i),
      },
    })
  }

  // FastPay: just LEAD_RECEIVED
  await prisma.clientStateLog.create({
    data: {
      clientId: fastpay.id,
      fromState: null,
      toState: 'LEAD_RECEIVED',
      triggeredBy: 'HUMAN',
      actorId: grace.id,
      createdAt: daysAgo(1),
    },
  })

  console.log('✓ State logs seeded')

  // ── 30 TRADES FOR BLUESKY ──────────────────────────────────────────────────
  const pairs = ['KES/USD', 'KES/GBP', 'KES/EUR', 'ZMW/USD', 'ZMW/GBP']
  const directions = ['BUY', 'SELL']
  const sources = ['PORTAL', 'WHATSAPP', 'MANUAL']
  const kesBankAccount = bankAccounts['KE:Equity Bank'] ?? bankAccounts['KE:KCB']
  const zmBankAccount = bankAccounts['ZM:Zanaco'] ?? bankAccounts['ZM:FNB Zambia']

  for (let i = 0; i < 30; i++) {
    const pair = pairs[i % pairs.length]
    const direction = directions[i % 2]
    const volume = Math.round((10000 + Math.random() * 490000) * 100) / 100
    const rate = pair.startsWith('KES') ? 130 + Math.random() * 5 : 24 + Math.random() * 2
    const margin = Math.round((10 + Math.random() * 40) * 10) / 10
    const bookedAt = daysAgo(90 - i * 2)
    const bankAccountId = pair.startsWith('KES') ? kesBankAccount?.id : zmBankAccount?.id
    const market = pair.startsWith('KES') ? 'KE' : 'ZM'

    const idempotencyKey = sha256(
      `${bluesky.id}:${pair}:${direction}:${volume}:${bookedAt.toISOString()}`
    )

    await prisma.trade.create({
      data: {
        idempotencyKey,
        clientId: bluesky.id,
        currencyPair: pair,
        direction,
        volume,
        valueUsd: volume / rate,
        rate,
        marginBps: margin,
        bankAccountId: bankAccountId ?? null,
        market,
        source: sources[i % sources.length],
        bookedAt,
        dayOfWeek: bookedAt.getDay(),
        dayOfMonth: bookedAt.getDate(),
        monthOfYear: bookedAt.getMonth() + 1,
      },
    })
  }

  console.log('✓ Trades seeded: 30 for BlueSky Remittances')

  // ── DOCUMENTS FOR CLIENTS ──────────────────────────────────────────────────
  const docTypes = ['PASSPORT', 'CERTIFICATE_OF_INCORPORATION', 'UTILITY_BILL', 'AML_FORM']

  for (const docType of docTypes) {
    await prisma.onboardingDocument.create({
      data: {
        clientId: acme.id,
        docType,
        status: 'APPROVED',
        ocrConfidence: 0.94 + Math.random() * 0.05,
        fileName: `${docType.toLowerCase()}_acme.pdf`,
      },
    })
  }

  for (const docType of docTypes) {
    await prisma.onboardingDocument.create({
      data: {
        clientId: horizon.id,
        docType,
        status: docType === 'UTILITY_BILL' ? 'EXCEPTION' : 'PENDING',
        ocrConfidence: docType === 'UTILITY_BILL' ? 0.41 : null,
        exceptionReason: docType === 'UTILITY_BILL' ? 'Document expired — utility bill is older than 3 months' : null,
        fileName: `${docType.toLowerCase()}_horizon.pdf`,
      },
    })
  }

  console.log('✓ Documents seeded')

  // ── COMPLIANCE REVIEWS ─────────────────────────────────────────────────────
  await prisma.complianceReview.create({
    data: {
      clientId: acme.id,
      samsub_applicantId: 'samsub_acme_001',
      samsub_reportUrl: 'https://mock.sumsub.com/reports/acme_001',
      status: 'PENDING',
      reviewerId: nicole.id,
    },
  })

  await prisma.complianceReview.create({
    data: {
      clientId: bluesky.id,
      samsub_applicantId: 'samsub_bluesky_001',
      samsub_reportUrl: 'https://mock.sumsub.com/reports/bluesky_001',
      status: 'APPROVED',
      reviewerId: nicole.id,
      reviewedAt: daysAgo(100),
    },
  })

  console.log('✓ Compliance reviews seeded')

  // ── CONTRACTS ──────────────────────────────────────────────────────────────
  await prisma.contract.create({
    data: {
      clientId: savanna.id,
      type: 'OTC',
      version: 1,
      status: 'SENT',
    },
  })

  await prisma.contract.create({
    data: {
      clientId: bluesky.id,
      type: 'COMBINED',
      version: 2,
      status: 'EXECUTED',
      docsignEnvelopeId: 'env_bluesky_20240315',
    },
  })

  console.log('✓ Contracts seeded')

  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
