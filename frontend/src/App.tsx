import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { HomePage } from './pages/HomePage'
import { AccountsPage } from './pages/AccountsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { CardInvoicesPage } from './pages/CardInvoicesPage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'
import { PayablesPage } from './pages/PayablesPage'
import { PayableGroupDetailPage } from './pages/PayableGroupDetailPage'
import { ImportUploadPage } from './pages/ImportUploadPage'
import { ImportBatchDetailPage } from './pages/ImportBatchDetailPage'
import { ImportHistoryPage } from './pages/ImportHistoryPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/contas"
            element={
              <RequireAuth>
                <AccountsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/lancamentos"
            element={
              <RequireAuth>
                <TransactionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/cartoes/:cardId/faturas"
            element={
              <RequireAuth>
                <CardInvoicesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/faturas/:invoiceId"
            element={
              <RequireAuth>
                <InvoiceDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/contas-a-pagar"
            element={
              <RequireAuth>
                <PayablesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/contas-a-pagar/grupos/:groupId"
            element={
              <RequireAuth>
                <PayableGroupDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/importacoes"
            element={
              <RequireAuth>
                <ImportHistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/importacoes/nova"
            element={
              <RequireAuth>
                <ImportUploadPage />
              </RequireAuth>
            }
          />
          <Route
            path="/importacoes/:id"
            element={
              <RequireAuth>
                <ImportBatchDetailPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
