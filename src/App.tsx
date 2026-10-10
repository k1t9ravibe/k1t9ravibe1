import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { StoreProvider, useStore } from './store'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Applications } from './pages/Applications'
import { PriceBase } from './pages/PriceBase'
import { Market } from './pages/Market'
import { Analytics } from './pages/Analytics'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

function Gate() {
  const { ready, loadError } = useStore()
  if (loadError)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-white p-6 text-sm">
          <h1 className="mb-2 text-base font-semibold text-over">Не удалось загрузить данные</h1>
          <p className="text-slate-700">{loadError}</p>
          <button className="mt-4 rounded-md bg-brand-600 px-3 py-2 text-white" onClick={() => location.reload()}>
            Повторить
          </button>
        </div>
      </div>
    )
  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <Loader2 className="animate-spin" size={18} /> Загрузка данных…
      </div>
    )
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="prices" element={<PriceBase />} />
        <Route path="market" element={<Market />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </HashRouter>
  )
}
