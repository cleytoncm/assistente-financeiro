import { useState } from 'react'
import type { Transaction } from './transactionsApi'
import { updateTransaction, deleteTransaction } from './transactionsApi'
import type { Category } from '../categories/categoriesApi'
import { ApiError } from '../lib/httpClient'
import { cn } from '../lib/cn'
import { formatCurrency } from '../lib/currency'
import { ItemRow, Input, Button, Badge, Alert } from '../components/ui'

export function TransactionRow({
  transaction,
  categories,
  onChanged,
}: {
  transaction: Transaction
  categories: Category[]
  onChanged: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [description, setDescription] = useState(transaction.description)
  const [amount, setAmount] = useState(transaction.amount)
  const [applyToRemaining, setApplyToRemaining] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)

  const category = categories.find((c) => c.id === transaction.categoryId)
  const isInstallment = Boolean(transaction.installmentGroupId)

  async function handleSave() {
    setLockError(null)
    try {
      await updateTransaction(
        transaction.id,
        { description, amount: Number(amount) },
        applyToRemaining
      )
      setIsEditing(false)
      onChanged()
    } catch (err) {
      setLockError(
        err instanceof ApiError ? err.message : 'Erro ao salvar. Tente novamente.'
      )
    }
  }

  async function handleDelete(scope: 'single' | 'remaining') {
    setLockError(null)
    try {
      await deleteTransaction(transaction.id, scope)
      setIsConfirmingDelete(false)
      onChanged()
    } catch (err) {
      setLockError(
        err instanceof ApiError ? err.message : 'Erro ao remover. Tente novamente.'
      )
      setIsConfirmingDelete(false)
    }
  }

  if (isEditing) {
    return (
      <ItemRow className="flex-col items-stretch">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`Descrição de ${transaction.description}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="max-w-xs"
          />
          <Input
            aria-label={`Valor de ${transaction.description}`}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="max-w-32"
          />
        </div>
        {isInstallment && (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={applyToRemaining}
              onChange={(e) => setApplyToRemaining(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-600"
            />
            Aplicar às parcelas restantes
          </label>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={handleSave}>
            Salvar
          </Button>
          <Button size="sm" onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        </div>
        {lockError && <Alert>{lockError}</Alert>}
      </ItemRow>
    )
  }

  return (
    <ItemRow>
      <div>
        <p className="font-medium text-slate-900 dark:text-slate-50">
          {transaction.description}
          {category && (
            <Badge tone="blue" className="ml-2">
              {category.name}
            </Badge>
          )}
          {transaction.installmentNumber && (
            <Badge tone="slate" className="ml-2">
              {transaction.installmentNumber}/{transaction.installmentCount}
            </Badge>
          )}
          {transaction.refundOfTransactionId && (
            <Badge tone="purple" className="ml-2">
              estorno
            </Badge>
          )}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{transaction.date.slice(0, 10)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'font-semibold tabular-nums',
            transaction.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {transaction.type === 'expense' ? '-' : '+'}
          {formatCurrency(transaction.amount)}
        </span>
        <Button size="sm" onClick={() => setIsEditing(true)}>
          Editar
        </Button>
        {isConfirmingDelete ? (
          <span className="flex flex-wrap gap-2">
            {isInstallment ? (
              <>
                <Button size="sm" variant="danger" onClick={() => handleDelete('single')}>
                  Remover só esta
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete('remaining')}>
                  Remover esta e as restantes
                </Button>
              </>
            ) : (
              <Button size="sm" variant="danger" onClick={() => handleDelete('single')}>
                Confirmar remoção
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setIsConfirmingDelete(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setIsConfirmingDelete(true)}>
            Remover
          </Button>
        )}
      </div>
      {lockError && <Alert>{lockError}</Alert>}
    </ItemRow>
  )
}
