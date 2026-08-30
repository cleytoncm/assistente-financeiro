/**
 * One-off dev-only seed script: creates a demo user with realistic data across every feature
 * (accounts, cards, manual transactions, card invoices, avulsa/parcelada/recorrente payables)
 * spanning roughly 3 months back and 3 months forward, for manually testing the UI. Reuses the
 * real service functions (not raw SQL) so every domain rule (invoice bucketing, installment
 * splitting, payable due-date generation) runs exactly as it would for a real user.
 *
 * Run against the DEV database (never the test one): `npx tsx scripts/seedDemoData.ts`
 */
import { config } from 'dotenv'
config()

import { prisma } from '../src/config/prisma.js'
import { registerUser } from '../src/modules/auth/auth.service.js'
import { createAccount } from '../src/modules/accounts/account.service.js'
import { createCard } from '../src/modules/cards/card.service.js'
import { createTransaction } from '../src/modules/transactions/transaction.service.js'
import { listInvoicesForCard, payInvoice } from '../src/modules/invoices/invoice.service.js'
import { createPayable, payPayable } from '../src/modules/payables/payable.service.js'
import { createPayableGroup } from '../src/modules/payables/payableGroup.service.js'

const DEMO_EMAIL = 'teste@example.com'
const DEMO_PASSWORD = 'teste1234'
const DEMO_NAME = 'Usuário de Teste'

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Wipes a previous run's data so this script can be re-run to get a fresh dataset. */
async function resetDemoUser(userId: string): Promise<void> {
  // Invoice.paymentTransactionId and Transaction.invoiceId reference each other, so the
  // payment link has to be broken before either side can be deleted.
  await prisma.invoice.updateMany({ where: { userId }, data: { paymentTransactionId: null } })
  await prisma.payable.deleteMany({ where: { userId } })
  await prisma.payableGroup.deleteMany({ where: { userId } })
  await prisma.transaction.deleteMany({ where: { userId } })
  await prisma.invoice.deleteMany({ where: { userId } })
  await prisma.card.deleteMany({ where: { userId } })
  await prisma.account.deleteMany({ where: { userId } })
  await prisma.user.delete({ where: { id: userId } })
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (existing) {
    console.log(`Usuário de demonstração já existe (${DEMO_EMAIL}) — apagando dados antigos para recriar...`)
    await resetDemoUser(existing.id)
  }

  const today = new Date(new Date().toISOString().slice(0, 10))

  console.log(`Criando usuário de demonstração: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
  const user = await registerUser({ name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD })
  const userId = user.id

  const bankByName = async (name: string) => prisma.bank.findFirstOrThrow({ where: { name } })
  const [bancoDoBrasil, itau, nubank] = await Promise.all([
    bankByName('Banco do Brasil'),
    bankByName('Itaú Unibanco'),
    bankByName('Nubank'),
  ])

  const categories = await prisma.category.findMany({ where: { userId: null } })
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id

  // --- Contas ---------------------------------------------------------------------------
  console.log('Criando contas...')
  const contaCorrente = await createAccount(userId, {
    name: 'Conta Corrente',
    bankId: bancoDoBrasil.id,
    initialBalance: 5000,
  })
  const poupanca = await createAccount(userId, { name: 'Poupança', bankId: itau.id, initialBalance: 10000 })
  const contaNubank = await createAccount(userId, { name: 'Conta Nubank', bankId: nubank.id, initialBalance: 1500 })

  // --- Cartões ----------------------------------------------------------------------------
  console.log('Criando cartões...')
  const cartaoNubank = await createCard(userId, {
    name: 'Cartão Nubank',
    creditLimit: 5000,
    closingDay: 5,
    dueDay: 15,
    linkedAccountId: contaNubank.id,
  })
  const cartaoInter = await createCard(userId, {
    name: 'Cartão Inter',
    creditLimit: 3000,
    closingDay: 20,
    dueDay: 30,
  })

  // --- Lançamentos manuais em conta (RF-01..RF-03, Etapa 3) — ~10 itens, últimos 3 meses ---
  console.log('Criando lançamentos manuais em conta...')
  for (let i = 3; i >= 1; i--) {
    await createTransaction(userId, {
      type: 'income',
      amount: 6000,
      date: iso(addDays(addMonths(today, -i), 4)),
      description: 'Salário',
      categoryId: categoryId('Salário'),
      accountId: contaCorrente.id,
    })
    await createTransaction(userId, {
      type: 'expense',
      amount: 1800,
      date: iso(addDays(addMonths(today, -i), 9)),
      description: 'Aluguel do mês',
      categoryId: categoryId('Moradia'),
      accountId: contaCorrente.id,
    })
  }
  await createTransaction(userId, {
    type: 'income',
    amount: 1200,
    date: iso(addMonths(today, -1)),
    description: 'Projeto freelance',
    categoryId: categoryId('Freelance'),
    accountId: contaCorrente.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 420,
    date: iso(addDays(addMonths(today, -2), 12)),
    description: 'Mercado do mês',
    categoryId: categoryId('Alimentação'),
    accountId: poupanca.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 150,
    date: iso(addDays(addMonths(today, -1), 12)),
    description: 'Internet e telefone',
    categoryId: categoryId('Contas e serviços'),
    accountId: contaCorrente.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 90,
    date: iso(addDays(today, -3)),
    description: 'Uber da semana',
    categoryId: categoryId('Transporte'),
    accountId: contaCorrente.id,
  })

  // --- Lançamentos de cartão / faturas (Etapa 4) — passado, atual e futuro (parceladas) ----
  console.log('Criando lançamentos de cartão (gerando faturas passadas, atuais e futuras)...')
  await createTransaction(userId, {
    type: 'expense',
    amount: 250,
    date: iso(addDays(addMonths(today, -2), 3)),
    description: 'Mercado (cartão)',
    categoryId: categoryId('Alimentação'),
    cardId: cartaoNubank.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 180,
    date: iso(addDays(addMonths(today, -1), 8)),
    description: 'Restaurante',
    categoryId: categoryId('Alimentação'),
    cardId: cartaoNubank.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 75,
    date: iso(addDays(today, -2)),
    description: 'Farmácia',
    categoryId: categoryId('Saúde'),
    cardId: cartaoNubank.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 1800,
    date: iso(today),
    description: 'Notebook novo',
    categoryId: categoryId('Compras'),
    cardId: cartaoNubank.id,
    installments: 3,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 120,
    date: iso(addDays(addMonths(today, -1), 15)),
    description: 'Posto de gasolina',
    categoryId: categoryId('Transporte'),
    cardId: cartaoInter.id,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 2000,
    date: iso(addDays(addMonths(today, -2), 5)),
    description: 'Móveis para sala',
    categoryId: categoryId('Compras'),
    cardId: cartaoInter.id,
    installments: 4,
  })
  await createTransaction(userId, {
    type: 'expense',
    amount: 60,
    date: iso(addDays(today, -5)),
    description: 'Livraria',
    categoryId: categoryId('Educação'),
    cardId: cartaoInter.id,
  })

  console.log('Pagando faturas já fechadas...')
  for (const cardId of [cartaoNubank.id, cartaoInter.id]) {
    const invoices = await listInvoicesForCard(userId, cardId)
    for (const invoice of invoices) {
      if ((invoice.status === 'fechada' || invoice.status === 'atrasada') && Number(invoice.total) > 0) {
        await payInvoice(userId, invoice.id, { accountId: contaCorrente.id })
      }
    }
  }

  // --- Contas a pagar/receber avulsas (Etapa 5) — 10 itens cobrindo todos os status ---------
  console.log('Criando contas a pagar/receber avulsas...')
  const paidExpense = await createPayable(userId, {
    type: 'expense',
    amount: 320,
    dueDate: iso(addMonths(today, -2)),
    description: 'Consulta médica',
    accountId: contaCorrente.id,
  })
  await payPayable(userId, paidExpense.id, { accountId: contaCorrente.id })

  const paidIncome = await createPayable(userId, {
    type: 'income',
    amount: 500,
    dueDate: iso(addMonths(today, -1)),
    description: 'Reembolso de viagem',
    counterparty: 'Empresa XPTO',
    accountId: contaCorrente.id,
  })
  await payPayable(userId, paidIncome.id, { accountId: contaCorrente.id })

  await createPayable(userId, {
    type: 'expense',
    amount: 89,
    dueDate: iso(addDays(today, -10)),
    description: 'Assinatura de streaming',
    accountId: contaCorrente.id,
  })
  await createPayable(userId, {
    type: 'income',
    amount: 300,
    dueDate: iso(addDays(today, -5)),
    description: 'Venda de item usado',
    counterparty: 'Maria Comprou',
    accountId: contaCorrente.id,
  })
  await createPayable(userId, {
    type: 'expense',
    amount: 145,
    dueDate: iso(today),
    description: 'Conta de internet',
    accountId: contaCorrente.id,
  })
  await createPayable(userId, {
    type: 'income',
    amount: 800,
    dueDate: iso(today),
    description: 'Pagamento de cliente',
    counterparty: 'João Cliente',
    accountId: poupanca.id,
  })
  await createPayable(userId, {
    type: 'expense',
    amount: 250,
    dueDate: iso(addDays(today, 15)),
    description: 'Manutenção do carro',
    accountId: contaCorrente.id,
  })
  await createPayable(userId, {
    type: 'income',
    amount: 1500,
    dueDate: iso(addDays(today, 20)),
    description: 'Segunda parcela de projeto',
    counterparty: 'Empresa ACME',
    accountId: poupanca.id,
  })
  await createPayable(userId, {
    type: 'expense',
    amount: 600,
    dueDate: iso(addMonths(today, 2)),
    description: 'Seguro do carro',
    accountId: contaCorrente.id,
  })
  const cancelled = await createPayable(userId, {
    type: 'expense',
    amount: 200,
    dueDate: iso(addDays(today, 30)),
    description: 'Curso online (desistido)',
    accountId: contaCorrente.id,
  })
  await prisma.payable.update({
    where: { id: cancelled.id },
    data: { cancelledAt: new Date(), cancellationReason: 'Não vou fazer mais o curso' },
  })

  // --- Conta a pagar parcelada (financiamento) — passado e futuro -------------------------
  console.log('Criando financiamento parcelado (10x)...')
  const financiamento = await createPayableGroup(userId, {
    type: 'expense',
    recurrenceType: 'installment',
    amount: 350,
    dueDay: 10,
    startDate: iso(addMonths(today, -3)),
    installmentCount: 10,
    description: 'Financiamento notebook',
    accountId: contaCorrente.id,
  })
  const financiamentoParcelas = await prisma.payable.findMany({
    where: { groupId: financiamento.id },
    orderBy: { installmentNumber: 'asc' },
  })
  for (const parcela of financiamentoParcelas.slice(0, 3)) {
    await payPayable(userId, parcela.id, { accountId: contaCorrente.id })
  }

  // --- Conta a pagar recorrente (aluguel) — passado e futuro -------------------------------
  console.log('Criando aluguel recorrente...')
  const aluguel = await createPayableGroup(userId, {
    type: 'expense',
    recurrenceType: 'recurring',
    amount: 1800,
    dueDay: 5,
    startDate: iso(addMonths(today, -2)),
    description: 'Aluguel apartamento',
    counterparty: 'Imobiliária Alfa',
    accountId: poupanca.id,
  })
  const aluguelParcelas = await prisma.payable.findMany({
    where: { groupId: aluguel.id },
    orderBy: { installmentNumber: 'asc' },
  })
  for (const parcela of aluguelParcelas.slice(0, 2)) {
    await payPayable(userId, parcela.id, { accountId: poupanca.id })
  }

  console.log('')
  console.log('Concluído! Login de demonstração:')
  console.log(`  E-mail: ${DEMO_EMAIL}`)
  console.log(`  Senha:  ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('Falha ao gerar dados de demonstração:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
