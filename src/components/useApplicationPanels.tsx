import { useState } from 'react'
import { useStore } from '../store'
import type { Application } from '../types'
import { ApplicationDrawer } from './ApplicationDrawer'
import { ApplicationForm } from './ApplicationForm'

/** Боковая панель заявки и форма создания/редактирования */
export function useApplicationPanels() {
  const { db, notify } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<{ app?: Application } | null>(null)
  const current = openId ? db.applications.find((a) => a.id === openId) : undefined

  const element = (
    <>
      {current && <ApplicationDrawer app={current} onClose={() => setOpenId(null)} onEdit={(a) => setForm({ app: a })} />}
      {form && (
        <ApplicationForm
          app={form.app}
          onClose={() => setForm(null)}
          onSaved={(a) => {
            setForm(null)
            setOpenId(a.id)
            notify(a.verdict === 'over' ? 'error' : 'success', a.verdict === 'over' ? `Заявка ${a.number} сохранена. Выявлено превышение ценового ориентира на ${a.deviation}%` : `Заявка ${a.number} сохранена`)
          }}
        />
      )}
    </>
  )
  return { open: (a: Application) => setOpenId(a.id), create: () => setForm({}), element }
}
