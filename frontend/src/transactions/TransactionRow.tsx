import { useState } from 'react'
import type { Transaction } from './transactionsApi'
import { updateTransaction, deleteTransaction } from './transactionsApi'
import type { Category } from '../categories/categoriesApi'

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

  const category = categories.find((c) => c.id === transaction.categoryId)
  const isInstallment = Boolean(transaction.installmentGroupId)

  async function handleSave() {
    await updateTransaction(
      transaction.id,
      { description, amount: Number(amount) },
      applyToRemaining
    )
    setIsEditing(false)
    onChanged()
  }

  async function handleDelete(scope: 'single' | 'remaining') {
    await deleteTransaction(transaction.id, scope)
    setIsConfirmingDelete(false)
    onChanged()
  }

  if (isEditing) {
    return (
      <li>
        <input
          aria-label={`Descrição de ${transaction.description}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          aria-label={`Valor de ${transaction.description}`}
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {isInstallment && (
          <label>
            <input
              type="checkbox"
              checked={applyToRemaining}
              onChange={(e) => setApplyToRemaining(e.target.checked)}
            />
            Aplicar às parcelas restantes
          </label>
        )}
        <button type="button" onClick={handleSave}>
          Salvar
        </button>
        <button type="button" onClick={() => setIsEditing(false)}>
          Cancelar
        </button>
      </li>
    )
  }

  return (
    <li>
      {transaction.date.slice(0, 10)} — {transaction.description} — {transaction.type === 'expense' ? '-' : '+'}
      {transaction.amount}
      {category && ` — ${category.name}`}
      {transaction.installmentNumber && ` — ${transaction.installmentNumber}/${transaction.installmentCount}`}
      {transaction.refundOfTransactionId && ' — estorno'}
      <button type="button" onClick={() => setIsEditing(true)}>
        Editar
      </button>
      {isConfirmingDelete ? (
        <span>
          {isInstallment ? (
            <>
              <button type="button" onClick={() => handleDelete('single')}>
                Remover só esta
              </button>
              <button type="button" onClick={() => handleDelete('remaining')}>
                Remover esta e as restantes
              </button>
            </>
          ) : (
            <button type="button" onClick={() => handleDelete('single')}>
              Confirmar remoção
            </button>
          )}
          <button type="button" onClick={() => setIsConfirmingDelete(false)}>
            Cancelar
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setIsConfirmingDelete(true)}>
          Remover
        </button>
      )}
    </li>
  )
}
